# Web 媒体录制器

这是一个基于 Java、WebSocket 和 JNI 的 Web 媒体录制器应用程序。它允许用户通过浏览器录制视频和音频，并将录制的数据通过 WebSocket 传输到后端进行处理。

## 功能介绍

- **媒体录制**：支持通过浏览器录制视频和音频。
- **WebSocket 数据传输**：录制的媒体数据通过 WebSocket 实时传输到后端。
- **音频处理**：后端通过 JNI 调用本地库（如 FFmpeg）对音频数据进行处理。
- **文件管理**：支持录音文件的列表查看、播放和删除操作。
- **实时预览**：支持录制过程中的实时预览功能。

## 技术栈

### 后端
- **核心框架**：Spring Boot
- **WebSocket**：Spring WebSocket
- **媒体处理**：
  - JNI 本地库集成
  - Java Sound API
  - FFmpeg（通过 Java Wrapper）
- **文件处理**：
  - WAV 音频文件格式支持
  - MP4 视频文件格式支持

### 前端
- **框架**：Vue.js
- **构建工具**：Webpack
- **HTTP 客户端**：Axios
- **UI 组件**：自定义组件

## 项目结构

```
├── src/main/java/com/web/media/recorder/
│   ├── config/           # 配置类
│   ├── controller/       # REST API 控制器
│   ├── media/           # 媒体处理相关类
│   │   ├── file/        # 文件处理类
│   │   ├── processor/   # 媒体处理器
│   │   └── callback/    # 回调接口
│   └── websocket/       # WebSocket 相关类
├── web/                 # 前端项目
│   ├── src/            # 源代码
│   ├── public/         # 静态资源
│   └── dist/           # 构建输出
└── pom.xml             # Maven 配置文件
```

## 运行方式

1. **启动后端**  
   在项目根目录下运行以下命令以启动 Spring Boot 应用程序：
   ```bash
   mvn spring-boot:run
   ```

2. **启动前端**  
   在 web 目录下执行 Shell 脚本启动前端开发服务器：
   ```bash
   ./web/start.sh
   ```

## 配置说明

### 媒体文件存储
- 音频文件默认存储在：`/opt/home/sky/Music`
- 视频文件默认存储在：`/opt/home/sky/Videos`

### 音频参数
- 采样率：44.1kHz
- 声道数：2（立体声）
- 位深度：16位

## 开发说明

### 本地库编译
项目使用 JNI 调用本地库进行媒体处理。本地库位于 `src/main/resources/native` 目录下，可以通过 `build.sh` 脚本进行编译。

### 媒体处理器
项目支持两种媒体处理器：
1. JNI 处理器：通过本地库进行媒体处理
2. JavaSound 处理器：使用 Java Sound API 进行音频处理

## 注意事项

1. 确保系统已安装必要的依赖：
   - Java 8 或更高版本
   - Maven
   - Node.js 和 npm/yarn
   - FFmpeg（如果使用 JNI 处理器）

2. 首次运行前需要编译本地库：
   ```bash
   cd src/main/resources/native
   ./build.sh
   ```

3. 如果遇到权限问题，请确保相关目录具有适当的读写权限。