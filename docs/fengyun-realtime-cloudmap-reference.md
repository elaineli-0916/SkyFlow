# 风云卫星实时云图参考实现备忘

这份文档记录参考项目 `theodoreye001/FengYun_Dynamic_wallpaper` 的实现方式，以及它对 SkyFlow 后续实时云图优化的启发。目标不是照搬桌面壁纸，而是提炼出可迁移的图片源、刷新策略、缓存处理和 3D 地球接入边界。

参考来源：

- 线上入口：https://magua-qi.github.io
- GitHub 仓库：https://github.com/theodoreye001/FengYun_Dynamic_wallpaper
- 风云卫星图源：国家卫星气象中心 `img.nsmc.org.cn`
- 月相图源：NASA Moon Guide / Moon Visualization Gallery

## 参考项目做了什么

这个项目本质上是一个静态网页壁纸集合。它不跑后端，也不自己下载卫星数据，而是在 HTML 中直接引用国家卫星气象中心公开图片地址，再用 CSS 把图片摆成电脑桌面背景。

它的页面可以直接交给 Lively Wallpaper 或 Wallpaper Engine 作为动态壁纸使用。所谓“实时”，主要来自这些公开图片 URL 会被上游持续更新，页面定时重新加载图片即可。

核心思路很简单：

1. 用固定 URL 获取最新风云卫星图。
2. 用 CSS 把图片裁成圆形地球、矩形云图或局部放大窗口。
3. 用 JS 定时刷新背景图。
4. 刷新前先预加载图片，成功后再替换，避免闪烁。
5. 给 URL 加时间桶参数，绕开浏览器缓存。

## 关键图源

参考项目中出现的主要图源如下。

### FY-4B 全圆盘真彩色

```text
https://img.nsmc.org.cn/CLOUDIMAGE/FY4B/AGRI/GCLR/FY4B_DISK_GCLR.JPG
```

用途：展示风云四号 B 星 AGRI 载荷的全圆盘真彩色合成图。视觉上最适合作为“地球云图/实时地球窗口”的主视觉。

### FY-4B 全圆盘 Sandwich 合成图

```text
https://img.nsmc.org.cn/CLOUDIMAGE/FY4B/AGRI/SWCI/FY4B_DISK_SWCI.JPG
```

用途：突出对流云团、台风结构等天气系统。适合 Observe 里的“天气活动图层”或台风季展示。

### FY-4B 全圆盘缩略图

```text
https://img.nsmc.org.cn/CLOUDIMAGE/FY4B/AGRI/THUMBNAIL/FY4B_AGRI_DISK_GCLR.jpg
```

用途：更轻量，适合壁纸展示或先做 SkyFlow 里的云图预览。

### FY-4B 中国区域真彩色

```text
https://img.nsmc.org.cn/CLOUDIMAGE/FY4B/AGRI/GCLR/FY4B_REGC_GCLR.JPG
```

用途：参考项目把它做成右下角局部放大窗口。SkyFlow 可以用它做“中国区域实时云图”面板，而不是强行贴到 3D 球体上。

### 全球红外云图按时间拼接

参考项目还使用了一个需要按 UTC 时间拼接的全球云图 URL：

```text
https://img.nsmc.org.cn/CLOUDIMAGE/GEOS/MOS/IRX/PIC/GBAL/GEOS_IMAGR_GBAL_L2_MOS_IRX_GLL_YYYYMMDD_HHmm_10KM_MS.jpg
```

其中 `YYYYMMDD` 和 `HHmm` 按 UTC 小时生成。参考代码会取当前 UTC 时间往前退 1 小时，并对齐到整点：

```text
date = UTC now - 1 hour
YYYYMMDD = date year/month/day
HHmm = date hour + "00"
```

这个源比 FY4B 圆盘图更接近“全球矩形云图”，未来如果要在 SkyFlow 里做 globe cloud texture，可以优先研究它，而不是直接拿 FY4B 圆盘图包球。

## 自动刷新策略

参考项目的共享 JS 里有三个关键策略。

### 1. 用 15 分钟时间桶做 cache bust

页面不会每次刷新都生成完全随机参数，而是把当前时间除以 15 分钟，得到一个稳定时间桶：

```text
bucket = floor(now / 15min)
url = imageUrl + "?t=" + bucket
```

好处是：

- 同一个 15 分钟窗口内不会无限打爆图片源。
- 到下一个时间桶时，浏览器会认为这是新 URL。
- 对静态图片源很友好。

### 2. 定时 30 分钟刷新

默认自动刷新间隔是 30 分钟：

```text
startAutoRefresh(element, imageUrl, 30min)
```

这符合气象卫星公开图更新频率：不需要每分钟拉一次。SkyFlow 如果做实时云图，也应该避免高频刷新。

### 3. 先预加载再替换

它不是直接替换 `background-image`，而是先创建 `Image()` 预加载。图片加载成功后再更新 DOM；如果失败，保留上一张成功图片，并显示轻量错误提示。

这个细节很重要。SkyFlow 之前实时云图不稳定，可能就和以下问题有关：

- 图片源短暂不可用。
- 浏览器缓存拿到旧图。
- 图片刷新时出现空白闪烁。
- WebGL 纹理加载失败后没有保留上一帧。

## 月相图实现

参考项目的 `earth+moon.html` 会额外显示一个小月亮。它不是计算月相后自己绘制，而是根据年份和 UTC 小时拼 NASA Moon Visualization Gallery 的图片编号：

```text
https://moon.nasa.gov/mvg.YEAR/NNNN.jpg
```

它以当年 1 月 1 日为基准，按“天数差 * 24 + 当前 UTC 小时 + baseNumber”推算图片编号。代码里写了一个 `baseNumber = 13`，并提示这个偏移量来自 NASA gallery，每年可能需要调整。

这说明它的月亮方案不是长期稳定 API，而是一个可用但需要维护的图片路径技巧。SkyFlow 已经有本地月亮位置/高度计算，所以不建议直接依赖它做核心天文逻辑；但可以作为视觉贴图参考。

## 它为什么能做成桌面壁纸

这个项目适合 Lively Wallpaper / Wallpaper Engine，是因为它几乎不依赖复杂运行环境：

- 纯 HTML/CSS/JS。
- 图片通过公网 URL 加载。
- 没有 npm 构建。
- 没有 API key。
- 页面尺寸用 `100vh`、`vmin` 和 media query 适配横屏/竖屏。
- 图片用 CSS `background-image` 展示，不需要 WebGL。

这也是它比 SkyFlow 更容易成功的原因：它只是把最新卫星图“展示在平面上”，没有把图投影到一个可旋转的 3D 地球纹理上。

## 对 SkyFlow 的关键启发

### 不要一开始就强行把 FY4B 圆盘图贴到球上

FY4B 全圆盘图是地球同步气象卫星看到的圆盘投影，不是经纬度展开图。它适合做：

- 圆形实时云图贴片。
- Observe 里的卫星云图面板。
- Companion/Ask 触发时的“我带你看实时云系”视觉层。
- 地球旁边的实时云图小窗。

但它不适合直接作为 Three.js sphere 的 `map` 或 `alphaMap`，否则云层位置会明显不对。

如果要贴到 SkyFlow 的 3D 地球上，有三条路线：

1. 使用全球矩形云图源，研究它是否接近等经纬投影。
2. 做地球同步卫星投影到球面的 shader 或 CPU 重投影。
3. 先不包球，而是在地球外层放一个面向相机的半透明云图圆盘，作为“卫星视角图层”。

第一版建议走第 3 条，风险最低，也最符合 SkyFlow 的沉浸式观察气质。

### 需要一个 SkyFlow 自己的图片代理

参考项目用 CSS 背景图，可以直接跨域显示。但 SkyFlow 如果要把图片变成 WebGL 纹理，浏览器可能遇到 CORS 限制。

建议新增一个服务端代理，例如：

```text
GET /api/satellite/fy4b?type=gclr
GET /api/satellite/fy4b?type=swci
GET /api/satellite/global-cloud
```

代理负责：

- 请求上游图片。
- 设置合理的 `Cache-Control`。
- 给前端返回同源图片，避免 WebGL CORS 问题。
- 上游失败时返回上一张缓存成功的图，避免画面消失。

如果部署在 Vercel，可以先做轻量 serverless proxy；更稳定的版本再考虑 KV/Blob 缓存。

### 刷新频率应该低频

SkyFlow 不需要每分钟刷新云图。建议：

- 主动刷新：30 分钟一次。
- 失败重试：1 分钟起步，指数退避。
- Ask 触发云图时：只 pulse 或 fade in，不要频繁重新请求。
- Companion：只在旁白中提到云图状态，不主动刷屏。

这和 SkyFlow 的产品边界一致：它不是气象监控台，而是一个低频、可信、安静的地球窗口。

## 推荐迁移方案

### Phase 1：Observe 加实时卫星云图面板

最小可行版本：

- 在 Observe 面板增加 “Satellite Cloud Map” 区块。
- 默认显示 FY4B 缩略图或真彩色圆盘图。
- 右上角显示 `Updated from FY-4B / refresh every 30 min`。
- 图片加载失败时保留上一张，不让 UI 空掉。
- Ask 问 “现在云图怎么样” 时，只高亮这个面板，不自动切复杂模式。

这个阶段不碰 3D 纹理，最稳。

### Phase 2：地球旁边加入实时云图浮窗

在 EarthCanvas 外层 UI 中加一个小型 satellite inset：

- 类似参考项目的局部放大窗口。
- 可显示 FY4B 中国区域图或全圆盘图。
- Ask “show me the clouds over China” 时，地球旋转到东亚，同时浮窗 fade in。
- 这会比普通天气字段更有冲击力。

### Phase 3：做半透明卫星圆盘图层

在 3D 场景中加入一个面向相机或固定在东亚方向的圆盘图层：

- 圆盘使用 FY4B 全圆盘图。
- 外圈 feather 成透明。
- 叠加在地球外侧，不假装它是全球云层纹理。
- 可以在 Observe 中作为 “satellite view” 短暂出现。

这会保留真实卫星视角，同时避免错误投影。

### Phase 4：研究全球云图贴球

如果后续确实要让云层绕 3D 地球流动，需要优先研究全球矩形云图：

- 确认图片投影类型。
- 确认经纬度范围。
- 确认时间序列稳定性。
- 确认日夜/红外合成的视觉是否适合 SkyFlow。
- 如果无法对齐，就只作为信息层，不作为真实 3D 纹理。

## 可复用伪代码

### 前端图片刷新

```js
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

function cacheBucketUrl(url) {
  const bucket = Math.floor(Date.now() / FIFTEEN_MINUTES);
  return `${url}?t=${bucket}`;
}

async function loadSatelliteImage(url, onSuccess, onError) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => onSuccess(img);
  img.onerror = onError;
  img.src = cacheBucketUrl(url);
}

setInterval(refreshSatelliteImage, THIRTY_MINUTES);
```

### 服务端代理设想

```js
const sources = {
  gclr: "https://img.nsmc.org.cn/CLOUDIMAGE/FY4B/AGRI/GCLR/FY4B_DISK_GCLR.JPG",
  swci: "https://img.nsmc.org.cn/CLOUDIMAGE/FY4B/AGRI/SWCI/FY4B_DISK_SWCI.JPG",
  thumbnail: "https://img.nsmc.org.cn/CLOUDIMAGE/FY4B/AGRI/THUMBNAIL/FY4B_AGRI_DISK_GCLR.jpg",
  china: "https://img.nsmc.org.cn/CLOUDIMAGE/FY4B/AGRI/GCLR/FY4B_REGC_GCLR.JPG",
};
```

代理返回时建议：

```text
Content-Type: image/jpeg
Cache-Control: public, max-age=900, stale-while-revalidate=1800
```

这样前端每 30 分钟刷新一次，上游短暂波动也不会立刻影响界面。

## 以后优化 SkyFlow 时的判断标准

实时云图要服务 SkyFlow 的产品目标，而不是把 SkyFlow 变成气象软件。

应该做：

- 让用户感到地球正在发生真实变化。
- 让 Ask 可以带用户看云图，而不是只回答文字。
- 让 Observe 增加可信的实时自然数据。
- 用低频、平滑、可解释的方式更新。

暂时不要做：

- 高频气象监控。
- 复杂台风路径预测。
- 未校正的云图包球。
- 让 AI 对卫星图做不可靠的强解释。

一句话结论：参考项目成功的原因是它把问题降维了。它没有做复杂实时数据系统，而是用稳定公网图片源、低频刷新和桌面壁纸容器，做出了“实时云图在动”的感觉。SkyFlow 后续也应该先用这种低风险方式，把 FY4B 云图作为观察层接入，再逐步研究真正的 3D 投影和云层纹理。
