<template>
    <div id="video-recorder">
        <h2>视频录像机</h2>
        <div class="recorder-container">
            <div class="video-recorder">
                <video ref="videoPlayer" autoplay muted></video>
                <button ref="startVideoBtn" @click="startVideoRecording">
                    开始录像
                </button>
                <button ref="stopVideoBtn" disabled @click="stopVideoRecording">
                    停止录像
                </button>
            </div>
        </div>
        <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
        </div>
    </div>
</template>

<script>
    import { useVideoProcessor } from '@/composables/videoProcessor'

    export default {
        name: 'VideoRecorder',
        setup() {
            const {
                videoPlayer,
                errorMessage,
                startVideoBtn,
                stopVideoBtn,
                startVideoRecording,
                stopVideoRecording,
                checkVideoSupport,
            } = useVideoProcessor()

            return {
                // Refs
                videoPlayer,
                startVideoBtn,
                stopVideoBtn,

                // Methods
                startVideoRecording,
                stopVideoRecording,

                // Computed & Data
                errorMessage,
                checkVideoSupport,
            }
        },
    }
</script>

<style>
    .recorder-container {
        display: flex;
        justify-content: center;
        margin-top: 20px;
    }

    .video-recorder {
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
</style>
