// 创建WebSocket连接
const ws = new WebSocket('ws://localhost:8080/audio-stream');
ws.binaryType = 'arraybuffer'; // 关键配置：指定接收二进制数据为ArrayBuffer

// 音频播放上下文
let audioContext = null;
let audioQueue = [];
let isPlaying = false;

// 接收音频数据
ws.onmessage = function(event) {
    if (event.data instanceof ArrayBuffer) {
        audioQueue.push(event.data);
        
        // 延迟初始化音频上下文（需用户交互触发）
        if (!audioContext) {
            audioContext = new AudioContext();
            playNextChunk();
        }
    } else {
        console.log('收到非二进制消息:', event.data);
    }
};

// 循环播放音频队列
function playNextChunk() {
    if (audioQueue.length === 0 || !audioContext) {
        requestAnimationFrame(playNextChunk);
        return;
    }

    const arrayBuffer = audioQueue.shift();
    
    audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
        
        // 继续播放下一个片段
        setTimeout(playNextChunk, 0);
    }, (error) => {
        console.error('音频解码失败:', error);
        requestAnimationFrame(playNextChunk);
    });
}

// 错误处理
ws.onerror = function(error) {
    console.log('WebSocket Error:', error);
};