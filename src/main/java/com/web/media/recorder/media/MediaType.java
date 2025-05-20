package com.web.media.recorder.media;

public enum MediaType {
	AUDIO(0, "mp3"), VIDEO(1, "mp4");

	private int type;

	private final String fileExtension;

	MediaType(int type, String fileExtension) {
		this.type = type;
		this.fileExtension = fileExtension;
	}

	public static MediaType getMediaType(byte type) {
		MediaType[] values = MediaType.values();
		for (MediaType mediaType : values) {
			if (type == mediaType.getType()) {
				return mediaType;
			}
		}
		return null;
	}

	public String getFileExtension() {
		return fileExtension;
	}

	public int getType() {
		return type;
	}

	public void setType(int type) {
		this.type = type;
	}
}