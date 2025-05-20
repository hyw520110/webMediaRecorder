// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index'
import config from './config'

// 将配置挂载到 Vue 实例上
const app = createApp(App)
app.config.globalProperties.$config = config[process.env.NODE_ENV]

if (!window.AudioContext && window.webkitAudioContext) {
    window.AudioContext = window.webkitAudioContext
}

if (!window.MediaRecorder) {
    import('audio-recorder-polyfill').then((module) => {
        window.MediaRecorder = module.default
    })
}

app.use(router).mount('#app')
