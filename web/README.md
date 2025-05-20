# Web 媒体录制器前端

此目录包含 Web 媒体录制器应用程序的前端代码。前端使用 Vue.js 构建，负责通过 WebSocket 捕获和流式传输媒体数据到后端。


## 功能特性

- **录音模式切换**：支持在本地录音和远程录音之间切换
- **远程录音配置**：可自定义远程服务器地址和端口，默认值从环境变量或 localStorage 中读取
- **设备兼容性检查**：自动检测浏览器是否支持音频录制功能
- **WebSocket 通信**：通过 WebSocket 协议实时传输音频数据
- **音频播放**：支持录制音频的回放功能
- **录音文件管理**：提供录音文件列表展示、分页导航、单个/批量删除等功能

## 环境配置

项目使用以下环境变量配置：
- `VUE_APP_API_BASE_URL`: API 基础 URL，默认为 `/api`
- `VUE_APP_API_PORT`: API 端口号，默认为 `8080`
- `VUE_APP_WEBSOCKET_URL`: WebSocket 地址，默认为 `ws://localhost:8080/websocket`

多环境配置通过 `src/config.js` 实现，包含开发、测试和生产环境的不同配置。每个环境都有独立的 API 基础 URL 和 WebSocket 地址配置。

## 开发规范

- 所有变量必须在使用前正确定义
- 删除未使用的变量和函数以优化代码质量
- 使用 `localStorage` 缓存用户设置
- 避免硬编码，使用环境变量管理配置信息
- 确保 `MediaRecorder` 接收有效的 `MediaStream` 对象
- 在 Vue.js 中访问 `ref()` 时使用 `.value`
- 异步函数必须声明为 `async` 函数

## 快速开始

要在本地运行前端，请按照以下步骤操作：

1. 确保系统已安装 Node.js 和 Yarn。
2. 进入 `web` 目录。
3. 运行以下命令以安装依赖项：
```bash
yarn install
```
4. 运行以下命令以启动开发服务器：
```bash
yarn serve
```
5. 或者直接运行 start.sh 脚本启动：
```bash
chmod +x start.sh  # 如果需要
./start.sh
