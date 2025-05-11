// audioProcessor.js
import { ref } from 'vue'
export function useAudioProcessor({
    mediaRecorder,
    audioContext,
    isUsingWorklet,
    playerNode,
    errorMessage,
    socketRef,
}) {
    const playBuffer = ref([])
    const isPlaying = ref(false)
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

    async function setupAudioWorklet(context) {
        try {
            const support = checkBrowserSupport(context)
            if (!support.hasWorklet) {
                throw new Error('浏览器不支持AudioWorklet API')
            }
            if (support.isWebKit) {
                console.log('使用 WebKit 实现')
            }
            const workletPath = `${window.location.origin}/audio-processor.js`
            const worklet = context.audioWorklet || context.webkitAudioWorklet
            await worklet.addModule(workletPath)
            const processorName = 'audio-player-processor'
            const workletNode = new AudioWorkletNode(context, processorName, {
                outputChannelCount: [2],
            })
            workletNode.port.onmessage = (event) => {
                console.log('Worklet消息:', event.data)
            }

            workletNode.connect(context.destination)
            playerNode.value = workletNode
            isUsingWorklet.value = true
            console.log('AudioWorklet初始化成功')
            return true
        } catch (error) {
            console.warn('AudioWorklet初始化失败:', error)
            return setupScriptProcessor(context)
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

    // 增强的上下文初始化
    async function initAudioContext() {
        if (!audioContext.value) {
            try {
                // 自动处理浏览器前缀
                const ContextClass =
                    window.AudioContext || window.webkitAudioContext
                if (!ContextClass) {
                    throw new Error('浏览器不支持Web Audio API')
                }

                // 创建带配置的音频上下文
                audioContext.value = new ContextClass({
                    latencyHint: 'interactive',
                    sampleRate: 48000,
                })

                // 处理Safari的自动挂起问题
                if (audioContext.value.state === 'suspended') {
                    await audioContext.value.resume()
                }

                // 分层初始化策略
                const result = await setupAudioWorklet(audioContext.value)

                if (!result) {
                    throw new Error('无法初始化音频处理器')
                }

                console.log('音频上下文初始化成功', {
                    worklet: isUsingWorklet.value,
                    sampleRate: audioContext.value.sampleRate,
                })
            } catch (error) {
                console.error('音频初始化失败:', error)
                errorMessage.value = `音频初始化失败: ${error.message}`
                throw error
            }
        }
        return audioContext.value
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
    const startPlayback = () => {
        if (
            !isPlaying.value &&
            playBuffer.value.length >= BUFFER_THRESHOLD * 4096 * 2
        ) {
            isPlaying.value = true
            console.log('开始音频播放')
        }
    }

    return {
        initAudioContext,
        processAudioData,
        startLocalRecording: async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                })
                mediaRecorder.value = new MediaRecorder(stream)
                mediaRecorder.value.start(100) // 100ms数据切片

                mediaRecorder.value.ondataavailable = (e) => {
                    if (
                        e.data.size > 0 &&
                        typeof socketRef !== 'undefined' &&
                        socketRef.value?.readyState === WebSocket.OPEN
                    ) {
                        socketRef.value.send(e.data)
                    }
                }

                console.log('本地录音已启动')
            } catch (error) {
                console.error('麦克风访问失败:', error)
                errorMessage.value = `麦克风访问失败: ${error.message}`
                throw error
            }
        },
        stopRecording: () => {
            if (mediaRecorder.value) {
                mediaRecorder.value.stop()
                mediaRecorder.value.stream
                    .getTracks()
                    .forEach((track) => track.stop())
            }
            if (audioContext.value) {
                audioContext.value.close()
            }
            playBuffer.value = []
            isPlaying.value = false
            console.log('录音已停止')
        },
    }
}
