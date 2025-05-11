// audioRecorder.js
import { ref, computed } from 'vue'
import { useAudioProcessor } from './audioProcessor'
import { checkAudioSupport } from './deviceChecker'

/**
 * 初始化WebSocket连接
 * @param {string} type - 连接类型 ('audio' 或 'video')
 * @param {Object} callbacks - 回调函数对象
 * @param {ref} isRecordingRef - 录音状态的ref
 * @returns {Object} 包含socket实例和连接Promise的对象
 */
export const initializeWebSocket = (type, callbacks, isRecordingRef) => {
    let socket
    try {
        const wsUrl =
            process.env.VUE_APP_WEBSOCKET_URL || 'ws://localhost:8080/websocket'
        socket = new WebSocket(wsUrl)
        socket.binaryType = 'arraybuffer'
    } catch (error) {
        console.error('WebSocket实例创建失败:', error)
        return Promise.reject(new Error('WebSocket实例创建失败'))
    }

    // 初始化WebSocket连接
    const connectPromise = new Promise((resolve, reject) => {
        const handleOpen = async () => {
            try {
                resolve(socket)
                socket.removeEventListener('error', tempErrorListener)
            } catch (e) {
                reject(e)
            }
        }

        // 设置超时时间防止永久挂起
        const connectionTimeout = setTimeout(() => {
            reject(new Error('WebSocket连接超时'))
            if (socket && socket.readyState === WebSocket.OPEN) {
                try {
                    socket.close()
                    console.log('WebSocket连接已关闭')
                } catch (error) {
                    console.error('关闭WebSocket连接时发生错误:', error)
                }
            }
        }, 10000)

        const tempErrorListener = (error) => {
            console.error('WebSocket初始化期间发生错误:', error)
            reject(new Error('网络或服务异常'))
            clearTimeout(connectionTimeout)
            if (socket && socket.readyState === WebSocket.OPEN) {
                try {
                    socket.close()
                    console.log('WebSocket连接已关闭')
                } catch (error) {
                    console.error('关闭WebSocket连接时发生错误:', error)
                }
            } else {
                console.warn(
                    'WebSocket连接不可用或已关闭，状态码:',
                    socket?.readyState,
                )
            }
        }

        // 添加一次性事件监听器
        socket.addEventListener('open', handleOpen)
        socket.addEventListener('error', tempErrorListener)

        // 清理函数
        return () => {
            clearTimeout(connectionTimeout)
            socket.removeEventListener('open', handleOpen)
            socket.removeEventListener('error', tempErrorListener)
        }
    })

    // 消息处理
    const handleMessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
            // 处理二进制数据
            // 直接使用传入的回调
            if (callbacks && callbacks.onMessage) {
                callbacks.onMessage(event)
            }
        }
    }

    // 错误处理
    const handleError = (error) => {
        if (callbacks && callbacks.onError) {
            callbacks.onError(error)
        }
    }

    // 连接关闭处理
    const handleClose = (event) => {
        // 如果连接意外关闭且处于录音状态，尝试重新连接
        if (isRecordingRef && isRecordingRef.value && event.code !== 1000) {
            setTimeout(() => {
                // 重新初始化WebSocket连接
                const newConnection = initializeWebSocket(
                    type,
                    callbacks,
                    isRecordingRef,
                )
                // 更新socket引用
                socket = newConnection.socket
            }, 5000) // 5秒后重试
        }

        // 如果连接关闭，更新录音状态和按钮状态
        if (isRecordingRef) {
            isRecordingRef.value = false
        }
    }

    // 绑定事件监听器
    socket.addEventListener('message', handleMessage)
    socket.addEventListener('error', handleError)
    socket.addEventListener('close', handleClose)

    const cleanup = () => {
        socket.removeEventListener('message', handleMessage)
        socket.removeEventListener('error', handleError)
        socket.removeEventListener('close', handleClose)
        socket = null
    }

    return {
        socket,
        connectPromise,
        cleanup,
    }
}

export function useAudioRecorder() {
    const mediaRecorder = ref(null)
    const socketRef = ref(null)
    const audioContext = ref(null)
    const errorMessage = ref('')
    const isRecording = ref(false)
    const playbackQueue = ref([])
    const isUsingWorklet = ref(false)
    const playerNode = ref(null)
    let wsConnection = null

    const audioProcessor = useAudioProcessor({
        socket: socketRef,
        mediaRecorder,
        audioContext,
        playbackQueue,
        isUsingWorklet,
        playerNode,
        errorMessage,
    })

    // 处理WebSocket消息
    const handleSocketMessage = (event) => {
        try {
            if (event.data instanceof ArrayBuffer) {
                audioProcessor.processAudioData(event.data)
            }
        } catch (error) {
            console.error('消息处理失败:', error)
            errorMessage.value = '音频数据处理异常'
        }
    }

    // 处理错误
    const handleError = (error) => {
        errorMessage.value = error.message || '音频设备错误'
        stopRecording()
    }

    // 收到WebSocket消息回调
    const handleSocketMessageCallback = (event) => {
        handleSocketMessage(event)
    }

    // WebSocket错误回调
    const handleWebSocketError = (error) => {
        console.error('WebSocket错误回调')
        handleError(error)
    }

    // 开始录音
    async function startRecording() {
        try {
            console.log('开始录音请求，当前录音状态:', isRecording.value)
            if (isRecording.value) {
                console.warn('录音已经在进行中，跳过重复请求')
                return
            }

            isRecording.value = true
            errorMessage.value = ''

            const wsUrl =
                process.env.VUE_APP_WEBSOCKET_URL ||
                'ws://localhost:8080/audio-stream'
            console.log('创建WebSocket连接，类型: audio')
            // 创建WebSocket连接并等待连接建立
            wsConnection = initializeWebSocket(
                'audio',
                {
                    onMessage: handleSocketMessageCallback,
                    onError: handleWebSocketError,
                },
                isRecording,
                wsUrl,
            )

            console.log('等待WebSocket连接建立...')
            // 等待WebSocket连接建立完成
            const socketInstance = await wsConnection.connectPromise
            socketRef.value = socketInstance

            console.log('WebSocket连接已建立，准备检查本地音频支持')
            const hasLocalAudio = await checkAudioSupport()
            console.log('本地音频支持检测结果:', hasLocalAudio)

            if (hasLocalAudio) {
                console.log('开始本地录音')
                await audioProcessor.startLocalRecording()
                // 发送消息类型（0音频）和音频流
                const audioModeMessage = new Uint8Array([0])
                socketInstance.send(audioModeMessage.buffer)
            } else {
                // 仅发送消息类型
                socketInstance.send(new Uint8Array([0]).buffer)
                errorMessage.value = '当前设备不支持本地音频录制'
                console.warn('当前设备不支持本地音频录制')
            }
        } catch (error) {
            console.error('录音启动失败:', error)
            handleError(error)
            // 如果连接失败，清理WebSocket资源
            if (wsConnection && wsConnection.cleanup) {
                wsConnection.cleanup()
            }
        }
    }

    // 停止录音
    const stopRecording = () => {
        isRecording.value = false

        // 停止本地录音
        if (mediaRecorder.value) {
            mediaRecorder.value.stop()
            mediaRecorder.value.stream
                .getTracks()
                .forEach((track) => track.stop())
        }

        console.log('准备停止录音，wsConnection状态:', wsConnection)

        // 确保wsConnection和socket存在后再进行操作
        if (wsConnection && wsConnection.socket) {
            console.log(
                '当前WebSocket连接状态:',
                wsConnection.socket.readyState,
            )
            // 仅在连接处于OPEN状态时关闭
            if (wsConnection.socket.readyState === WebSocket.OPEN) {
                try {
                    wsConnection.socket.close()
                    console.log('WebSocket连接已关闭')
                } catch (error) {
                    console.error('关闭WebSocket连接时发生错误:', error)
                }
            } else {
                console.warn(
                    'WebSocket连接不可用或已关闭，状态码:',
                    wsConnection.socket.readyState,
                )
            }
            // 清理资源
            if (wsConnection.cleanup) {
                wsConnection.cleanup()
                console.log('资源清理完成')
            }
            // 将wsConnection置为null以释放资源
            wsConnection = null
        } else {
            console.warn('wsConnection或socket为null，无需执行关闭操作')
        }
        // 确保socketRef也被正确置为null
        if (socketRef.value) {
            socketRef.value = null
        }

        // 添加：禁用停止录音按钮，启用开始录音按钮
        isRecording.value = false
    }

    // 暴露给组件的API
    return {
        isRecording,
        errorMessage,
        startRecording,
        stopRecording,
        buttonStates: computed(() => ({
            startDisabled: isRecording.value,
            stopDisabled: !isRecording.value,
        })),
    }
}
