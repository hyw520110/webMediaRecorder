<template>
    <div id="audio-recorder">
        <h2>音频录音机</h2>
        <div class="recorder-container">
            <div class="audio-recorder">
                <audio ref="audioPlayer" controls></audio>
                <button
                    ref="startAudioBtn"
                    :disabled="isRecordingActive"
                    @click="startRecording"
                >
                    开始录音
                </button>
                <button
                    ref="stopAudioBtn"
                    :disabled="!isRecordingActive"
                    @click="stopRecording"
                >
                    停止录音
                </button>
            </div>
        </div>
        <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
        </div>
        <div class="recordings-list">
            <h3>录音文件列表</h3>
            <div class="actions" style="text-align: right; margin-bottom: 10px">
                <button
                    :disabled="selectedIds.length === 0"
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
                            <button @click="playRecording(recording.id)">
                                播放
                            </button>
                            <button @click="deleteRecording(recording.id)">
                                删除
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div class="pagination">
                <button :disabled="page === 1" @click="prevPage">上一页</button>
                <span>第 {{ page }} 页</span>
                <button :disabled="page === totalPages" @click="nextPage">
                    下一页
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
    import { ref, computed, onMounted } from 'vue'
    import axios from 'axios'
    import { useAudioRecorder } from '@/composables/audioRecorder'

    const audioPlayer = ref(null)
    const { isRecording, errorMessage, startRecording, stopRecording } =
        useAudioRecorder(audioPlayer)

    // 定义 isRecordingActive 计算属性
    const isRecordingActive = computed(() => isRecording.value)

    // 录音文件列表相关逻辑
    const recordings = ref([])
    const page = ref(1)
    const limit = ref(10)
    const selectedIds = ref([])
    const selectAll = ref(false)

    const fetchRecordings = async () => {
        const response = await axios.get('/api/audio-recordings', {
            params: { page: page.value, limit: limit.value },
        })
        recordings.value = response.data
    }

    const playRecording = async (id) => {
        const response = await axios.get(`/api/audio-recordings/${id}/play`, {
            responseType: 'arraybuffer',
        })
        const audio = new Audio(URL.createObjectURL(new Blob([response.data])))
        audio.play()
    }

    const pagedRecordings = computed(() => recordings.value)
    const totalPages = computed(() =>
        Math.ceil(recordings.value.length / limit.value),
    )

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

    const deleteSelected = async () => {
        await axios.delete('/api/audio-recordings', {
            data: selectedIds.value,
        })
        selectedIds.value = []
        fetchRecordings()
    }

    const deleteRecording = async (id) => {
        await axios.delete('/api/audio-recordings', {
            data: [id],
        })
        fetchRecordings()
    }

    const formatFileSize = (size) => {
        if (size < 1024) return `${size} B`
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
        return `${(size / (1024 * 1024)).toFixed(2)} MB`
    }

    const formatDate = (date) => {
        return new Date(date).toLocaleString()
    }

    const formatDuration = (duration) => {
        const minutes = Math.floor(duration / 60)
        const seconds = duration % 60
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    onMounted(() => {
        fetchRecordings()
    })
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
</style>
