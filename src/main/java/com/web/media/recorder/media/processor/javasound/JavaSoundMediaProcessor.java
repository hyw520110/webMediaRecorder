package com.web.media.recorder.media.processor.javasound;

import com.web.media.recorder.media.file.AudioFile;
import com.web.media.recorder.media.processor.AbstractMediaProcessor;

public class JavaSoundMediaProcessor extends AbstractMediaProcessor {
    @Override
    public void start(boolean isAudio) {
        if (!isAudio) throw new UnsupportedOperationException("仅支持音频处理");
        if (!isRunning.compareAndSet(false, true)) return;
        this.isAudio = isAudio;
        // 初始化音频文件
        int[] params = getAudioParams();
        mediaFile = new AudioFile("/opt/home/sky/Music", params[0], params[1], params[2]);
        // 开始捕获音频流
        new Thread(this::captureAudio).start();
    }

    private void captureAudio() {
        // 使用 Java Sound API 捕获音频流并写入队列
        // 示例代码略...
    }

    @Override
    public int[] getAudioParams() {
        // 返回默认参数或从配置中获取
        return new int[]{44100, 2, 16};
    }

    @Override
    public void stop() {
        isRunning.set(false);
        // 停止音频捕获
        dataQueue.clear();
        if (mediaFile != null) {
            mediaFile.close();
        }
    }

    @Override
    public void processData(byte[] data) {
        if (data == null || data.length == 0) return;
        dataQueue.add(data);
        if (isAudio && mediaFile != null) {
            mediaFile.writeData(data);
        }
    }
}