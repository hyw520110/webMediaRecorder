package com.web.media.recorder.media.processor;

public interface MediaProcessor {
	void start(boolean isAudio);

	void stop();

	byte[] getRealtimeData();

	int[] getAudioParams();

	 void processData(byte[] data);
}