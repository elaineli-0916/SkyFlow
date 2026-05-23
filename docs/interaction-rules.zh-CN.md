# SkyFlow 互动规则

## 目标

SkyFlow 应该像一个环境式地球陪伴界面，而不是传统聊天机器人。Ask 模式可以接入多模态大模型，但每一次回答都应尽量和地球、本地天空、照片记忆或明确的界面动作相关。

## 路由规则

Ask 模式按这个顺序处理：

1. 优先请求 `POST /api/earth/chat`。
2. 如果后端和模型 API 可用，就使用大模型回答。
3. 如果后端不可用、API key 缺失或 provider 请求失败，就使用本地 fallback 规则。
4. 对话时间线中始终显示本轮走了哪条路：
   - `checking api`
   - `qwen api`
   - `local rules`
   - `local fallback`

## 用户输入

第一版支持：

- 文本命令
- 图片附件
- 麦克风语音命令

前端会把图片附件作为 data URL 发给本地后端。模型 provider 的 API key 必须只存在后端，不能暴露给浏览器。

## 语音输入

麦克风输入不再作为对话里的音频附件处理。浏览器会录制一小段 16 kHz 单声道 PCM 指令，发送到 `POST /api/asr/transcribe`，再把返回的转写文本作为用户消息送入 Ask 流程。大模型仍然通过 `POST /api/earth/chat` 接收文本、图片和 Earth context。

本地配置可以写 `DASHSCOPE_ASR_MODEL=paraformer-v2`。在麦克风实时输入场景里，SkyFlow 会把它映射到 DashScope 的实时 Paraformer WebSocket 模型，因为录音文件 REST API 需要公网可访问的文件 URL。

## 模型返回格式

后端要求模型返回紧凑 JSON：

```json
{
  "text": "A short natural answer.",
  "actions": [
    { "type": "open_look_up" }
  ],
  "memoriesToSave": []
}
```

如果模型返回纯文本或 JSON 格式错误，后端会降级成安全的纯文本回答。

## 允许的 UI Actions

模型只能建议以下动作：

- `open_look_up`
- `focus_moon`
- `focus_sun`
- `focus_photo_marker`
- `show_night_side`
- `show_sunlight`
- `set_mode`

前端只执行 allowlist 中的动作。模型不能直接操控 UI state。

## 本地 Fallback 规则

当模型不可用时，本地关键词规则会处理：

- 月亮问题
- 太阳问题
- 天空状态问题
- 日落问题
- 夜侧请求
- 日照 / 明暗分界线请求
- 照片记忆问题
- Companion / Ask / Observe 模式切换
- 简单续问，例如 `continue`、`more`、`再说`、`继续`

Fallback 回答要明确、平静、可用，但不能假装自己是大模型。

## 对话时间线

Ask 模式会展示完整互动过程：

- 用户输入
- 附件名称
- 本轮路由
- 助手回答
- 触发的 UI actions

这是早期产品阶段刻意可见的机制。后续产品稳定后，路由细节可以变成开发者/debug 开关。

## 记忆规则

第一版记忆系统应非常克制。

只保存稳定、对用户有长期价值的信息：

- 偏好的语言或语气
- 反复关注的天空主题
- 重要照片/地点关联
- 用户明确确认过的稳定位置假设

不要保存：

- 敏感信息
- 一次性命令
- 未确认的身份信息
- 原始上传媒体

第一版记忆存在 `server/storage/memories.json`。之后可以升级到 SQLite 和向量检索。

## 语气

回答要简洁、扎实、有环境感。好的 SkyFlow 回答像一个从轨道上说话的安静界面：足够实用，可以驱动动作；也足够诗性，属于这个产品。
