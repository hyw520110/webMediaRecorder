// config.js
// 不同环境的配置
export default {
    development: {
        apiBaseUrl: process.env.VUE_APP_API_BASE_URL || '/api',
        websocketUrl:
            process.env.VUE_APP_WEBSOCKET_URL ||
            'ws://localhost:8080/websocket',
    },
    staging: {
        apiBaseUrl: process.env.VUE_APP_API_BASE_URL || '/api',
        websocketUrl:
            process.env.VUE_APP_WEBSOCKET_URL ||
            'ws://localhost:8080/websocket',
    },
    production: {
        apiBaseUrl: process.env.VUE_APP_API_BASE_URL || '/api',
        websocketUrl:
            process.env.VUE_APP_WEBSOCKET_URL ||
            'wss://yourdomain.com/websocket',
    },
}
