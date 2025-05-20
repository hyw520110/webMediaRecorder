// deviceChecker.js
import { ref } from 'vue'

export const checkAudioSupport = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        })
        stream.getTracks().forEach((track) => track.stop())
        return true
    } catch (error) {
        return false
    }
}

export const checkVideoSupport = async () => {
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

export const checkMediaSupport = async () => {
    const audioSupported = await checkAudioSupport()
    const videoSupported = await checkVideoSupport()
    return { audioSupported, videoSupported }
}

export const errorMessage = ref('')
export const videoPlayer = ref(null)
