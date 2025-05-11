#!/bin/bash

# 动态获取 JDK 的 include 目录
JNI_HEADERS=$(dirname $(dirname $(which javac)))/include

INCLUDE_DIR="-I$JNI_HEADERS -I$JNI_HEADERS/linux"
LINK_OPTIONS="-lasound -lpthread"

# 检查操作系统类型
OS=$(uname -s)

# 查找当前目录下所有的 .c 文件
C_FILES=$(find . -maxdepth 1 -name "*.c" | tr '\n' ' ')

# 检查是否找到 .c 文件
if [ -z "$C_FILES" ]; then
    echo "未找到任何 .c 文件进行编译。"
    exit 1
fi

# 动态生成输出文件名，使用第一个 C 文件名的前缀
FIRST_C_FILE=$(basename "$(echo "$C_FILES" | awk '{print $1}')" .c)
OUTPUT_FILE="${FIRST_C_FILE}.so"

# 编译命令
if [[ "$OS" == "Linux" || "$OS" == "Darwin" ]]; then
    # 检查是否安装了 alsa 开发库
    if ! pkg-config --exists alsa; then
        echo "sudo apt-get install libasound2-dev" && sudo apt-get install libasound2-dev
    fi
    [ -f ./$OUTPUT_FILE ] && mv ./$OUTPUT_FILE ./${OUTPUT_FILE}.bak
gcc -shared -fPIC -O2 $INCLUDE_DIR $C_FILES -o $OUTPUT_FILE $LINK_OPTIONS
    if [ -f $OUTPUT_FILE ]; then
	    echo "原生库编译成功。"
	    [ -f ./${OUTPUT_FILE}.bak ] && rm -rf ./${OUTPUT_FILE}.bak
	    exit 0
	else
	    echo "原生库编译失败！"
	    [ -f ./${OUTPUT_FILE}.bak ] && mv ./${OUTPUT_FILE}.bak ./${OUTPUT_FILE}
	    exit 1
	fi
fi