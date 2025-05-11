#include <jni.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <linux/soundcard.h>

#include <stdatomic.h>
#include <stdint.h>
#include <termios.h>
#include <pthread.h>
#include <alsa/asoundlib.h>

// 宏定义
#define FRAME_SIZE 2048
#define BUFFER_SIZE (1024 * 1024)

// 结构体定义
static pthread_t captureThread;
typedef struct {
    atomic_bool isCapturing;
    snd_pcm_t *pcmHandle;
    char *ringBuffer;
    atomic_size_t writePos;
    JavaVM *jvm;
    jobject globalCallback;
    jmethodID onAudioDataMethod;
} AudioContext;

static AudioContext context = {
    .isCapturing = ATOMIC_VAR_INIT(0),
    .pcmHandle = NULL,
    .ringBuffer = NULL,
    .writePos = 0,
    .jvm = NULL,
    .globalCallback = NULL,
    .onAudioDataMethod = NULL
};
typedef struct {
    char     riff[4];        // "RIFF"
    uint32_t fileSize;       // 文件总大小-8
    char     wave[4];        // "WAVE"
    char     fmt[4];         // "fmt "
    uint32_t fmtSize;        // fmt块大小（16）
    uint16_t audioFormat;    // 1=PCM
    uint16_t channels;       // 声道数
    uint32_t sampleRate;     // 采样率
    uint32_t byteRate;       // 每秒字节数
    uint16_t blockAlign;     // 每帧字节数
    uint16_t bitsPerSample;  // 位深度
    char     data[4];        // "data"
    uint32_t dataSize;       // 音频数据总大小
} WavHeader;
JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *reserved) {
    context.jvm = vm;
    return JNI_VERSION_1_8;
}

static int configureAlsaParams(snd_pcm_t *pcm, snd_pcm_hw_params_t *params) {
    // 获取支持的格式列表
    snd_pcm_format_t format;
    snd_pcm_hw_params_get_format(params, &format);
    //fprintf(stderr, "[ALSA] 硬件支持的格式: %s\n", snd_pcm_format_name(format));

    // 动态设置采样率
    unsigned int targetRate = 44100;
    if (snd_pcm_hw_params_set_rate_near(pcm, params, &targetRate, NULL) < 0) {
        fprintf(stderr, "[ALSA] 不支持的采样率: %u Hz\n", targetRate);
        return -1;
    }

    // 动态设置声道数
    int channels = 2;
    if (snd_pcm_hw_params_set_channels(pcm, params, channels) < 0) {
        fprintf(stderr, "[ALSA] 不支持双声道，回退到单声道\n");
        channels = 1;
        if (snd_pcm_hw_params_set_channels(pcm, params, channels) < 0) {
            fprintf(stderr, "[ALSA] 声道设置失败\n");
            return -1;
        }
    }

    return 0;
}
static const char* getFirstAvailableCaptureDevice() {
    snd_ctl_t *ctl_handle = NULL;
    snd_ctl_card_info_t *ctl_info;
    int card_num = -1;
    const char *device_name = NULL;

    snd_ctl_card_info_alloca(&ctl_info);

    // 遍历所有声卡
    while (snd_card_next(&card_num) >= 0 && card_num >= 0) {
        char name[32];
        snprintf(name, sizeof(name), "hw:%d", card_num);

        // 打开控制接口
        if (snd_ctl_open(&ctl_handle, name, 0) != 0) {
            fprintf(stderr, "无法打开声卡 %d: %s\n", card_num, snd_strerror(-1));
            continue;
        }

        // 获取声卡信息
        if (snd_ctl_card_info(ctl_handle, ctl_info) < 0) {
            snd_ctl_close(ctl_handle);
            continue;
        }

        // 遍历所有 PCM 设备
        int dev_num = -1;
        while (1) {
            int ret = snd_ctl_pcm_next_device(ctl_handle, &dev_num);
            if (ret < 0 || dev_num < 0) break;

            snd_pcm_info_t *pcminfo;
            snd_pcm_info_alloca(&pcminfo);
            snd_pcm_info_set_device(pcminfo, dev_num);
            snd_pcm_info_set_stream(pcminfo, SND_PCM_STREAM_CAPTURE);

            if (snd_ctl_pcm_info(ctl_handle, pcminfo) == 0) {
                snprintf(name, sizeof(name), "hw:%d,%d", card_num, dev_num);
                device_name = strdup(name);
                snd_ctl_close(ctl_handle);
                return device_name;
            }
        }
        snd_ctl_close(ctl_handle);
    }

    // 回退到默认设备
    return strdup("default");
}
static int initAlsaDevice() {
	snd_ctl_card_info_t *ctl_info;
    snd_pcm_hw_params_t *params;
    const char *device = getFirstAvailableCaptureDevice();
    if (!device) {
        fprintf(stderr, "未找到可用音频设备\n");
        return -1;
    }
    //fprintf(stderr, "[ALSA] 尝试打开设备: %s\n", device);
    int ret = snd_pcm_open(&context.pcmHandle, device,  SND_PCM_STREAM_CAPTURE,  SND_PCM_NONBLOCK);
    free((void*)device);
    if (ret < 0) {
	    fprintf(stderr, "[ALSA] 打开失败: %s\n", snd_strerror(ret));
	    return -1;
	}
    if ((ret = snd_pcm_nonblock(context.pcmHandle, 1)) < 0) goto error_close;
    snd_pcm_hw_params_alloca(&params);
    snd_pcm_hw_params_any(context.pcmHandle, params);
	unsigned int minRate, maxRate;
    snd_pcm_hw_params_get_rate_min(params, &minRate, NULL);
    snd_pcm_hw_params_get_rate_max(params, &maxRate, NULL);
    //fprintf(stderr, "[ALSA] 支持的采样率范围: %u - %u Hz\n", minRate, maxRate);
    if (configureAlsaParams(context.pcmHandle, params) < 0) goto error_close;

    snd_pcm_uframes_t bufferSize = FRAME_SIZE * 4;
    if (snd_pcm_hw_params_set_buffer_size_near(context.pcmHandle, params, &bufferSize) < 0) goto error_close;

    if (snd_pcm_hw_params(context.pcmHandle, params) < 0 || 
        snd_pcm_prepare(context.pcmHandle) < 0 || 
        snd_pcm_start(context.pcmHandle) < 0) {
        goto error_close;
    }
    return 0;
    
error_close:
    snd_pcm_close(context.pcmHandle);
error:
    return -1;
}

int kbhit() {
    struct timeval tv = {0L, 0L};
    fd_set fds;
    FD_ZERO(&fds);
    FD_SET(STDIN_FILENO, &fds);
    return select(STDIN_FILENO + 1, &fds, NULL, NULL, &tv);
}

int getch() {
    int ch;
    struct termios oldt, newt;
    tcgetattr(STDIN_FILENO, &oldt);
    newt = oldt;
    newt.c_lflag &= ~(ICANON | ECHO);
    tcsetattr(STDIN_FILENO, TCSANOW, &newt);
    ch = getchar();
    tcsetattr(STDIN_FILENO, TCSANOW, &oldt);
    return ch;
}

static void* captureLoop(void* arg) {
    JNIEnv *env;
    if ((*context.jvm)->AttachCurrentThread(context.jvm, (void**)&env,  NULL) != JNI_OK) {
        return NULL;
    }

    // 新增发送缓冲区和指针
    static char sendBuffer[1024];
    static int sendBufferPos = 0;

    while (atomic_load(&context.isCapturing)) {
        int waitResult = snd_pcm_wait(context.pcmHandle, 1000); 
        if (waitResult < 0) {
            fprintf(stderr, "等待错误: %s\n", snd_strerror(waitResult));
            continue;
        }
        snd_pcm_sframes_t avail = snd_pcm_avail(context.pcmHandle);
        snd_pcm_uframes_t commitFrames = 0;

        if (avail < 0) {
            if (snd_pcm_recover(context.pcmHandle, avail, 1) < 0) {
                fprintf(stderr, "无法恢复设备，尝试重启...\n");
                snd_pcm_close(context.pcmHandle);
                if (initAlsaDevice() < 0) break;
                snd_pcm_prepare(context.pcmHandle);
                snd_pcm_start(context.pcmHandle);
                continue;
            }
        }

        if (avail == 0) {
            int state = snd_pcm_state(context.pcmHandle);
            if (state != SND_PCM_STATE_RUNNING) {
                fprintf(stderr, "ALSA device not running. State: %s\n", snd_pcm_state_name(state));
                snd_pcm_start(context.pcmHandle);
            }
            usleep(2000);
            continue;
        }

        commitFrames = (avail > FRAME_SIZE) ? FRAME_SIZE : avail;

        const snd_pcm_channel_area_t *areas;
        snd_pcm_uframes_t offset;
        snd_pcm_sframes_t frames = snd_pcm_mmap_begin(context.pcmHandle, &areas, &offset, &commitFrames);

        if (frames < 0) {
            fprintf(stderr, "mmap_begin错误: %s\n", snd_strerror(frames));
            continue;
        }

        if (commitFrames > 0) {
            char *buffer = (char*)areas[0].addr + (offset * areas[0].step / 8);
            size_t dataSize = commitFrames * 4;

            // 分包逻辑：累积到sendBuffer，满1024字节就推送
            size_t copied = 0;
            while (copied < dataSize) {
                size_t toCopy = (dataSize - copied) < (1024 - sendBufferPos) ? (dataSize - copied) : (1024 - sendBufferPos);
                memcpy(sendBuffer + sendBufferPos, buffer + copied, toCopy);
                sendBufferPos += toCopy;
                copied += toCopy;
                if (sendBufferPos == 1024) {
                    if (context.globalCallback && context.onAudioDataMethod) {
                        jbyteArray dataArray = (*env)->NewByteArray(env, 1024);
                        if (dataArray) {
                            (*env)->SetByteArrayRegion(env, dataArray, 0, 1024, (jbyte*)sendBuffer);
                            (*env)->CallVoidMethod(env, context.globalCallback, context.onAudioDataMethod, dataArray);
                            (*env)->DeleteLocalRef(env, dataArray);
                        }
                    }
                    sendBufferPos = 0;
                }
            }
        }

        int commitResult = snd_pcm_mmap_commit(context.pcmHandle, offset, commitFrames);
        if (commitResult < 0 || commitResult != (int)commitFrames) {
            fprintf(stderr, "提交错误: 预期%lu 实际%d\n", commitFrames, commitResult);
        }
    }

    // 采集结束时，推送剩余未满1024字节的数据
    if (sendBufferPos > 0 && context.globalCallback && context.onAudioDataMethod) {
        JNIEnv *env;
        if ((*context.jvm)->AttachCurrentThread(context.jvm, (void**)&env,  NULL) == JNI_OK) {
            jbyteArray dataArray = (*env)->NewByteArray(env, sendBufferPos);
            if (dataArray) {
                (*env)->SetByteArrayRegion(env, dataArray, 0, sendBufferPos, (jbyte*)sendBuffer);
                (*env)->CallVoidMethod(env, context.globalCallback, context.onAudioDataMethod, dataArray);
                (*env)->DeleteLocalRef(env, dataArray);
            }
        }
        sendBufferPos = 0;
    }

    (*context.jvm)->DetachCurrentThread(context.jvm);
    return NULL;
}

JNIEXPORT void JNICALL Java_com_web_media_recorder_media_processor_jni_NativeProcessor_startCapture(
    JNIEnv *env, jobject obj, jobject callback, jboolean isAudio) {
    if (atomic_exchange(&context.isCapturing, 1)) return;

    if (context.globalCallback) {
        (*env)->DeleteGlobalRef(env, context.globalCallback);
        context.globalCallback = NULL;
    }
	if (context.globalCallback) {
	    (*env)->DeleteGlobalRef(env, context.globalCallback);
	}
	context.globalCallback = (*env)->NewGlobalRef(env, callback);
    jclass callbackClass = (*env)->GetObjectClass(env, context.globalCallback);
    context.onAudioDataMethod = (*env)->GetMethodID(env, callbackClass, "onDataReceived", "([B)V");
    if (!context.onAudioDataMethod) {
        fprintf(stderr, "严重错误：未找到 onDataReceived 方法 !!!!\n");
        return;
    }

    if (isAudio) {
        if (!context.pcmHandle && initAlsaDevice() < 0) {
            jclass exCls = (*env)->FindClass(env, "java/lang/RuntimeException");
            (*env)->ThrowNew(env, exCls, "Failed to initialize audio device");
            return;
        }
    } else {
        fprintf(stderr, "Video capture initialization not implemented yet.\n");
        return;
    }

    if (!context.ringBuffer) {
        context.ringBuffer = (char*)calloc(BUFFER_SIZE, 1);
    }

    pthread_create(&captureThread, NULL, captureLoop, NULL);
}

JNIEXPORT void JNICALL Java_com_web_media_recorder_media_processor_jni_NativeProcessor_stopCapture(
    JNIEnv *env, jobject obj) { 
    atomic_store(&context.isCapturing, 0);
    pthread_join(captureThread, NULL);
    atomic_store(&context.writePos, 0);
}

// 释放资源时关闭文件
void Java_com_web_media_recorder_media_processor_jni_NativeProcessor_releaseResources(JNIEnv *env, jclass clazz) {
    if (context.pcmHandle) {
        snd_pcm_drop(context.pcmHandle); 
        snd_pcm_close(context.pcmHandle);
        context.pcmHandle = NULL;
    }
    if (context.ringBuffer) {
	    free(context.ringBuffer);
	    context.ringBuffer = NULL; 
	}
    context.ringBuffer = (char*)calloc(BUFFER_SIZE, 1);
    if (context.globalCallback) {
        (*env)->DeleteGlobalRef(env, context.globalCallback);
    }
    // 清空结构体字段以避免悬空指针
    context.pcmHandle = NULL;
    context.ringBuffer = NULL;
    context.globalCallback = NULL;
}

JNIEXPORT jboolean JNICALL Java_com_web_media_recorder_media_processor_jni_NativeProcessor_isKeyPressed(
    JNIEnv *env, jobject obj, jint keyCode) {
    if (kbhit()) {
        int key = getch();
        if (key == keyCode || key == (keyCode | 0x20)) { 
            return JNI_TRUE;
        }
    }
    return JNI_FALSE;
}
JNIEXPORT jintArray JNICALL Java_com_web_media_recorder_media_processor_jni_NativeProcessor_getAudioParams(JNIEnv *env, jobject obj) {
    jintArray params = (*env)->NewIntArray(env, 3); 
    if (params == NULL) return NULL;

    jint buf[] = {
        44100,     // 采样率
        2,         // 声道数
        16         // 位深度
    };
    (*env)->SetIntArrayRegion(env, params, 0, 3, buf);
    return params;
}
