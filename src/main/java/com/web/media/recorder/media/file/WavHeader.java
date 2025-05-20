package com.web.media.recorder.media.file;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public class WavHeader {

    public static final int HEADER_SIZE = 44;

    // RIFF 块
    public final byte[] riff = {'R', 'I', 'F', 'F'};
    public int fileSize; // 文件总大小 - 8
    public final byte[] wave = {'W', 'A', 'V', 'E'};

    // fmt 子块
    public final byte[] fmt = {'f', 'm', 't', ' '};
    public final int fmtSize = 16; // 固定为16
    public final short audioFormat = 1; // PCM=1
    public short channels; // 声道数
    public int sampleRate; // 采样率（Hz）
    public int byteRate; // 每秒字节数 = sampleRate * blockAlign
    public short blockAlign; // 每帧字节数 = channels * bitsPerSample / 8
    public short bitsPerSample; // 位深度（如 16）

    // data 子块
    public final byte[] data = {'d', 'a', 't', 'a'};
    public int dataSize; // 音频数据大小（不包含头部）

    /**
     * 将 WAV 头信息转换为字节数组
     *
     * @return 包含 WAV 文件头的字节数组（共44字节）
     */
    public byte[] toBytes() {
        if (fileSize < 0 || dataSize < 0) {
            throw new IllegalArgumentException("文件大小不能为负数");
        }

        if (fileSize > Integer.MAX_VALUE - 36) {
            throw new IllegalArgumentException("文件太大，无法表示为标准 WAV");
        }

        ByteBuffer buffer = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);

        buffer.put(riff)
              .putInt(fileSize)
              .put(wave)
              .put(fmt)
              .putInt(fmtSize)
              .putShort(audioFormat)
              .putShort(channels)
              .putInt(sampleRate)
              .putInt(byteRate)
              .putShort(blockAlign)
              .putShort(bitsPerSample)
              .put(data)
              .putInt(dataSize);

        return buffer.array();
    }

    /**
     * 工厂方法：创建指定参数的 WAV 文件头
     *
     * @param dataSize       音频数据大小（不含头部）
     * @param sampleRate     采样率（Hz）
     * @param channels       声道数（1=单声道，2=立体声）
     * @param bitsPerSample  位深度（8或16）
     * @return WAV 文件头字节数组（44字节）
     */
    public static byte[] createHeader(int dataSize, int sampleRate, int channels, int bitsPerSample) {
        WavHeader header = new WavHeader();
        header.setDataSize(dataSize);
        header.sampleRate = sampleRate;
        header.channels = (short) channels;
        header.bitsPerSample = (short) bitsPerSample;
        header.blockAlign = (short) (channels * bitsPerSample / 8);
        header.byteRate = sampleRate * header.blockAlign;
        return header.toBytes();
    }

    /**
     * 设置音频数据大小并自动更新相关字段
     *
     * @param dataSize 音频数据大小（不包含头部）
     */
    public void setDataSize(int dataSize) {
        this.dataSize = dataSize;
        this.fileSize = dataSize + 36;
    }
}