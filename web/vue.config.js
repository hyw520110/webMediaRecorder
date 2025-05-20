module.exports = {
    devServer: {
        proxy: {
            '/api': {
                target:
                    process.env.VUE_APP_API_BASE_URL || 'http://localhost:8080',
                changeOrigin: true,
                pathRewrite: { '^/api': '' },
            },
            '/websocket': {
                target:
                    process.env.VUE_APP_WEBSOCKET_URL || 'ws://localhost:8080',
                ws: true,
                changeOrigin: true,
            },
        },
    },
}
