package com.web.media.recorder.controller;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.web.media.recorder.config.MediaConfig;
import com.web.media.recorder.media.AudioRecording;

import ch.qos.logback.classic.Logger;

@RestController
@RequestMapping("/api/audio-recordings")
@CrossOrigin(origins = "*") 
public class AudioRecordingController {
    private static final Logger logger = (Logger) LoggerFactory.getLogger(AudioRecordingController.class);
	@Autowired
	private MediaConfig mediaConfig;

	// 分页获取录音文件列表
	@GetMapping
	public ResponseEntity<List<AudioRecording>> getRecordings(@RequestParam(defaultValue = "1") int page,
			@RequestParam(defaultValue = "10") int limit) throws IOException {
		List<AudioRecording> recordings = new ArrayList<>();
		Path audioPath = Paths.get(mediaConfig.getAudioDir());
		if (Files.exists(audioPath)) {
			Files.list(audioPath).filter(
					path -> path.getFileName().toString().startsWith("audio_") && path.toString().endsWith(".wav"))
					.forEach(path -> {
						try {
							File file = path.toFile();
							long fileSize = file.length();
							LocalDateTime createdAt = LocalDateTime
									.ofInstant(Files.getLastModifiedTime(path).toInstant(), ZoneId.systemDefault());
							int duration = (int) (fileSize / (44100 * 2 * 2)); // 假设采样率为44100，双声道，16位
							recordings.add(
									new AudioRecording(file.getName(), file.getName(), fileSize, createdAt, duration));
						} catch (IOException e) {
							e.printStackTrace();
						}
					});
		}
		int start = (page - 1) * limit;
		int end = Math.min(start + limit, recordings.size());
		List<AudioRecording> pagedRecordings = recordings.subList(start, end);
        logger.info("分页获取录音文件列表，当前页：{}，每页数量：{}，总数量：{}", page, limit, recordings.size());
		return ResponseEntity.ok(pagedRecordings);
	}

	// 删除录音文件
	@DeleteMapping
	public ResponseEntity<Void> deleteRecordings(@RequestBody List<String> ids) throws IOException {
		Path audioPath = Paths.get(mediaConfig.getAudioDir());
		if (Files.exists(audioPath)) {
			for (String id : ids) {
				Path filePath = audioPath.resolve(id);
				if (Files.exists(filePath)) {
					Files.delete(filePath);
				}
			}
		}
		return ResponseEntity.noContent().build();
	}

	// 播放录音文件
	@GetMapping("/{id}/play")
	public ResponseEntity<byte[]> playRecording(@PathVariable String id) throws IOException {
		Path audioPath = Paths.get(mediaConfig.getAudioDir());
		Path filePath = audioPath.resolve(id);
		if (Files.exists(filePath)) {
			byte[] audioData = Files.readAllBytes(filePath);
			return ResponseEntity.ok(audioData);
		}
		return ResponseEntity.notFound().build();
	}
}