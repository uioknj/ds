# DeepSeek2API

`DeepSeek2API` 是一个纯 Node.js 的本地控制台，用于统一管理：

- DeepSeek Web 账号绑定与轮换
- 本地用户注册 / 登录
- 邀请码与注册开关
- 无痕模式
- OpenAI 兼容接口
- 受控 DeepSeek 代理接口

项目不依赖第三方 npm 包，下载后即可直接运行。
默认发布内容不包含测试数据、示例账号、预置管理员凭据或任何个人运行数据。

## 功能概览

### 控制台

- 登录 / 注册双入口
- DeepSeek 账号绑定
- 聊天会话列表与历史消息查看
- 文件上传
- 流式 / 非流式响应切换
- 主题切换

### 管理能力

- 管理员登录
- 注册开关
- 邀请码生成、删除、批量删除
- 本地用户禁用、启用、删除
- 用户级并发 / 每分钟请求限制

### API 能力

- DeepSeek 代理：`/proxy/*`
- OpenAI 兼容：`/v1/models`、`/v1/chat/completions`
- API Key 管理
- 多账号轮询
- 无痕模式下自动清理会话

## 运行要求

- Node.js 18+
- 服务端可以访问 `https://chat.deepseek.com`

## 启动

```bash
npm start
```

默认监听地址：

```text
http://127.0.0.1:3000
```

## 环境变量

可选环境变量如下：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 服务端口 |
| `APP_ADMIN_USERNAME` | 空 | 管理员用户名 |
| `APP_ADMIN_PASSWORD` | 空 | 管理员密码 |

只有同时设置 `APP_ADMIN_USERNAME` 和 `APP_ADMIN_PASSWORD`，管理入口才会启用。

发布包不包含 `.env`。如需本地落盘配置，可参考根目录的 `.env.example` 手动创建 `.env`。

## 数据目录

运行态数据写入 `data/app.json`。

服务首次读写数据时会自动创建该文件，基础结构包括：

- `accounts`
- `apiKeys`
- `incognito`
- `invites`
- `registration`
- `sessions`
- `users`

发布源码或打包交付时，不要携带真实运行数据。

推荐发布基线：

- 保留 `data/.gitkeep`
- 不保留真实 `data/app.json`
- 不保留运行日志、历史压缩包和旧发布副本
- 不保留本机私有 `.env`
- 不保留任何账号、密码、Token、API Key、邀请码、会话和用户数据

注意：当前实现会在首次读取注册配置时创建 `data/app.json`，因此即使只访问一次 `/api/me` 或 `/api/discovery`，打包前也要再次确认 `data/` 目录只剩 `data/.gitkeep`。

## OpenAI 兼容模型

支持以下模型 ID：

- `deepseek-chat-fast`
- `deepseek-chat-fast-search`
- `deepseek-reasoner-fast`
- `deepseek-reasoner-fast-search`
- `deepseek-chat-expert`
- `deepseek-chat-expert-search`
- `deepseek-reasoner-expert`
- `deepseek-reasoner-expert-search`

说明：

- `*-search` 表示联网版本
- 推理模型会把思维过程包装在 `<think>...</think>`
- 搜索能力通过模型后缀控制，不使用 `web_search_options`

## 主要接口

### 公共接口

- `GET /api/me`
- `GET /api/discovery`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`

### 登录后接口

- `GET /api/accounts`
- `POST /api/accounts`
- `DELETE /api/accounts/:id`
- `POST /api/incognito`
- `GET /api/api-keys`
- `POST /api/api-keys`
- `DELETE /api/api-keys/:id`

### 管理接口

- `POST /api/admin/registration`
- `POST /api/admin/invites`
- `POST /api/admin/invites/batch-delete`
- `DELETE /api/admin/invites/:id`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `POST /api/admin/users/batch-disable`
- `POST /api/admin/users/batch-delete`

### DeepSeek 代理

- `GET /proxy/...`
- `POST /proxy/...`

允许转发的上游路径定义在 `src/config.js` 的 `allowedProxyPaths`。

### OpenAI 兼容接口

- `GET /v1/models`
- `POST /v1/chat/completions`

请求示例：

```json
{
  "model": "deepseek-chat-fast",
  "messages": [
    { "role": "user", "content": "hello" }
  ],
  "stream": true
}
```

## 目录结构

```text
.
|-- .env.example
|-- .gitignore
|-- README.md
|-- package.json
|-- data/
|   `-- .gitkeep
|-- public/
`-- src/
```
