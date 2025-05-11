package com.web.media.recorder.media.processor;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import com.web.media.recorder.media.file.MediaFile;

public abstract class AbstractMediaProcessor implements MediaProcessor {
	public final AtomicBoolean isRunning = new AtomicBoolean(false);
	protected final BlockingQueue<byte[]> dataQueue = new LinkedBlockingQueue<>(1000);
	protected boolean isAudio;
	protected MediaFile mediaFile;

	@Override
	public byte[] getRealtimeData() {
		try {
			return dataQueue.poll(500, TimeUnit.MILLISECONDS);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			return null;
		}
	}

	public void processData(byte[] data) {
		if (data == null || data.length == 0)
			return;
		dataQueue.add(data);
		if (isAudio && mediaFile != null) {
			mediaFile.writeData(data);
		}
	}
}