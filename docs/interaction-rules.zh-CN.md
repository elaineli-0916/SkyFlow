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
    { "type": "set_mode", "mode": "observe" }
  ],
  "memoriesToSave": []
}
```

如果模型返回纯文本或 JSON 格式错误，后端会降级成安全的纯文本回答。

## 允许的 UI Actions

模型只能建议以下动作：

- `camera_travel`
- `focus_photo_marker`
- `highlight`
- `pulse_layer`
- `save_sky_memory`
- `suggest_observe`
- `show_night_side`
- `show_sunlight`
- `set_mode`

前端只执行 allowlist 中的动作。模型不能直接操控 UI state。

前端仍然是最终裁决者。模型动作只作为建议；如果动作会破坏沉浸感、错误跳转图片问题，或在缺少照片元数据时保存天空记忆，前端必须忽略或改为追问。

## Ask 到 Observe 的过渡

Ask 模式不要在每一次自然语言回答后都跳到 Observe。只有当答案更适合通过空间 telemetry、天空位置、日照、云层或本地观测数据展示时，才使用 `set_mode: observe`。

以下情况不要跳 Observe，要留在 Ask 内回答：

- 普通聊天、解释、问候、追问或 fallback 帮助。
- 上传图片后的识别/描述问题，例如“这是什么”“这张图里有什么”“这是什么云”“这属于什么云”。
- 用户在问图片内容、云的类型、照片里的现象，而不是要求查看本地天空或实时云层。
- 只有图片附件、没有明确观察本地天空的指令。

如果答案适合看数据、但不应该强制切换，用 `suggest_observe`，不要直接 `set_mode`。Ask 内会出现一个轻量按钮，由用户决定是否进入 Observe。

当 Ask 需要进入 Observe 时，过渡应该像是地球正在带用户去看答案，而不是应用在切 tab。这个 handoff 按三步处理：

1. 先在 Ask 内给一句即时回应，例如 `Let me show you where the moon is relative to your sky.` 或 `我带你看一下它现在在你天空中的位置。`
2. 再用有编排感的动画进入 Observe：地球轻微放大或旋转到相关位置，请求的数据先淡入，顶部模式指示从 Ask 滑到 Observe，narration 同步更新。
3. Observe 可见后，把真正回答问题的信息高亮 1-2 秒。月亮问题高亮 Moon Path / Moon Altitude，太阳问题高亮 Sun Path / 日照数据，云层或天气问题高亮 Weather / cloud-density 数据。

模式指示应该是在旅程开始后确认变化，而不是唯一的变化提示。用户应该感觉到“SkyFlow 正在带我去看”，而不是“聊天回答打开了另一个页面”。

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

## 天空记忆规则

只有当用户明确要求保存或记住一张上传的天空照片时，才创建天空记忆。上传图片用于分析时，不应自动保存。

第一版公开 demo 把天空记忆保存在浏览器 localStorage：`skyflow.skyMemories.v1`。每条记录保存缩略图 data URL、地点名、经纬度、拍摄时间、短描述、标签和创建时间。

照片元数据优先级：

1. 优先读取原图 EXIF 里的 GPS 和拍摄时间。
2. 如果缺 GPS，就追问用户照片在哪里拍摄。
3. 如果缺拍摄时间，就追问用户拍摄时间。
4. 不允许模型凭空编造地点或时间。

## 语气

回答要简洁、扎实、有环境感。好的 SkyFlow 回答像一个从轨道上说话的安静界面：足够实用，可以驱动动作；也足够诗性，属于这个产品。
