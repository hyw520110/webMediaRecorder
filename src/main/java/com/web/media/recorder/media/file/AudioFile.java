package com.web.media.recorder.media.file;

import java.io.IOException;

public class AudioFile extends MediaFile {
	private int sampleRate;
	private int channels;
	private int bitsPerSample;

	public AudioFile(String outputDir, int sampleRate, int channels, int bitsPerSample) {
		super(outputDir, "audio");
		this.sampleRate = sampleRate;
		this.channels = channels;
		this.bitsPerSample = bitsPerSample;
		initializeFile();
	}

	@Override
	protected void writeHeader() {
		try {
			byte[] header = createWavHeaderBytes(0, sampleRate, channels, bitsPerSample);
			file.write(header);
		} catch (IOException e) {
			handleError("写入头部失败", e);
		}
	}

	@Override
	protected void updateHeader() {
		try {
			if (file.length() > 0) {
				byte[] header = createWavHeaderBytes((int) file.length() - WavHeader.HEADER_SIZE, sampleRate, channels,
						bitsPerSample);
				file.seek(0);
				file.write(header);
			}
		} catch (IOException e) {
			handleError("更新头部失败", e);
		}
	}

	@Override
	public byte[] getHeaderBytes() {
		try {
			int dataSize = (int) (file.length() - WavHeader.HEADER_SIZE);
			return WavHeader.createHeader(dataSize, sampleRate, channels, bitsPerSample);
		} catch (IOException e) {
			handleError("获取头部字节失败", e);
			return new byte[0]; // 返回空数组作为容错
		}
	}

	/**
	 * 生成指定参数的 WAV 文件头部字节数组
	 *
	 * @param dataSize       音频数据大小（不包含头部）
	 * @param sampleRate     采样率（如 44100）
	 * @param channels       声道数（1=单声道，2=立体声）
	 * @param bitsPerSample  位深度（如 16）
	 * @return WAV 文件头字节数组（通常为44字节）
	 */
	public byte[] createWavHeaderBytes(int dataSize, int sampleRate, int channels, int bitsPerSample) {
	    return WavHeader.createHeader(dataSize, sampleRate, channels, bitsPerSample);
	}

	@Override
	protected String getFileExtension() {
		return "wav";
	}
}