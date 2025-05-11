package com.web.media.recorder.media.file;

import java.io.IOException;

public class VideoFile extends MediaFile {
    public VideoFile(String outputDir) {
        super(outputDir, "video");
        initializeFile();
    }

    @Override
    protected String getFileExtension() {
        return "mp4";
    }

    @Override
    protected void writeHeader() throws IOException {
        // MP4需要写入ftyp、moov等原子，此处简化示例
        // 实际应使用专业库（如MP4Parser）处理
        file.writeBytes("ftypmp42"); // 示例ftyp原子
    }

    @Override
    protected void updateHeader() throws IOException {
        // MP4需更新moov原子中的时长等信息
        // 此处示意，实际需复杂处理
        file.seek(0);
        file.writeBytes("updated_header");
    }

	@Override
	public byte[] getHeaderBytes() {
		return null;
	}
}