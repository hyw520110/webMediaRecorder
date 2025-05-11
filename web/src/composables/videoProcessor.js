import { ref } from 'vue'
// eslint-disable-next-line no-unused-vars
import { videoPlayer } from '@/composables/deviceChecker'

// 将WebSocket相关功能内联到videoProcessor.js中
/**
 * 初始化WebSocket连接
 * @param {string} type - 连接类型 ('audio' 或 'video')
 * @param {Function} callback - 连接建立后的回调函数
 * @returns {WebSocket} WebSocket实例
 */
const initializeWebSocket = (type, callback) => {
    try {
        const wsUrl = '/websocket' // 使用 vue.config.js 中配置的代理地址
        const socket = new WebSocket(wsUrl)

        socket.onopen = () => {
            console.log(`${type} WebSocket 连接已建立`)
            // 发送初始类型消息（0表示音频，1表示视频）
            const typeMessage = new Uint8Array([type === 'audio' ? 0 : 1])
            socket.send(typeMessage)
            if (callback) callback(socket)
        }

        socket.onerror = (error) => {
            console.error(`${type} WebSocket 错误:`, error)
        }

        socket.onclose = (event) => {
            console.log(`${type} WebSocket 连接已关闭`, event)
        }

        return socket
    } catch (error) {
        console.error(`创建${type} WebSocket失败:`, error)
        return null
    }
}

export const useVideoProcessor = () => {
    const mediaRecorder = ref(null)
    const socketRef = ref(null)
    const videoPlayerRef = ref(null)
    const videoErrorMessage = ref('')
    const startVideoBtn = ref(null)
    const stopVideoBtn = ref(null)

    // 视频开始方法
    const startVideoRecording = () => {
        try {
            socketRef.value = initializeWebSocket('video', async (ws) => {
                const supported = await checkVideoSupport()
                if (supported) {
                    const stream = await getStream()
                    if (stream) {
                        ws.send(new Uint8Array([1]))
                    }
                } else {
                    ws.send(new Uint8Array([1]))
                }
            })
        } catch (error) {
            console.error('启动录像失败:', error)
            videoErrorMessage.value = '无法启动录像设备，请检查浏览器权限设置'
        }
    }

    const stopVideoRecording = () => {
        if (socketRef.value) socketRef.value.close()
        if (mediaRecorder.value) mediaRecorder.value.stop()
        if (startVideoBtn.value) startVideoBtn.value.disabled = false
        if (stopVideoBtn.value) stopVideoBtn.value.disabled = true
    }

    const getStream = async () => {
        try {
            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getUserMedia
            ) {
                throw new Error('当前浏览器不支持 getUserMedia')
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
            })
            mediaRecorder.value = new MediaRecorder(stream)

            mediaRecorder.value.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    // 处理数据
                }
            }

            return stream
        } catch (error) {
            console.error('获取视频流失败:', error)
            videoErrorMessage.value = '无法访问摄像头，请检查设备权限设置'
            return null
        }
    }

    const checkVideoSupport = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
            })
            stream.getTracks().forEach((track) => track.stop())
            return true
        } catch (error) {
            return false
        }
    }

    const stopVideoPlayback = () => {
        if (videoPlayer.value && videoPlayer.value.srcObject) {
            const tracks = videoPlayer.value.srcObject.getTracks()
            tracks.forEach((track) => track.stop())
            videoPlayer.value.srcObject = null
        }
    }

    return {
        mediaRecorder,
        socketRef,
        videoPlayerRef,
        videoErrorMessage,
        startVideoBtn,
        stopVideoBtn,
        startVideoRecording,
        stopVideoRecording,
        getStream,
        checkVideoSupport,
        stopVideoPlayback,
    }
}
