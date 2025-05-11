import { ref, onMounted } from 'vue';
import { useAudioProcessor } from './composables/audioProcessor';

export default {
    setup() {
        // 使用音频处理器
        const {
            isUsingWorklet,
            playerNode,
            errorMessage,
            startAudioBtn,
            stopAudioBtn,
            wavHeader,
            initAudioContext,
        } = useAudioProcessor();

        // 响应式状态
        const mediaRecorder = ref(null);
        const socket = ref(null);
        const playbackQueue = ref([]);
        const audioContext = ref(null);

        // 开始录音逻辑
        const startRecording = async () => {
            try {
                // 禁用开始按钮，启用停止按钮
                startAudioBtn.value.disabled = true;
                stopAudioBtn.value.disabled = false;

                // 初始化音频上下文
                await initAudioContext();

                // 建立 WebSocket 连接
                socket.value = new WebSocket('wss://your-websocket-url');

                socket.value.onopen = async () => {
                    console.log('WebSocket connection established');

                    // 发送音频类型标识（假设 1 表示音频）
                    socket.value.send(new Uint8Array([1]));

                    // 检查浏览器是否支持录音
                    let stream;
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                        // 浏览器支持录音：发送音频流
                        mediaRecorder.value = new MediaRecorder(stream);

                        mediaRecorder.value.ondataavailable = (event) => {
                            if (event.data.size > 0 && socket.value.readyState === WebSocket.OPEN) {
                                socket.value.send(event.data);
                            }
                        };

                        mediaRecorder.value.start(1000);

                    } catch (error) {
                        console.warn('浏览器不支持录音，等待后端音频数据...');

                        // 不支持录音：监听后端音频数据并播放
                        socket.value.onmessage = (event) => {
                            if (event.data instanceof ArrayBuffer) {
                                if (!wavHeader.value) {
                                    wavHeader.value = event.data;
                                    console.log('WAV头已接收');
                                } else {
                                    if (isUsingWorklet.value && playerNode.value?.port) {
                                        // 使用 AudioWorklet 播放
                                        playerNode.value.port.postMessage({ pcm: event.data }, [event.data]);
                                    } else {
                                        // 回退方案：推入播放队列
                                        const arrayBuffer = new Int16Array(event.data);
                                        playbackQueue.value.push(arrayBuffer);
                                    }
                                }
                            }
                        };
                    }
                };

                socket.value.onerror = (err) => {
                    console.error('WebSocket 错误:', err);
                    errorMessage.value = 'WebSocket 连接异常';
                    resetButtons();
                };

                socket.value.onclose = () => {
                    console.log('WebSocket 已关闭');
                    resetButtons();
                };

            } catch (error) {
                console.error('启动录音失败:', error);
                errorMessage.value = '无法启动录音，请检查权限设置';
                resetButtons();
            }
        };

        // 停止录音逻辑
        const stopRecording = () => {
            if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
                mediaRecorder.value.stop();
            }
            if (socket.value && socket.value.readyState === WebSocket.OPEN) {
                socket.value.close();
            }
        };

        // 重置按钮状态
        const resetButtons = () => {
            startAudioBtn.value.disabled = false;
            stopAudioBtn.value.disabled = true;
        };

        onMounted(() => {
            // 可选初始化逻辑
        });

        return {
            // 响应式状态
            mediaRecorder,
            socket,
            playbackQueue,
            audioContext,
            isUsingWorklet,
            playerNode,
            errorMessage,
            wavHeader,

            // 方法
            startAudioBtn: startRecording,
            stopAudioBtn: stopRecording,
        };
    },
};