<template>
    <div id="audio-recorder">
        <h2>音频录音机</h2>
        <div class="recorder-container">
            <div class="audio-recorder">
                <audio ref="audioPlayer" controls></audio>
                <div class="mode-selection">
                    <h3>录音模式</h3>
                    <div class="mode-options">
                        <label class="mode-option">
                            <input
                                v-model="recordingMode"
                                type="radio"
                                value="local"
                            />
                            <span>本地</span>
                        </label>
                        <label class="mode-option">
                            <input
                                v-model="recordingMode"
                                type="radio"
                                value="remote"
                            />
                            <span>远程</span>
                        </label>
                    </div>
                    <div
                        v-if="recordingMode === 'remote'"
                        class="remote-settings"
                    >
                        <label>远程地址:</label>
                        <input
                            v-model="remoteHost"
                            placeholder="请输入IP或域名"
                        />
                        <label>端口号:</label>
                        <input
                            v-model.number="remotePort"
                            type="number"
                            placeholder="端口号"
                        />
                        <div
                            class="connection-status"
                            :class="connectionStatus"
                        >
                            {{
                                connectionStatus === 'connected'
                                    ? '已连接'
                                connectionStatus === 'connecting' ? '连接中...' : '未连接' }}
                        </div>
                    </div>
                </div>
                <div class="recording-controls">
                    <button
                        ref="startAudioBtn"
                        :disabled="isRecordingActive || isLoading"
                        @click="startRecordingWithDuration"
                    >
                        开始录音
                    </button>
                    <button
                        ref="stopAudioBtn"
                        :disabled="!isRecordingActive || isLoading"
                        @click="stopRecordingWithDuration"
                    >
                        停止录音
                    </button>
                    <div v-if="isRecordingActive" class="recording-info">
                        <div class="recording-duration">
                            录音时长: {{ formatDuration(recordingDuration) }}
                        </div>
                        <div class="volume-meter">
                            <div
                                class="volume-bar"
                                :style="{ width: `${recordingVolume}%` }"
                            ></div>
                        </div>
                    </div>
                </div>
                <div v-if="recordingStatus" class="recording-status">
                    {{ recordingStatus }}
                </div>
            </div>
        </div>
        <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
        </div>
        <div v-if="isLoading" class="loading-overlay">
            <div class="loading-spinner"></div>
        </div>
        <div class="recordings-list">
            <h3>录音文件列表</h3>
            <div class="actions">
                <button
                    :disabled="selectedIds.length === 0 || isLoading"
                    @click="deleteSelected"
                >
                    删除选中
                </button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>
                            <input
                                v-model="selectAll"
                                type="checkbox"
                                @change="toggleSelectAll"
                            />
                        </th>
                        <th>文件名</th>
                        <th>文件大小</th>
                        <th>创建时间</th>
                        <th>时长</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="recording in pagedRecordings"
                        :key="recording.id"
                    >
                        <td>
                            <input
                                v-model="selectedIds"
                                type="checkbox"
                                :value="recording.id"
                            />
                        </td>
                        <td>{{ recording.fileName }}</td>
                        <td>{{ formatFileSize(recording.fileSize) }}</td>
                        <td>{{ formatDate(recording.createdAt) }}</td>
                        <td>{{ formatDuration(recording.duration) }}</td>
                        <td>
                            <button
                                :disabled="isLoading"
                                @click="playRecording(recording.id)"
                            >
                                播放
                            </button>
                            <button
                                :disabled="isLoading"
                                @click="deleteRecording(recording.id)"
                            >
                                删除
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div class="pagination">
                <button :disabled="page === 1 || isLoading" @click="prevPage">
                    上一页
                </button>
                <span>第 {{ page }} 页</span>
                <button
                    :disabled="page === totalPages || isLoading"
                    @click="nextPage"
                >
                    下一页
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
    import axios from 'axios'
    import { useAudioRecorder } from '@/composables/audioRecorder'

    const audioPlayer = ref(null)
    const { isRecording, errorMessage, startRecording, stopRecording } =
        useAudioRecorder(audioPlayer)

    // 状态管理
    const isLoading = ref(false)
    const recordingDuration = ref(0)
    const durationTimer = ref(null)
    const recordingStatus = ref('')
    const recordingVolume = ref(0)
    const volumeTimer = ref(null)

    // 录音模式相关配置
    const recordingMode = ref('local')
    const remoteHost = ref('')
    const remotePort = ref(null)
    const connectionStatus = ref('disconnected')

    // 从 localStorage 中读取远程地址和端口
    onMounted(() => {
        const savedHost = localStorage.getItem('remoteHost')
        const savedPort = localStorage.getItem('remotePort')

        remoteHost.value =
            savedHost || process.env.VUE_APP_API_BASE_URL || 'localhost'
        remotePort.value = savedPort
            ? parseInt(savedPort)
            : process.env.VUE_APP_API_PORT || 8080

        initVolumeDetection()
    })

    // 初始化音量检测
    const initVolumeDetection = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            })
            const audioContext = new AudioContext()
            const source = audioContext.createMediaStreamSource(stream)
            const analyser = audioContext.createAnalyser()
            analyser.fftSize = 256
            source.connect(analyser)

            const dataArray = new Uint8Array(analyser.frequencyBinCount)
            volumeTimer.value = setInterval(() => {
                if (isRecording.value) {
                    analyser.getByteFrequencyData(dataArray)
                    const average =
                        dataArray.reduce((a, b) => a + b) / dataArray.length
                    recordingVolume.value = Math.min(
                        100,
                        Math.round((average / 255) * 100),
                    )
                }
            }, 100)
        } catch (error) {
            console.error('初始化音量检测失败:', error)
        }
    }

    // 监听录音模式变化
    watch(recordingMode, async (newMode) => {
        if (isRecording.value) {
            await stopRecordingWithDuration()
        }
        if (newMode === 'remote') {
            localStorage.setItem('remoteHost', remoteHost.value)
            localStorage.setItem('remotePort', remotePort.value)
            await checkConnection()
        }
    })

    // 检查远程连接
    const checkConnection = async () => {
        try {
            connectionStatus.value = 'connecting'
            await apiClient.value.get('/health')
            connectionStatus.value = 'connected'
            recordingStatus.value = '远程服务器连接成功'
        } catch (error) {
            connectionStatus.value = 'disconnected'
            recordingStatus.value = '远程服务器连接失败'
            handleError(error)
        }
    }

    // 构建远程API基础URL
    const getRemoteApiUrl = computed(() => {
        if (
            recordingMode.value === 'remote' &&
            remoteHost.value &&
            remotePort.value
        ) {
            return `http://${remoteHost.value}:${remotePort.value}/api`
        }
        return '/api'
    })

    // 创建 axios 实例
    const apiClient = computed(() => {
        const baseURL = getRemoteApiUrl.value
        return axios.create({
            baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    })

    // 统一的错误处理
    const handleError = (error) => {
        console.error('操作失败:', error)
        const errorMsg =
            error.response?.data?.message || error.message || '操作失败'
        errorMessage.value = errorMsg
        recordingStatus.value = `错误: ${errorMsg}`
    }

    // 录音文件列表相关逻辑
    const recordings = ref([])
    const page = ref(1)
    const limit = ref(10)
    const selectedIds = ref([])
    const selectAll = ref(false)

    const pagedRecordings = computed(() => recordings.value)
    const totalPages = computed(() =>
        Math.ceil(recordings.value.length / limit.value),
    )

    // 获取录音文件列表
    const fetchRecordings = async () => {
        try {
            isLoading.value = true
            const response = await apiClient.value.get('/audio-recordings', {
                params: { page: page.value, limit: limit.value },
            })
            recordings.value = response.data
        } catch (error) {
            handleError(error)
        } finally {
            isLoading.value = false
        }
    }

    // 开始录音
    const startRecordingWithDuration = async () => {
        try {
            if (
                recordingMode.value === 'remote' &&
                connectionStatus.value !== 'connected'
            ) {
                await checkConnection()
                if (connectionStatus.value !== 'connected') {
                    throw new Error('远程服务器未连接')
                }
            }

            await startRecording()
            recordingDuration.value = 0
            recordingStatus.value = '正在录音...'
            durationTimer.value = setInterval(() => {
                recordingDuration.value++
            }, 1000)
        } catch (error) {
            handleError(error)
        }
    }

    // 停止录音
    const stopRecordingWithDuration = async () => {
        try {
            await stopRecording()
            if (durationTimer.value) {
                clearInterval(durationTimer.value)
                durationTimer.value = null
            }
            recordingStatus.value = '录音已保存'
            recordingDuration.value = 0
            await fetchRecordings()
        } catch (error) {
            handleError(error)
        }
    }

    // 删除选中的录音
    const deleteSelected = async () => {
        try {
            isLoading.value = true
            await apiClient.value.delete('/audio-recordings', {
                data: selectedIds.value,
            })
            selectedIds.value = []
            await fetchRecordings()
        } catch (error) {
            handleError(error)
        } finally {
            isLoading.value = false
        }
    }

    // 删除单个录音
    const deleteRecording = async (id) => {
        try {
            isLoading.value = true
            await apiClient.value.delete('/audio-recordings', {
                data: [id],
            })
            await fetchRecordings()
        } catch (error) {
            handleError(error)
        } finally {
            isLoading.value = false
        }
    }

    // 播放录音
    const playRecording = async (id) => {
        try {
            isLoading.value = true
            const response = await apiClient.value.get(
                `/audio-recordings/${id}/play`,
                {
                    responseType: 'arraybuffer',
                },
            )
            const audio = new Audio(
                URL.createObjectURL(new Blob([response.data])),
            )
            audio.play()
        } catch (error) {
            handleError(error)
        } finally {
            isLoading.value = false
        }
    }

    // 格式化录音时长
    const formatDuration = (seconds) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    // 组件卸载时清理
    onUnmounted(() => {
        if (durationTimer.value) {
            clearInterval(durationTimer.value)
        }
        if (volumeTimer.value) {
            clearInterval(volumeTimer.value)
        }
        if (isRecording.value) {
            stopRecording()
        }
    })

    // 初始加载
    onMounted(() => {
        fetchRecordings()
    })

    // 定义 isRecordingActive 计算属性
    const isRecordingActive = computed(() => isRecording.value)

    // 录音文件列表相关逻辑
    const prevPage = () => {
        if (page.value > 1) {
            page.value--
            fetchRecordings()
        }
    }

    const nextPage = () => {
        if (page.value < totalPages.value) {
            page.value++
            fetchRecordings()
        }
    }

    const toggleSelectAll = () => {
        selectedIds.value = selectAll.value
            ? recordings.value.map((r) => r.id)
            : []
    }

    const formatFileSize = (size) => {
        if (size < 1024) return `${size} B`
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
        return `${(size / (1024 * 1024)).toFixed(2)} MB`
    }

    const formatDate = (date) => {
        return new Date(date).toLocaleString()
    }
</script>

<style>
    .recorder-container {
        display: flex;
        justify-content: center;
        margin-top: 20px;
    }

    .audio-recorder {
        border: 1px solid #ccc;
        padding: 20px;
        border-radius: 8px;
        width: 60%;
        background-color: #f9f9f9;
    }

    button {
        margin: 10px;
        padding: 10px 20px;
        font-size: 16px;
        cursor: pointer;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
    }

    button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }

    .error-message {
        margin-top: 20px;
        padding: 10px;
        background-color: #ffebee;
        color: #c62828;
        border-radius: 4px;
        text-align: center;
    }

    .recordings-list {
        margin: 20px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
    }

    th,
    td {
        padding: 10px;
        border: 1px solid #ccc;
        text-align: left;
    }

    .pagination,
    .actions {
        margin-top: 20px;
    }

    button {
        margin: 0 5px;
        padding: 5px 10px;
        cursor: pointer;
    }

    .recording-controls {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin: 1rem 0;
    }

    .recording-duration {
        font-size: 1.2rem;
        font-weight: bold;
        color: #007bff;
    }

    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    .recording-info {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-left: 1rem;
    }

    .volume-meter {
        width: 100px;
        height: 10px;
        background-color: #eee;
        border-radius: 5px;
        overflow: hidden;
    }

    .volume-bar {
        height: 100%;
        background-color: #4caf50;
        transition: width 0.1s ease;
    }

    .recording-status {
        margin-top: 1rem;
        padding: 0.5rem;
        border-radius: 4px;
        text-align: center;
        font-weight: bold;
    }

    .connection-status {
        margin-top: 0.5rem;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        text-align: center;
    }

    .connection-status.connected {
        background-color: #e8f5e9;
        color: #2e7d32;
    }

    .connection-status.connecting {
        background-color: #fff3e0;
        color: #ef6c00;
    }

    .connection-status.disconnected {
        background-color: #ffebee;
        color: #c62828;
    }

    .remote-settings {
        margin-top: 1rem;
        padding: 1rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: #f5f5f5;
    }

    .remote-settings input {
        margin: 0.5rem 0;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        width: 100%;
    }

    .remote-settings label {
        display: block;
        margin-top: 0.5rem;
        font-weight: bold;
    }
</style>
