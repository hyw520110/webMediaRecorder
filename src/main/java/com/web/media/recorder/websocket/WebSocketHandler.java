package com.web.media.recorder.websocket;

import java.io.IOException;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.web.media.recorder.config.MediaConfig;
import com.web.media.recorder.media.MediaType;
import com.web.media.recorder.media.file.AudioFile;
import com.web.media.recorder.media.file.MediaFile;
import com.web.media.recorder.media.file.VideoFile;
import com.web.media.recorder.media.processor.jni.NativeProcessor;

@Component
public class WebSocketHandler extends TextWebSocketHandler {
	private static final Logger logger = LoggerFactory.getLogger(WebSocketHandler.class);
	private static final int BUFFER_SIZE = 4096;
	private static final int MAX_SESSIONS = 10;
	private static final int SHUTDOWN_TIMEOUT = 5;
	private static final int MAX_RETRY_COUNT = 3;
	private static final long RETRY_DELAY_MS = 1000;

	private final Map<String, MediaFile> mediaHandlers = new ConcurrentHashMap<>();
	private final Map<String, Boolean> sentHeaders = new ConcurrentHashMap<>();
	private final Map<String, Boolean> activeSessions = new ConcurrentHashMap<>();
	private final Map<String, AtomicInteger> retryCounts = new ConcurrentHashMap<>();
	private final ExecutorService executorService;
	private final NativeProcessor nativeProcessor;
	private final MediaConfig mediaConfig;

	@Autowired
	public WebSocketHandler(MediaConfig mediaConfig, NativeProcessor nativeProcessor) {
		this.mediaConfig = mediaConfig;
		this.nativeProcessor = nativeProcessor;
		this.executorService = Executors.newFixedThreadPool(MAX_SESSIONS);
	}

	@Override
	public void afterConnectionEstablished(WebSocketSession session) {
		String sessionId = session.getId();
		if (activeSessions.size() >= MAX_SESSIONS) {
			try {
				session.close(CloseStatus.POLICY_VIOLATION.withReason("达到最大连接数限制"));
				return;
			} catch (IOException e) {
				logger.error("关闭连接失败: {}", e.getMessage());
			}
		}
		activeSessions.put(sessionId, true);
		retryCounts.put(sessionId, new AtomicInteger(0));
		logger.info("新的WebSocket连接已建立: {}", sessionId);
	}

	@Override
	protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
		if (!activeSessions.getOrDefault(session.getId(), false)) {
			logger.warn("收到未激活会话的消息: {}", session.getId());
			return;
		}

		byte[] data = message.getPayload().array();
		if (data.length == 0) {
			logger.warn("收到空数据包");
			return;
		}

		try {
			byte type = data[0];
			byte[] mediaData = Arrays.copyOfRange(data, 1, data.length);
			boolean isAudio = (MediaType.getMediaType(type) == MediaType.AUDIO);
			logger.info("收到{}数据流大小: {}", isAudio ? "音频" : "视频", mediaData.length);

			MediaFile mediaFile = getOrCreateMediaFile(session, isAudio);
			if (mediaFile == null) {
				logger.error("创建媒体文件失败");
				return;
			}

			if (mediaData.length == 0) {
				handleEmptyMediaData(session, mediaFile, isAudio);
			} else {
				handleMediaData(mediaFile, mediaData, isAudio);
			}

			// 重置重试计数
			retryCounts.get(session.getId()).set(0);
		} catch (Exception e) {
			logger.error("处理消息时发生错误: {}", e.getMessage(), e);
			handleError(session, e);
		}
	}

	private MediaFile getOrCreateMediaFile(WebSocketSession session, boolean isAudio) {
		return mediaHandlers.computeIfAbsent(session.getId(), id -> {
			try {
				if (isAudio) {
					int[] params = nativeProcessor.getAudioParams();
					if (params == null || params.length < 3) {
						params = new int[] { 44100, 2, 16 };
					}
					return new AudioFile(mediaConfig.getAudioDir(), params[0], params[1], params[2]);
				} else {
					return new VideoFile(mediaConfig.getVideoDir());
				}
			} catch (Exception e) {
				logger.error("创建媒体文件失败: {}", e.getMessage());
				return null;
			}
		});
	}

	private void handleEmptyMediaData(WebSocketSession session, MediaFile mediaFile, boolean isAudio) {
		nativeProcessor.start(isAudio);
		executorService.submit(() -> {
			try {
				processMediaStream(session, mediaFile);
			} catch (Exception e) {
				logger.error("处理媒体流时发生错误: {}", e.getMessage());
				handleError(session, e);
			}
		});
	}

	private void processMediaStream(WebSocketSession session, MediaFile mediaFile) {
		byte[] buffer = new byte[BUFFER_SIZE];
		int bufferPos = 0;
		int consecutiveErrors = 0;
		final int MAX_CONSECUTIVE_ERRORS = 5;

		while (nativeProcessor.isRunning.get() && activeSessions.getOrDefault(session.getId(), false)) {
			try {
				byte[] bytes = nativeProcessor.getRealtimeData();
				if (bytes == null) {
					consecutiveErrors++;
					if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
						logger.error("连续{}次获取数据失败，停止处理", MAX_CONSECUTIVE_ERRORS);
						break;
					}
					Thread.sleep(100);
					continue;
				}

				consecutiveErrors = 0;
				int offset = 0;
				while (offset < bytes.length) {
					int toCopy = Math.min(BUFFER_SIZE - bufferPos, bytes.length - offset);
					System.arraycopy(bytes, offset, buffer, bufferPos, toCopy);
					bufferPos += toCopy;
					offset += toCopy;

					if (bufferPos == BUFFER_SIZE) {
						sendMessageWithRetry(session, mediaFile, Arrays.copyOf(buffer, BUFFER_SIZE));
						bufferPos = 0;
					}
				}
			} catch (Exception e) {
				logger.error("处理媒体流时发生错误: {}", e.getMessage());
				consecutiveErrors++;
				if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
					break;
				}
			}
		}

		if (bufferPos > 0) {
			sendMessageWithRetry(session, mediaFile, Arrays.copyOf(buffer, bufferPos));
		}
	}

	private void sendMessageWithRetry(WebSocketSession session, MediaFile mediaFile, byte[] data) {
		String sessionId = session.getId();
		AtomicInteger retryCount = retryCounts.get(sessionId);
		
		for (int i = 0; i < MAX_RETRY_COUNT; i++) {
			try {
				sendMessage(session, mediaFile, data);
				retryCount.set(0);
				return;
			} catch (Exception e) {
				logger.warn("发送消息失败，重试 {}/{}: {}", i + 1, MAX_RETRY_COUNT, e.getMessage());
				try {
					Thread.sleep(RETRY_DELAY_MS);
				} catch (InterruptedException ie) {
					Thread.currentThread().interrupt();
					break;
				}
			}
		}
		
		retryCount.incrementAndGet();
		if (retryCount.get() >= MAX_RETRY_COUNT) {
			handleError(session, new IOException("发送消息重试次数超过限制"));
		}
	}

	private void handleMediaData(MediaFile mediaFile, byte[] mediaData, boolean isAudio) {
		if (mediaData != null && mediaData.length > 0) {
			logger.info("写入{}数据流:{}", isAudio ? "音频" : "视频", mediaData.length);
			mediaFile.writeData(mediaData);
		}
	}

	public void sendMessage(WebSocketSession session, MediaFile mediaFile, byte[] data) throws IOException {
		String sessionId = session.getId();
		if (!activeSessions.getOrDefault(sessionId, false)) {
			throw new IOException("会话未激活");
		}

		if (!sentHeaders.getOrDefault(sessionId, false)) {
			byte[] header = mediaFile.getHeaderBytes();
			if (header != null) {
				session.sendMessage(new BinaryMessage(header));
				sentHeaders.put(sessionId, true);
			}
		}
		logger.debug("发送数据大小: {}", data.length);
		session.sendMessage(new BinaryMessage(data));
	}

	private void handleError(WebSocketSession session, Exception e) {
		try {
			session.close(CloseStatus.SERVER_ERROR.withReason("处理消息时发生错误: " + e.getMessage()));
		} catch (IOException ex) {
			logger.error("关闭会话失败: {}", ex.getMessage());
		} finally {
			cleanupSession(session.getId());
		}
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
		String sessionId = session.getId();
		logger.info("WebSocket连接已关闭: {}, 状态: {}", sessionId, status);
		cleanupSession(sessionId);
	}

	private void cleanupSession(String sessionId) {
		activeSessions.remove(sessionId);
		sentHeaders.remove(sessionId);
		retryCounts.remove(sessionId);
		nativeProcessor.stop();
		MediaFile file = mediaHandlers.remove(sessionId);
		if (file != null) {
			file.close();
		}
	}

	public void shutdown() {
		try {
			executorService.shutdown();
			if (!executorService.awaitTermination(SHUTDOWN_TIMEOUT, TimeUnit.SECONDS)) {
				executorService.shutdownNow();
			}
		} catch (InterruptedException e) {
			executorService.shutdownNow();
			Thread.currentThread().interrupt();
		}
	}
}