// audio-processor.js
if (!globalThis.AudioWorkletProcessor) {
    globalThis.AudioWorkletProcessor = class {
        constructor() {
            this.port = {
                postMessage: () => {},
                onmessage: null,
            }
        }
    }
}
class AudioPlayerProcessor extends AudioWorkletProcessor {
    constructor() {
        super()
        this.queue = []
    }

    process(inputs, outputs) {
        const output = outputs[0]

        for (let channel = 0; channel < output.numberOfChannels; channel++) {
            const outputData = output.getChannelData(channel)
            outputData.fill(0) // 清空输出
        }

        if (this.queue.length === 0) return true

        const pcmBuffer = this.queue[0]
        const pcmView = new Int16Array(
            pcmBuffer.buffer,
            pcmBuffer.byteOffset,
            pcmBuffer.byteLength / 2,
        )
        const samplesNeeded = output[0].length

        if (pcmView.length >= samplesNeeded) {
            for (let i = 0; i < samplesNeeded; i++) {
                for (
                    let channel = 0;
                    channel < output.numberOfChannels;
                    channel++
                ) {
                    output.getChannelData(channel)[i] = pcmView[i] / 32768.0
                }
            }
            this.queue[0] = new Uint8Array(
                pcmBuffer.buffer.slice(samplesNeeded * 2),
            )
        } else {
            for (let i = 0; i < pcmView.length; i++) {
                for (
                    let channel = 0;
                    channel < output.numberOfChannels;
                    channel++
                ) {
                    output.getChannelData(channel)[i] = pcmView[i] / 32768.0
                }
            }
            this.queue.shift()
        }

        return true
    }
}

registerProcessor('audio-player-processor', AudioPlayerProcessor)
