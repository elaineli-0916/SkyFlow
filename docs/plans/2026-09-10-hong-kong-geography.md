# 香港沙盘海岸线修正

## 范围与来源

按 [Google Maps 香港区域](https://www.google.com/maps/@22.29,114.155,11z) 目视核对岛屿位置与水道。模型使用可独立分发的地理数据，不使用 Google 地图截图或贴图。

- 建筑：保留 `hong-kong-osm.json` 的现有模型范围和处理方式。
- 区域海岸：[OpenStreetMap](https://www.openstreetmap.org/copyright)，通过 Overpass 获取 coastline ways；经纬度范围为西 113.88、南 22.10、东 114.40、北 22.43。
- 四个完整岛形：OSM physical island relations，香港岛 2278450、南丫岛 12926172、青衣 10599238、大屿山 3676782。选用岛屿实体，排除含海域的行政边界。
- 更远的大陆：[Natural Earth 1:10m land](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson)，[public domain](https://www.naturalearthdata.com/about/terms-of-use/)。大陆近岸替换为连续的 OSM 海岸弧段；远端连接不表示精确测绘岸线。

输出为本地 `public/data/hong-kong-coast.json`，保留来源和 ODbL / public domain 说明，页面底部与说明面板同步署名。加载无外部请求、无 API key。

## 几何与镜头

同一经纬度投影用于旧建筑与新海岸。大陆向北延续，港岛南岸完整，各岛独立成面；维港东西口、青衣及南丫岛两侧水道保留。外围仅建低模山体和陆地，不增加建筑。山体高程仍是风格化近似，不是实测地形。

原城区裁切陆地和矩形边线不再绘制。新陆地合并为一个几何体，外围山体合并为一个几何体，沿岸线独立绘制。地形采样采用较简化的岸线掩膜，实际陆地外轮廓继续使用详细数据。保持原有地标镜头与默认全景，俯视改为北向上并拉远，缩放下限允许查看周边。

## 离线复现

`scripts/prepare-hong-kong-coast.mjs` 读取以下临时源文件，然后生成已随项目保存的紧凑数据，正常运行 Demo 无需再次下载：

- `/tmp/skyflow-natural-earth-land.geojson`：上面的 Natural Earth GeoJSON。
- `/tmp/skyflow-regional-coast.json`：对 `https://overpass-api.de/api/interpreter` 提交 `[out:json][timeout:35];way["natural"="coastline"](22.10,113.88,22.43,114.40);out geom;` 的 JSON 响应。
- `/tmp/skyflow-hk-island.json`、`skyflow-lamma.json`、`skyflow-tsing-yi.json`、`skyflow-lantau.json`：Nominatim `/search` 的 JSON 响应，参数 `format=json&polygon_geojson=1`，分别查询 Hong Kong Island、Lamma Island Hong Kong、Tsing Yi Island Hong Kong、Lantau Island Hong Kong；处理器按 physical island 类型选择。

运行 `node scripts/prepare-hong-kong-coast.mjs`。输入缺失或主岸线连接超出允许范围时直接失败，避免静默生成错误地理。

## 验证

- `tests/hongKongCoast.test.js` 检查已知地点归属、水道留空、大陆向北连续及完整港岛南岸。
- 现有建筑、窗灯、HKU 立面和太平山小体量测试继续运行，并检查外围几何的有效性和顶点预算。
- 构建与浏览器检查涵盖北向上俯视、默认全景、日落 / 夜间、地标飞行、透明地点文字和天气照片卡片。
