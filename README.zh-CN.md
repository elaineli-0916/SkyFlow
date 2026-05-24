# SkyFlow：关于观察、陪伴与天空记忆的地球之窗

![SkyFlow preview](./docs/images/skyflow-preview.png)

SkyFlow 是一个 AI Native 的沉浸式实时地球陪伴界面。

它不是一个传统天气 App，也不是一个把聊天框放在地球旁边的 AI 助手。它更像一个安静的地球之窗：你可以看见云层经过、昼夜交换、月亮升起，也可以把自己拍下的天空放回地球上。

它试图回答的不是“今天几度”，而是：我们如何重新感知自己正在真实世界之中。

English version: [README.md](./README.md)

## 在线体验

- Demo：部署后可在这里补充 Vercel 链接
- Demo Video：可在这里补充演示视频
- GitHub：当前仓库

## 你会看到什么

打开 SkyFlow 后，首先出现的是一颗缓慢呼吸的 3D 地球。它会显示昼夜边界、云层、大气辉光、星空背景，以及你所在位置附近的时间和天空状态。

你可以拖拽地球，观察不同经纬度正在经历的白昼和夜晚；也可以打开云层、网格、声音氛围，或者让视角回到你的位置。

界面不会急着把信息塞满屏幕。它更像一个正在运行的轨道窗口：光在移动，云在经过，月亮和地球保持着缓慢的关系。

## 三种使用方式

### Companion：安静地看地球

Companion 是 SkyFlow 的默认状态。

在这里，你不需要马上提问。界面会以很低的频率切换一行环境式文字，描述月亮、云、日出、日落、城市夜色和自然连接。它像一个安静的旁白，让地球不只是可视化对象，而是一个正在发生的时间场景。

你可以：

- 拖拽地球查看不同角度。
- 松开鼠标后停留在当前视角，稍后继续缓慢自动旋转。
- 查看本地时间、月亮高度和下一次光照变化。
- 开关云层、参考网格和声音氛围。

### Ask：向地球提问

Ask 是自然语言入口。

你可以输入问题、上传图片，或者使用麦克风说话。SkyFlow 会把问题和当前地球状态结合起来回答。

适合 Ask 的问题包括：

- `Where is the moon now?`
- `show me the night side`
- `这是什么云`
- `这张照片像在哪里拍的？`

普通回答会留在 Ask 中。比如图片识别、云类型判断、照片内容解释，不会突然跳转到其他界面。只有当问题更适合通过空间位置展示时，SkyFlow 才会带你进入 Observe。

Ask 到 Observe 的过渡会尽量保持沉浸感：先给一句简短回应，再让地球视角移动，最后进入观测界面并高亮相关信息。

### Observe：理解此刻的天空

Observe 是本地天空观测状态。

它用更清晰的方式展示你所在位置附近的太阳、月亮和天气信息：

- 当前地点和经纬度。
- 太阳路径、日出、日落和太阳方位。
- 月亮路径、月出、月落、中天时间、月亮高度和月相。
- 天气摘要、云量和下一次光照变化。
- 页面底部的数据来源说明。

如果你问月亮，Observe 会高亮月亮路径和月亮高度；如果你问太阳或日落，它会高亮太阳路径；如果你问云层或天气，它会高亮天气与云量信息。

## 观察、陪伴与记录

SkyFlow 希望把“看见天空”变成一种可以被保留的体验。

项目中已经有天空记忆标记：照片可以被放回地球上的地点，例如 Yueyang、College Park、Provideniya 和 Los Angeles。用户不只是上传一张图片，而是在地球上重新定位一次自己的天空经验。

当前记录分为两类：

- 对话记录：显示用户输入、附件、回答和触发的界面动作。
- 记忆候选：只保存长期有价值的信息，例如偏好语言、反复关注的天空主题、重要地点或照片关联。

SkyFlow 不保存敏感信息，不保存一次性命令，也不保存原始上传媒体。

## 技术实现

SkyFlow 使用 React + Vite 构建前端界面，使用 Three.js / React Three Fiber 渲染实时 3D 地球。

天气、云量、日出和日落信息来自 Open-Meteo。太阳与月亮位置由本地天文计算补充，月亮的月出、月落和中天信息可通过后端请求 Timeanddate 数据。

Ask 模式通过服务端接口调用大模型。浏览器只请求 SkyFlow 自己的 `/api/earth/chat`，真正的 API Key 保存在服务端环境变量中，不会暴露给前端。

主要技术栈：

- React
- Vite
- Tailwind CSS
- Three.js
- React Three Fiber
- Vercel Serverless Functions
- DashScope Qwen
- DashScope Paraformer ASR
- Open-Meteo

## 数据来源与隐私

SkyFlow 使用以下数据来源：

- 浏览器地理位置：用于计算本地时间、天气、太阳和月亮信息。
- Open-Meteo：用于天气、云量、风速、日出和日落。
- 本地天文计算：用于太阳方位、太阳高度、月亮方位、月亮高度和月相。
- Timeanddate：可选用于更完整的月亮时间数据。
- DashScope Qwen：用于 Ask 模式中的自然语言回答。
- DashScope Paraformer：用于麦克风语音转写。

隐私原则：

- API Key 只保存在服务端环境变量中。
- 不要把密钥写入前端代码，也不要使用 `VITE_` 前缀保存密钥。
- 图片用于当前问题的理解，不作为原始媒体长期保存。
- 记忆只保存稳定、明确、有长期价值的信息。

## 本地运行

安装依赖：

```bash
npm install
```

启动本地 API 服务：

```bash
npm run server
```

启动前端开发服务：

```bash
npm run dev
```

构建生产版本：

```bash
npm run build
```

## 部署说明

项目已支持 Vercel 部署。

Vercel 环境变量需要配置：

```bash
DASHSCOPE_API_KEY=your_dashscope_key
QWEN_MODEL=qwen3.5-omni-plus
DASHSCOPE_ASR_MODEL=paraformer-v2
```

构建设置：

```text
Build command: npm run build
Output directory: dist
```

更详细的部署说明见：[docs/vercel-deployment.md](./docs/vercel-deployment.md)
