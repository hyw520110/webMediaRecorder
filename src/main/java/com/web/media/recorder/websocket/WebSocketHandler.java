package com.web.media.recorder.websocket;

import java.io.IOException;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
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
	private final Map<String, MediaFile> mediaHandlers = new ConcurrentHashMap<>();
	private Map<String, Boolean> sentHeaders = new ConcurrentHashMap<>();
	private final NativeProcessor nativeProcessor;
	private final MediaConfig mediaConfig;

	@Autowired
	public WebSocketHandler(MediaConfig mediaConfig,NativeProcessor nativeProcessor) {
		this.mediaConfig=mediaConfig;
		this.nativeProcessor = nativeProcessor;
	}

	@Override
	protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
		byte[] data = message.getPayload().array();
		// 判断数据类型（0表示音频，1表示视频）
		if (data.length == 0) {
			return;
		}
		try {
			byte type = data[0];
			byte[] mediaData = Arrays.copyOfRange(data, 1, data.length);
			boolean isAudio = (MediaType.getMediaType(type) == MediaType.AUDIO);
			logger.info("收到{}数据流大小: {}", isAudio ? "音频" : "视频", mediaData.length);
			boolean isEmpty = (mediaData.length == 0);
			MediaFile mediaFile = mediaHandlers.computeIfAbsent(session.getId(), id -> {
				if (isAudio) {
					int[] params = nativeProcessor.getAudioParams();
					if (params == null || params.length < 3) {
						params = new int[] { 44100, 2, 16 };
					}
					return new AudioFile(mediaConfig.getAudioDir(), params[0], params[1], params[2]);
				} else {
					return new VideoFile(mediaConfig.getVideoDir());
				}
			});
			if (isEmpty) {
				// 如果前端不支持采集音频或视频流，则通过 JNI 获取实时数据
				nativeProcessor.start(isAudio);
				new Thread(() -> {
					byte[] buffer = new byte[4096];
					int bufferPos = 0;
					int bufferSize = 4096;
					while (nativeProcessor.isRunning.get()) {
						byte[] bytes = nativeProcessor.getRealtimeData();
						if (bytes == null) {
							continue;
						}
						int offset = 0;
						while (offset < bytes.length) {
							int toCopy = Math.min(bufferSize - bufferPos, bytes.length - offset);
							System.arraycopy(bytes, offset, buffer, bufferPos, toCopy);
							bufferPos += toCopy;
							offset += toCopy;
							if (bufferPos == bufferSize) {
								sendMessage(session, mediaFile, Arrays.copyOf(buffer, bufferSize));
								bufferPos = 0;
							}
						}
					}
					// 采集结束时，发送剩余未满4096字节的数据
					if (bufferPos > 0) {
						sendMessage(session, mediaFile, Arrays.copyOf(buffer, bufferPos));
					}
				}).start();
				return;
			}
			if (mediaData != null && mediaData.length > 0) {
				logger.info("写入{}数据流:{}", isAudio ? "音频" : "视频", mediaData.length);
				mediaFile.writeData(mediaData);
			}
		} catch (Exception e) {
			logger.error("处理消息时发生错误: {}", e.getMessage());
		}
	}

	// 发送音频数据（流式模式）
	public void sendMessage(WebSocketSession session, MediaFile mediaFile, byte[] data) {
		String sessionId = session.getId();
		try {
			if (!sentHeaders.getOrDefault(sessionId, false)) {
				byte[] header = mediaFile.getHeaderBytes();
				session.sendMessage(new BinaryMessage(header));
				sentHeaders.put(sessionId, true);
			}
			logger.debug("发送：{}", data.length);
			session.sendMessage(new BinaryMessage(data));
		} catch (IOException e) {
			logger.error("发送音频头失败", e);
			sentHeaders.put(sessionId, false);
		}
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status)
			throws Exception {
		logger.info("停止录音或录像");
		String sessionId = session.getId();
		nativeProcessor.stop();
		sentHeaders.put(sessionId, false);
		MediaFile file = mediaHandlers.remove(session.getId());
		if (file != null) {
			file.close();
		}
	}

}