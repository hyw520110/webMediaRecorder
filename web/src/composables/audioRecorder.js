// audioRecorder.js
import { ref, computed, onMounted, watchEffect } from 'vue'
import { checkAudioSupport } from './deviceChecker'

// 新增：定义 recordingMode, remoteHost, remotePort
const recordingMode = ref('local')
const remoteHost = ref('localhost')
const remotePort = ref(8080)

// 使用 localStorage 缓存上次设置
onMounted(() => {
    const savedMode = localStorage.getItem('recordingMode')
    const savedHost = localStorage.getItem('remoteHost')
    const savedPort = localStorage.getItem('remotePort')

    if (savedMode) recordingMode.value = savedMode
    if (savedHost)
        remoteHost.value =
            savedHost || process.env.VUE_APP_API_BASE_URL || 'localhost'
    if (savedPort)
        remotePort.value = savedPort
            ? parseInt(savedPort)
            : process.env.VUE_APP_API_PORT || 8080
})

watchEffect(() => {
    localStorage.setItem('recordingMode', recordingMode.value)
    localStorage.setItem('remoteHost', remoteHost.value)
    localStorage.setItem('remotePort', remotePort.value.toString())
})

// 修改：将 recordingMode、remoteHost、remotePort 作为参数传入
export const initializeWebSocket = (
    type,
    callbacks,
    isRecordingRef,
    recordingMode,
    remoteHost,
    remotePort,
) => {
    let socket
    try {
        let wsUrl
        if (
            recordingMode &&
            recordingMode.value === 'remote' &&
            remoteHost &&
            remoteHost.value &&
            remotePort &&
            remotePort.value
        ) {
            wsUrl = `ws://${remoteHost.value}:${remotePort.value}/websocket`
        } else {
            wsUrl =
                process.env.VUE_APP_WEBSOCKET_URL ||
                'ws://localhost:8080/websocket'
        }

        socket = new WebSocket(wsUrl)
        socket.binaryType = 'arraybuffer'
    } catch (error) {
        console.error('WebSocket实例创建失败:', error)
        return Promise.reject(new Error('WebSocket实例创建失败'))
    }

    // 创建一个Promise来等待连接建立
    const connectPromise = new Promise((resolve, reject) => {
        const handleOpen = async () => {
            try {
                console.log('WebSocket 连接已建立')
                // 发送初始类型消息（0表示音频，1表示视频）
                const typeMessage = new Uint8Array([type === 'audio' ? 0 : 1])

                if (socket.readyState === WebSocket.OPEN) {
                    console.log('WebSocket 连接状态正常，准备发送消息')
                    socket.send(typeMessage)
                    resolve(socket) // 连接建立并发送初始消息后解析Promise
                } else {
                    reject(
                        new Error(
                            'WebSocket连接状态非OPEN: ' + socket.readyState,
                        ),
                    )
                }
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
            console.log(
                `${type}收到二进制数据，大小:`,
                event.data.byteLength,
                '字节',
            )
            // 直接使用传入的回调
            if (callbacks && callbacks.onMessage) {
                callbacks.onMessage(event)
            }
        }
    }

    // 错误处理
    const handleError = (error) => {
        console.error(`${type} WebSocket 错误:`, error)
        // 调用错误回调
        if (callbacks && callbacks.onError) {
            callbacks.onError(error)
        }
    }

    // 连接关闭处理
    const handleClose = (event) => {
        console.log(`${type} WebSocket 连接已关闭`, {
            wasClean: event.wasClean,
            code: event.code,
            reason: event.reason,
            targetReadyState: socket.readyState,
        })

        // 如果连接意外关闭且处于录音状态，尝试重新连接
        if (isRecordingRef && isRecordingRef.value && event.code !== 1000) {
            console.warn('WebSocket连接意外关闭，尝试重新连接...')
            setTimeout(() => {
                // 重新初始化WebSocket连接
                const newConnection = initializeWebSocket(
                    type,
                    callbacks,
                    isRecordingRef,
                    recordingMode,
                    remoteHost,
                    remotePort,
                )
                // 更新socket引用
                socket = newConnection.socket
                // 重新绑定事件监听器
                socket.addEventListener('message', handleMessage)
                socket.addEventListener('error', handleError)
                socket.addEventListener('close', handleClose)
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

    // 返回连接Promise和socket实例
    return {
        socket,
        connectPromise,
    }
}

export function useAudioRecorder() {
    const mediaRecorder = ref(null)
    const socketRef = ref(null)
    // eslint-disable-next-line no-unused-vars
    const audioContext = ref(null)
    const errorMessage = ref('')
    const isRecording = ref(false)
    // eslint-disable-next-line no-unused-vars
    const playbackQueue = ref([])
    const isUsingWorklet = ref(false)
    const playerNode = ref(null)
    let wsConnection = null

    // 音频处理器逻辑
    const playBuffer = ref([])
    const BUFFER_THRESHOLD = 3

    const checkBrowserSupport = (context) => {
        // 检测 WebKit 内核的 AudioWorklet 支持
        const hasWebKitWorklet = !!(
            context.webkitAudioWorklet && window.webkitAudioWorkletNode
        )

        // 检测标准 AudioWorklet 支持
        const hasStandardWorklet = !!(
            context.audioWorklet && window.AudioWorkletNode
        )

        // 判断是否为 WebKit 内核浏览器
        const isWebKit =
            'webkitAudioContext' in window || !!window.webkitAudioWorklet

        return {
            hasWorklet: hasStandardWorklet || hasWebKitWorklet,
            isWebKit,
        }
    }

    // ScriptProcessor回退方案
    function setupScriptProcessor(context) {
        try {
            const bufferSize = 4096
            const processor = context.createScriptProcessor(bufferSize, 0, 2)
            // 双通道缓冲处理
            processor.onaudioprocess = (e) => {
                const left = e.outputBuffer.getChannelData(0)
                const right = e.outputBuffer.getChannelData(1)

                // 从缓冲队列获取数据
                if (playBuffer.value.length >= bufferSize * 2) {
                    left.set(playBuffer.value.splice(0, bufferSize))
                    right.set(playBuffer.value.splice(0, bufferSize))
                } else {
                    left.fill(0)
                    right.fill(0)
                }
            }

            processor.connect(context.destination)
            playerNode.value = processor
            isUsingWorklet.value = false
            console.log('ScriptProcessor回退方案已启用')
            return true
        } catch (error) {
            console.error('ScriptProcessor初始化失败:', error)
            errorMessage.value = '浏览器不支持任何音频处理方案'
            return false
        }
    }

    // 改进的音频处理逻辑
    const processAudioData = (arrayBuffer) => {
        try {
            if (!arrayBuffer || arrayBuffer.byteLength === 0) return

            // 转换音频数据
            const data = convertToFloat32(arrayBuffer)

            if (isUsingWorklet.value) {
                // Worklet直接传输
                playerNode.value.port.postMessage(
                    { type: 'audio', buffer: data },
                    [data.buffer],
                )
            } else {
                // ScriptProcessor缓冲处理
                playBuffer.value.push(...new Float32Array(data.buffer))
                maintainBuffer()
                startPlayback()
            }
        } catch (error) {
            console.error('音频处理失败:', error)
        }
    }

    // 数据类型转换
    const convertToFloat32 = (arrayBuffer) => {
        try {
            const int16 = new Int16Array(arrayBuffer)
            const float32 = new Float32Array(int16.length)
            for (let i = 0; i < int16.length; i++) {
                float32[i] = Math.max(-1, Math.min(1, int16[i] / 32768))
            }
            return float32
        } catch (error) {
            console.error('音频格式转换失败:', error)
            return new Float32Array(0)
        }
    }

    // 缓冲管理
    const maintainBuffer = () => {
        const MAX_BUFFER_SIZE = 10 * 4096 * 2 // 10包数据
        if (playBuffer.value.length > MAX_BUFFER_SIZE) {
            console.warn(
                `缓冲区溢出，清除数据 (当前:${playBuffer.value.length})`,
            )
            playBuffer.value = []
        }
    }

    // 播放控制
    const isPlaying = ref(false)
    const startPlayback = () => {
        if (
            !isPlaying.value &&
            playBuffer.value.length >= BUFFER_THRESHOLD * 4096 * 2
        ) {
            isPlaying.value = true
            console.log('开始音频播放')
        }
    }

    // 处理WebSocket消息
    const handleSocketMessage = (event) => {
        try {
            if (event.data instanceof ArrayBuffer) {
                // 处理二进制数据
                console.log(
                    '收到二进制数据，大小:',
                    event.data.byteLength,
                    '字节',
                )
                // 直接使用传入的回调
                processAudioData(event.data)
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

            console.log('创建WebSocket连接，类型: audio')
            // 创建WebSocket连接并等待连接建立
            wsConnection = initializeWebSocket(
                'audio',
                {
                    onMessage: handleSocketMessageCallback,
                    onError: handleWebSocketError,
                },
                isRecording,
            )

            console.log('等待WebSocket连接建立...')
            // 等待WebSocket连接建立完成
            const socketInstance = await wsConnection.connectPromise
            socketRef.value = socketInstance

            console.log('WebSocket连接已建立，准备检查本地音频支持')
            const hasLocalAudio = await checkAudioSupport()
            console.log('本地音频支持检测结果:', hasLocalAudio)

            if (recordingMode.value === 'local' && !hasLocalAudio) {
                // 如果选择本地录音模式但设备不支持，自动切换到远程模式
                recordingMode.value = 'remote'
                console.warn('设备不支持本地录音，已自动切换到远程模式')
            }

            if (recordingMode.value === 'remote') {
                // 远程录音模式，仅发送消息类型
                const messageType = new Uint8Array([0])
                socketInstance.send(messageType.buffer)
                console.log('远程录音模式，仅发送消息类型')
            } else if (hasLocalAudio) {
                console.log('开始本地录音')
                // 直接获取媒体流，而不是通过 initAudioContext()
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                })

                // 创建消息类型和音频流的复合包
                const messageType = new Uint8Array([0]) // 0表示音频
                mediaRecorder.value = new MediaRecorder(stream)
                mediaRecorder.value.ondataavailable = async (event) => {
                    if (event.data.size > 0) {
                        // 检查 WebSocket 连接状态
                        if (
                            socketInstance &&
                            socketInstance.readyState === WebSocket.OPEN
                        ) {
                            const audioData = new Uint8Array(
                                await event.data.arrayBuffer(),
                            )
                            const combinedBuffer = new Uint8Array(
                                1 + audioData.length,
                            )
                            combinedBuffer.set(messageType, 0)
                            combinedBuffer.set(audioData, 1)
                            socketInstance.send(combinedBuffer.buffer)
                        } else {
                            console.warn(
                                'WebSocket连接已关闭，无法发送音频数据',
                            )
                        }
                    }
                }
                mediaRecorder.value.start(100) // 100ms数据切片
            } else {
                // 仅发送消息类型
                const messageType = new Uint8Array([0])
                socketInstance.send(messageType.buffer)
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
