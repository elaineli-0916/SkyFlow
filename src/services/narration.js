import { isNightAtLocation } from "../utils/astro.js";

export function buildNarration(snapshot, now, index) {
  const cloudCover = snapshot.weather?.cloudCover;
  const wind = snapshot.weather?.windSpeed;
  const night = isNightAtLocation(now, snapshot.longitude);
  const moonText = snapshot.moonPhase > 0.55 ? "月光比昨夜更清晰一些" : "月亮还在把光收得很轻";
  const sunAzimuth = snapshot.telemetry?.solar?.azimuth;

  const observations = [
    `太阳光正沿着地球的弧线移动，${night ? "你的城市落在安静的夜侧。" : "你的城市仍在日侧的浅光里。"}`,
    cloudCover == null
      ? "云层以缓慢的速度穿过海面，像一层正在呼吸的薄纱。"
      : cloudCover > 68
        ? "云层正在聚拢，地表的光被柔和地压低了一层。"
        : "云带从海面上滑过，边缘很轻，移动得不急。",
    wind && wind > 22
      ? "近地表的风比平时更快，云的边界会显得更松散。"
      : "此刻的大气没有急促的姿态，只是在稳定地流动。",
    `${moonText}，它的位置在轨道外侧缓慢偏移。`,
    sunAzimuth == null
      ? "太阳方向由本地时间模型推算，先作为光照参考。"
      : `太阳方位约为 ${Math.round(sunAzimuth)} 度，光线正从这一侧掠过地表。`,
    "亚洲东部与太平洋之间的明暗线正在缓慢交换位置。",
    "这不是静止的地图。它更像一段正在发生的时间。"
  ];

  return observations[index % observations.length];
}
