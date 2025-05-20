package com.web.media.recorder.media;

import com.web.media.recorder.media.processor.MediaProcessor;
import com.web.media.recorder.media.processor.javasound.JavaSoundMediaProcessor;
import com.web.media.recorder.media.processor.jni.NativeProcessor;

public class MediaProcessorFactory {
	public static void main(String[] args) throws InterruptedException {
		MediaProcessor processor = MediaProcessorFactory.create("jni");
		processor.start(true);
		Thread.sleep(10000);
		processor.stop();
	}

	public static MediaProcessor create(String type) {
		switch (type.toLowerCase()) {
		case "jni":
			return new NativeProcessor();
		case "javasound":
			return new JavaSoundMediaProcessor();
		default:
			throw new IllegalArgumentException("未知的媒体处理器类型: " + type);
		}
	}
}