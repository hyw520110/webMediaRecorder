@echo off

:: 动态获取 JDK 的 include 目录路径
for /f "tokens=*" %%i in ('javac -version 2^>^&1') do set JDK_VERSION=%%i
set JDK_PATH=%JAVA_HOME%
if not defined JDK_PATH (
    echo JAVA_HOME 环境变量未设置，请先设置 JAVA_HOME。
    exit /b 1
)

set JNI_HEADERS=%JDK_PATH%\include

:: 编译命令（Windows）
gcc -I"%JNI_HEADERS%" -I"%JNI_HEADERS%\win32" -shared -o audioProcessor.dll AudioProcessor.c -lstrmiids -lole32 -loleaut32

if %errorlevel% neq 0 (
    echo 编译失败。
    exit /b 1
)

echo 原生库编译成功。

:: 将编译后的库文件复制到目标目录
mkdir ..\target\classes\native
copy audioProcessor.dll ..\target\classes\native\