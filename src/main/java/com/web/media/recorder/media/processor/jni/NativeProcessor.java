package com.web.media.recorder.media.processor.jni;

import java.io.File;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.web.media.recorder.config.MediaConfig;
import com.web.media.recorder.media.callback.DataCallback;
import com.web.media.recorder.media.file.AudioFile;
import com.web.media.recorder.media.file.VideoFile;
import com.web.media.recorder.media.processor.AbstractMediaProcessor;
import com.web.media.recorder.utils.CmdExecutor;
@Component
public class NativeProcessor extends AbstractMediaProcessor {
    private static final Logger logger = LoggerFactory.getLogger(NativeProcessor.class);
    @Autowired
	private  MediaConfig mediaConfig;
    
    static {
        loadLibrary();
    }
    // 本地方法
    public native void startCapture(DataCallback callback, boolean isAudio);
    public native void releaseResources();
    public native boolean isKeyPressed(int keyCode);
    public native int[] getAudioParams();
    public native void stopCapture();
  

    private static void loadLibrary() {
        String nativeDir = System.getProperty("native.dir", "src/main/resources/native");
        String libName = "libmediaProcessor.so";
        File dir = new File(nativeDir);
        File file = new File(dir, libName);
        if (!file.exists() || "true".equals(System.getenv("DEBUG_REBUILD_NATIVE"))) {
            List<String> output = CmdExecutor.execWithOutput(
                "bash", 
                "-c", 
                new File(dir.getAbsoluteFile(), "build.sh").getAbsolutePath()
            ).getOutput();
            if (output.stream().anyMatch(line -> line.contains("失败"))) {
                logger.error("本地库编译失败");
                return;
            }
        }
        try {
            System.load(file.getAbsolutePath());
        } catch (UnsatisfiedLinkError e) {
            logger.error("Failed to load native library: {}", e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public void start(boolean isAudio) {
        if (!isRunning.compareAndSet(false, true)) return;
        this.isAudio = isAudio;
        int[] params = getAudioParams();
        mediaFile = isAudio ? new AudioFile(mediaConfig.getAudioDir(), params[0], params[1], params[2]) : new VideoFile("");
        new Thread(() -> {
            startCapture(data -> processData(data), isAudio);
            try {
                String[] cmd = {"/bin/sh", "-c", "stty raw -echo </dev/tty"};
                CmdExecutor.execForStatus(cmd);
                startKeyListener();
            } catch (Exception e) {
                logger.error("终端设置失败: {}", e.getMessage());
            } finally {
                String[] cmd = {"/bin/sh", "-c", "stty sane </dev/tty"};
                CmdExecutor.execForStatus(cmd);
            }
        }).start();
    }

    @Override
    public void stop() {
        isRunning.set(false);
        stopCapture();
        dataQueue.clear();
        if (mediaFile != null) {
            mediaFile.close();
        }
    }



    private void startKeyListener() {
        new Thread(() -> {
            while (isRunning.get()) {
                if (isKeyPressed('q')) {
                    logger.info("检测到停止键，停止采集");
                    stop();
                    break;
                }
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }).start();
    }

 
}