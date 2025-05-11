package com.web.media.recorder.media.file;

import java.io.IOException;
import java.io.RandomAccessFile;

public abstract class MediaFile {
	protected String outputDir;
	protected String filePath;
	protected RandomAccessFile file;

	public MediaFile(String outputDir, String filePrefix) {
		this.outputDir = outputDir;
		this.filePath = generateFilePath(filePrefix);
	}

	protected String generateFilePath(String prefix) {
	    return String.format("%s/%s_%d.%s", outputDir, prefix, System.currentTimeMillis(), getFileExtension());
	}

	protected void initializeFile() {
		try {
			file = new RandomAccessFile(filePath, "rw");
			writeHeader(); 
		} catch (IOException e) {
			handleError("文件初始化失败", e);
		}
	}

	public synchronized void writeData(byte[] data) {
		if (data == null || data.length == 0)
			return;
		try {
			file.seek(file.length());
			file.write(data);
			updateHeader(); 
		} catch (IOException e) {
			handleError("写入数据失败", e);
		}
	}

	public void close() {
		try {
			if (file != null) {
				updateHeader();
				file.close();
			}
		} catch (IOException e) {
			handleError("关闭文件失败", e);
		}
	}

	/**
	 * 获取当前媒体文件的头部字节（如 WAV 头部为 44 字节）
	 * @return 包含文件格式信息的字节数组
	 */
	public abstract byte[] getHeaderBytes();
    // 抽象方法定义
    protected abstract String getFileExtension();

    protected abstract void writeHeader() throws IOException;

    protected abstract void updateHeader() throws IOException;

	protected void handleError(String message, Exception e) {
		System.err.println(message + ": " + e.getMessage());
		close();
	}
}