# Web 媒体录制器前端

此目录包含 Web 媒体录制器应用程序的前端代码。前端使用 Vue.js 构建，负责通过 WebSocket 捕获和流式传输媒体数据到后端。

## 项目结构

- `public/index.html`: 应用程序的主 HTML 文件，作为入口点。
- `src/main.js`: Vue 应用的入口文件。
- `src/App.vue`: Vue 应用的根组件。
- `html5.html`: 用于测试媒体录制功能的替代 HTML 文件。
- `start.sh`: 用于启动 Vue 开发服务器的 Shell 脚本。
- `vue.config.js`: Vue CLI 的配置文件。

## 快速开始

要在本地运行前端，请按照以下步骤操作：

1. 确保系统已安装 Node.js 和 Yarn。
2. 进入 `web` 目录。
3. 运行以下命令以安装依赖项：