# SkyFlow

**一个可以用手势进入的地球，也是一张关于城市、迁徙与个人记忆的空间地图。**

[English](./README.md) · [在线体验](https://sky-flow-eosin.vercel.app/) · [原版地球体验](https://sky-flow-eosin.vercel.app/?view=classic)

SkyFlow 把一段个人旅程放进真实的地球空间：从宇航员视角观察地球，沿城市轨迹飞行，进入卫星地图与香港 3D 沙盘，再在照片的拍摄位置打开一段记忆。

地球本身就是界面。音乐、镜头、城市、天气、月亮与照片一起完成叙事。

> 这个人一直在迁徙，也一直在观察世界。

## 从太空开始

开场是宇航员第一视角。地球保持缓慢自转，观察者可以转头、环绕、悬停、靠近或远离。光锥会跟随鼠标落在地球表面，让视线拥有明确的方向。

手势追踪只在用户主动开启后运行。MediaPipe Hand Landmarker 在本地 Web Worker 中识别手掌，并在摄像头预览里标出绿色指骨与关键点：

| 手势 | 镜头反馈 |
| --- | --- |
| 单手左右移动 | 连续环绕地球；动作幅度和速度越大，环绕越快 |
| 单手张开 | 靠近地球 |
| 单手握拳 | 远离地球 |

鼠标、滚轮和键盘控制始终保留。

## 沿着轨迹出发

点击 **沿着轨迹出发**，音乐与镜头同时开始，依次经过：

**北京 → 上海 → 纽约 → 马里兰 → 北京 → 香港 → 上海 → 北京**

每一站都经过完整的空间过渡：镜头从城市拉回太空，沿轨迹越过地球，再下降到下一个坐标。抵达后，照片会在拍摄位置展开；用户也可以随时打断自动旅程，自由拖拽与缩放。

## 从地球进入城市

北京与纽约以近距离卫星视图呈现。香港会进一步展开成一张风格统一的低模 3D 沙盘：

- 陆地、水面、山体、建筑与树木均为独立三维几何；
- 海岸线以及港岛、九龙之间的空间关系来自真实地理数据；
- 香港大学、IFC、ICC、中银大厦、太平山顶等重点建筑拥有单独的立面表达；
- 日落与夜间两种模式保留建筑轮廓，并在夜间点亮窗户；
- 个人照片以真实坐标落在沙盘中，可随镜头靠近展开。

## 天空仍然在场

SkyFlow 保留了原有的天气与天文能力，包括实时天气、云量、日落时间、月相和本地天空计算。此前的 Companion / Ask / Observe 体验也仍然保留，可以从页面右上角进入 **原版体验**。

## 技术结构

SkyFlow 使用 React + Vite 构建，并连接两套 3D 场景：

- **CesiumJS**：3D 地球、卫星城市、迁徙弧线、镜头飞行与空间照片；
- **Three.js / React Three Fiber**：香港风格化 3D 沙盘；
- **MediaPipe Tasks Vision**：在独立线程中进行本地手部识别；
- **Open-Meteo 与本地天文计算**：提供天气、日落与月亮信息；
- **服务端地图代理**：Google Maps API Key 不进入浏览器代码。

前端同时保留了一个受约束的 AI Director 动作接口：

```text
fly_to · show_overlay · show_photo · show_moon_path · narrate
```

动作会按顺序执行。后续自然语言模型可以生成镜头与图层计划，但不会直接接管界面状态。

## 本地运行

```bash
npm install
cp .env.example .env
```

按需在 `.env` 中配置服务端密钥：

```bash
GOOGLE_MAPS_API_KEY=
DASHSCOPE_API_KEY=
QWEN_MODEL=qwen3.5-omni-plus
DASHSCOPE_ASR_MODEL=paraformer-v2
SERVER_PORT=8787
```

分别启动后端与前端：

```bash
npm run server
```

```bash
npm run dev
```

打开 [http://localhost:5173](http://localhost:5173)。摄像头手势追踪需要浏览器授权，并应在 localhost 或 HTTPS 环境中使用。

生产构建：

```bash
npm run build
```

## 当前范围

这是一个可运行的 MVP。香港是目前完成完整沙盘建模的城市；北京与纽约暂时使用近距离卫星视图。AI Director 已保留动作协议，后续可继续接入自然语言导演能力。

旧版 Earth Companion README 已完整保存在 [docs/legacy/README-v1.zh-CN.md](./docs/legacy/README-v1.zh-CN.md)，部署说明见 [docs/vercel-deployment.md](./docs/vercel-deployment.md)。
