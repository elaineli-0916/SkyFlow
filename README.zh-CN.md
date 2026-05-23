# SkyFlow Earth Companion

AI Native 沉浸式实时地球陪伴界面。

English version: [README.md](./README.md)

## 产品方向

SkyFlow 不是传统天气 App，也不是聊天机器人。它是一个环境式地球界面：像一个安静的轨道观察窗口，帮助用户重新感知真实世界、自然、光照、天气和时间。

MVP 的目标是在用户打开后的 10 秒内，让地球看起来是活着的：

- 电影感 3D 地球
- 缓慢旋转和顺滑的相机惯性
- 日夜光照
- 大气层 glow
- 云层运动
- 基于用户位置的环境信息
- 低频、克制的 ambient narration

## 当前状态

已实现：

- React + Vite + TailwindCSS
- React Three Fiber / Three.js 地球场景
- 使用 `public/textures` 中的本地真实地球白天、夜晚、云层贴图
- 保留程序化纹理生成逻辑，作为后续兜底/参考路径
- 动态云层
- 云层显示/隐藏按钮
- 大气层 glow
- 带清晰日夜分界线的展示光照
- 基于当前 UTC 时间和近似太阳赤纬计算的真实明暗分界线
- 星空背景
- 拖拽 / 缩放 / 旋转控制
- 浏览器地理位置获取与 fallback
- Open-Meteo 天气数据获取
- 日出 / 日落数据路径
- ambient companion narration
- 可见的位置坐标条
- 浏览器或 API 不可用时的本地 fallback 模型
- 统一的 `EarthTelemetry` 数据快照层
- 可见的数据来源标签
- 本地近似太阳和月亮方位角/高度角计算
- Soundscape Mode 声景系统雏形，支持本地三层音频混音
- Observe Mode，左右分布的本地天空 telemetry、日出/日落和月亮路径曲线
- Earth Command 文本输入，可回答固定天空意图并驱动地球相机动作

## 代码结构

当前前端结构：

```text
src/
  App.jsx                         # 顶层体验壳，负责模式和状态连接
  main.jsx                        # React 入口
  styles.css                      # 全局视觉系统和 HUD 样式
  components/
    EarthCanvas.jsx               # React Three Fiber 地球、光照、相机、标记点
    EarthCommandInput.jsx         # 文本命令输入，后续多模态入口
    SoundscapeToggle.jsx          # 极简声景开关
  hooks/
    useSoundscape.js              # 声景生命周期和基于 telemetry 的音量更新
  services/
    audioService.js               # 本地循环音频层和 fade 引擎
    earthCommandService.js        # 固定命令意图解析和 UI action 映射
    earthDataService.js           # UI 环境快照兼容包装
    earthTelemetry.js             # 位置、天气、太阳/月亮 telemetry 数据层
    narration.js                  # 环境式 companion narration
    skyDescriptionService.js      # 天空方向和高度的自然语言辅助
  utils/
    astro.js                      # 本地近似太阳/月亮计算
    format.js                     # 展示格式化工具
```

下一阶段 LLM 后端建议结构：

```text
server/
  index.js                        # HTTP server 入口
  routes/
    earthChat.js                  # POST /api/earth/chat
    memory.js                     # 可选的记忆读写 endpoints
  services/
    llmService.js                 # 模型 provider adapter 和流式响应处理
    earthContextService.js        # 将 EarthTelemetry + UI mode 转成模型上下文
    toolService.js                # 将模型/tool intents 映射成 UI actions
    memoryService.js              # 长期用户记忆抽象
  prompts/
    earthCompanion.md             # 环境式 Earth companion system prompt
    toolPolicy.md                 # 模型何时可以驱动地球 UI 的规则
  storage/
    memoryStore.js                # 初始本地/file/db-backed memory 实现
```

前后端边界：

- 浏览器端不要持有模型 provider API key。
- `EarthCommandInput` 后续应调用后端处理开放式 LLM 对话。
- 后端响应应同时返回自然语言和可选 UI actions。
- UI actions 保持结构化，例如 `set_mode`、`focus_photo_marker`、`show_night_side`、`show_sunlight`。
- `EarthTelemetry` 应作为压缩上下文发送给模型，不要直接发送完整 UI state。
- 长期记忆先从小型显式用户档案/偏好/稳定兴趣开始，再考虑 embeddings 或检索系统。

## 已知问题

### Soundscape 本地音频素材

Soundscape 引擎已经实现，但实际可循环播放的音频文件还没有提交。

预期本地文件：

- `public/audio/base-ambient.mp3`
- `public/audio/night-piano.mp3`
- `public/audio/wind-cloud.mp3`

在这些文件加入前，UI 和混音逻辑可用，但缺失的音频层不会发声。

### 地球地理贴图质量

之前的地理渲染使用程序化大陆块，导致地球看起来像几块抽象大陆，缺少足够的海岸线、地形和真实地理细节。

当前修复：

- 地球现在加载本地真实贴图：
  - `public/textures/earth-day.jpg`
  - `public/textures/earth-night.png`
  - `public/textures/earth-clouds.png`
- 云层使用 `earth-clouds.png` 作为 alpha map，让真实地表保持可见。

仍需改进：

- 增加独立 roughness / bump / specular 层
- 调整日夜 shader 光照下的贴图色彩
- 生产发布前确认贴图来源和授权
- 如果后续需要近距离缩放，考虑更高分辨率日夜贴图
- 合适阶段接入 NASA GIBS 真实云图/地表数据

## 数据计划

### 用户位置

使用浏览器原生 Geolocation API：

```js
navigator.geolocation.getCurrentPosition()
```

需要字段：

- `latitude`
- `longitude`

这些坐标会驱动本地天气、光照、月亮信息和叙事内容。

### 实时天气 / 云量

优先使用 Open-Meteo，因为它免费、免 API key，适合 Demo。

初始字段：

- `temperature_2m`
- `cloud_cover`
- `weather_code`
- `wind_speed_10m`

### 太阳 / 月亮 / 天文信息

通过 Open-Meteo forecast endpoint 获取稳定的日出/日落数据。

当前实现：

- Open-Meteo 的 `daily=sunrise,sunset`
- 本地近似 `sun_azimuth`
- 本地近似 `sun_altitude`
- 本地近似 `moon_azimuth`
- 本地近似 `moon_altitude`
- 本地月相计算
- 通过本地后端可选接入 Timeanddate 月亮信息：
  - `moonrise`
  - `moonset`
  - meridian 过中天时间 / 高度
  - 当前 Moon Direction
  - 当前 Moon Altitude

后续专用天文服务目标字段：

- `sunrise`
- `sunset`
- `moonrise`
- `moonset`
- `sun_azimuth`
- `moon_azimuth`
- `moon_altitude`

备选方案：

- 如果后续可以接受 API key，可以使用 ipgeolocation Astronomy API。

重要说明：

Open-Meteo 是 MVP 阶段天气和日出/日落的首选来源，因为它免 key、适合演示。不要在未验证前假设标准 forecast endpoint 稳定支持 moonrise/moonset 或 sun/moon azimuth 字段。

Timeanddate 的月亮页面可以提供更完整的本地月亮信息，但也可能返回反爬挑战页或 HTTP 403。SkyFlow 只通过后端请求，并设置 8 小时缓存和 45 秒最小请求间隔。如果 Timeanddate 拒绝请求，应用会继续使用本地天文近似，不会高频重试。

### 真实云图

后续阶段：NASA GIBS。

NASA GIBS 可以通过 WMTS/WMS/TMS/XYZ tiles 提供接近实时的卫星影像。很多图层在观测后约 3-5 小时可用。

不要把 NASA GIBS 作为 MVP 的硬依赖。先使用半透明动画云层；当基础地球体验足够稳之后，再升级为真实卫星云图。

## 进度记录

### 2026-05-23

- 新增 Soundscape Mode，作为本地音频分层系统，包含 base ambient、night piano 和 wind/cloud 三层。
- 为声景音频层加入平滑 fade in / fade out，避免突然切换。
- 声景音量会根据云量、风速、太阳高度角和月亮高度角动态变化。
- 新增 `public/audio/README.md`，记录需要放入的本地音频文件名。
- 将旧的本地天空 HUD 替换为更克制的 Observe 布局，把 telemetry 分布在左右边缘。
- 新增人类可读的天空方向和高度解释，例如 `NE`、`below horizon`、`low above horizon`。
- 新增本地天空环境式叙事，描述月亮方向、云量和本地光照状态。
- 新增 Earth Command 输入框，占位文案为 `Ask the Earth...`。
- 新增固定命令意图：月亮、太阳、天空、日落、夜侧和日照。
- 将 Earth Command 和地球视觉动作连接起来，命令可切换模式或移动相机到夜侧/日照视角。
- 为 sunlight 命令新增低调的日夜分界线强调效果。
- 验证 `npm run build` 通过；Vite 仍有预期内的 Three.js chunk 偏大提示。
- 通读应用代码，发现 `public/textures` 中已经存在真实地球贴图，但当前地球仍在使用程序化 canvas 纹理。
- 将 Three.js 地球改为通过 `TextureLoader` 加载本地真实白天、夜晚和云层贴图。
- 将云层改为使用 `earth-clouds.png` 作为 alpha map，让真实地理贴图保持可见。
- 更新 README 进度规则，并新增中文版 README 对照文档。
- 提亮地球 shader 和场景光照，让大陆与海洋更容易看清。
- 新增一个小型 UI 控制按钮，用于显示/隐藏云层。
- 降低默认云层透明度，减少对地表纹理的遮挡。
- 将渲染光照切换为展示用太阳方向，让球体上稳定显示一侧白天、一侧夜晚和更清晰的日夜分界线。
- 在内置浏览器中复查后，发现第一轮仍偏暗，因此再次提高曝光和白天侧亮度。
- 视觉复查后再次降低云层透明度，避免云层开启时压过地表纹理。
- 将明暗分界线从固定展示光源重构为基于实时 subsolar point 的计算模型。
- 停止自动旋转地球 mesh，让日夜分界线按照真实地球时间移动，而不是按照动画速度移动。
- 保留相机交互作为用户观察方式，同时保持地球物理坐标系稳定。
- 右侧新增当地时间信息块，显示近似当地时间、地点、UTC 偏移、太阳高度角和太阳方位角。
- 将当地时间/地点信息块移动到始终可见的右上角控制组，窄视口下也会显示。
- 去掉时间卡片边框，并改为更透明的环境式填充。
- 在云层按钮下方新增复位按钮，点击后相机会回到当前/兜底用户位置。
- 将地球坐标系固定为真实地轴倾角 23.44 度，并把 shader 中的太阳向量同步转换到同一倾斜坐标系。
- 将时间卡片改为完全透明的纯文字样式，不再遮挡地球。
- 新增低调的球体参考线：真实地轴线、30 度间隔经线、赤道、北回归线和南回归线。
- 将地轴线加长并提高清晰度，让它比大气层更有延伸感。
- 提高参考线可见度，同时保持和大气层统一的低调风格。
- 在 reset view 下方新增 grid 开关；它控制经线、赤道和回归线，地轴线始终显示。
- 使用相机 OrbitControls 恢复待机状态下的缓慢运动，而不是旋转地球物理 mesh。
- 保持地轴相对黄道面倾斜 23.44 度，同时保留真实时间驱动的明暗分界线计算。

### 2026-05-22

- 确认当前程序化地理图质量不足。
- 添加 README，作为项目进度、已知问题和数据/API 决策的统一记录位置。
- 约定后续所有改动和进度都记录在 README。
- 新增 `src/services/earthTelemetry.js`，作为位置、天气、太阳、月亮和数据源 metadata 的统一数据层。
- 保留 `src/services/earthDataService.js`，作为当前 UI 的兼容包装。
- 将天气和日出/日落获取切换为一次 Open-Meteo forecast 请求。
- 增加本地近似太阳和月亮位置计算；moonrise/moonset 服务选择暂未确定。
- 增加可见 telemetry source chips，用于显示 Open-Meteo/live 和 local-model 状态。

### 2026-05-21

- 创建初始 Vite + React + Three.js 项目。
- 构建第一版沉浸式 Earth companion 场景。
- 添加地理位置、Open-Meteo 天气、fallback 数据行为和 ambient narration。

## 本地开发

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:5173/
```

生产构建：

```bash
npm run build
```

## 下一步

- 加固 LLM 后端，并为 `POST /api/earth/chat` 增加更清晰的 provider 错误诊断。
- 扩展长期记忆模型，覆盖用户稳定偏好、位置假设、反复关注的天空兴趣和照片上下文。
- 根据真实本地时间切换，继续调整 `public/audio/` 里的白天/夜晚音乐听感。
- 在浏览器中做桌面和移动端视觉 QA，重点检查 Observe、Earth Command 和照片记忆标注。
- 只有在确实需要时才在 UI 中加入命令示例，避免界面变成聊天面板。
- 强化 `Where is the moon?` 的反馈，包括更明显的右侧 telemetry 强调，以及可选的月亮位置关系提示。
- 在需要时用更准确的天文算法或服务替换当前近似月亮高度角/方位角。
- 如果生产 bundle 体积成为问题，再考虑对 Three.js / R3F 做代码拆分。
