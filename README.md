# Web 媒体录制器

这是一个基于 Java、WebSocket 和 JNI 的 Web 媒体录制器应用程序。它允许用户通过浏览器录制视频和音频，并将录制的数据通过 WebSocket 传输到后端进行处理。

## 功能介绍

- **媒体录制**：支持通过浏览器录制视频和音频。
- **WebSocket 数据传输**：录制的媒体数据通过 WebSocket 实时传输到后端。
- **音频处理**：后端通过 JNI 调用本地库（如 FFmpeg）对音频数据进行处理。

## 技术栈

- **后端**：
  - Java
  - Spring Boot
  - WebSocket
  - JNI
  - FFmpeg（通过 Java Wrapper）
- **前端**：
  - Vue.js
  - Webpack
  - Axios



## 运行方式

1. **启动后端**  
   在项目根目录下运行以下命令以启动 Spring Boot 应用程序：
   ```bash
   mvn spring-boot:run

2. **启动前端**  
   在web目录下执行Shell 脚本启动前端开发服务器：
   ```bash
   ./web/start.sh