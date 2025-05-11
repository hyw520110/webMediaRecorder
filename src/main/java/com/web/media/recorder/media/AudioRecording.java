package com.web.media.recorder.media;

import java.time.LocalDateTime;

public class AudioRecording {
    private String id;
    private String fileName;
    private long fileSize;
    private LocalDateTime createdAt;
    private int duration; // 录音时长，单位：秒

    // 构造函数、getter和setter方法
    public AudioRecording(String id, String fileName, long fileSize, LocalDateTime createdAt, int duration) {
        this.id = id;
        this.fileName = fileName;
        this.fileSize = fileSize;
        this.createdAt = createdAt;
        this.duration = duration;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public long getFileSize() {
        return fileSize;
    }

    public void setFileSize(long fileSize) {
        this.fileSize = fileSize;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public int getDuration() {
        return duration;
    }

    public void setDuration(int duration) {
        this.duration = duration;
    }
}