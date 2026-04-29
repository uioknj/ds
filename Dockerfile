# 使用轻量级的 Node.js 20 环境
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 先复制 package.json 并安装依赖（这样打包速度更快）
COPY package.json ./
RUN npm install

# 复制所有源代码到镜像中
COPY . .

# 暴露常用的 3000 端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
