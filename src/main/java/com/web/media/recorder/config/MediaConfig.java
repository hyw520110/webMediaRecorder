package com.web.media.recorder.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MediaConfig {

    @Value("${media.audio.dir:/opt/home/sky/Music}")
    private String audioDir;

    @Value("${media.video.dir:/opt/home/sky/Videos}")
    private String videoDir;

    public String getAudioDir() {
        return audioDir;
    }

    public String getVideoDir() {
        return videoDir;
    }
}