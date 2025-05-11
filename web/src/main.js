// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index'

if (!window.AudioContext && window.webkitAudioContext) {
    window.AudioContext = window.webkitAudioContext
}

if (!window.MediaRecorder) {
    import('audio-recorder-polyfill').then((module) => {
        window.MediaRecorder = module.default
    })
}
createApp(App).use(router).mount('#app')
