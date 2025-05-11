#!/bin/bash

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "Node.js 未安装，请先安装 Node.js。"
    exit 1
fi

# 检查 Yarn 是否安装
if ! command -v yarn &> /dev/null; then
    echo "Yarn 未安装，请先安装 Yarn。"
    exit 1
fi
#yarn add --dev eslint@8.56.0  prettier@3.0.3 eslint-plugin-vue@9.17.0 @babel/eslint-parser@7.23.3 eslint-config-prettier@9.1.0 eslint-plugin-prettier@5.1.3
  
#rm -rf node_modules yarn.lock
# 安装依赖
echo "正在安装依赖..."
yarn install
#或 npm install

# 清理旧的构建文件
[ -d ./dist ] && rm -rf ./dist

#yarn eslint --fix --ext .js,.vue src/
yarn lint
# 构建项目
echo "正在构建项目..."
yarn build

# 启动 Vue 项目
echo "正在启动 Vue 项目..."
yarn serve