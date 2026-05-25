export function buildNarration(snapshot, now, index) {
  const lines = buildRealtimeNarrationLines(snapshot, now);
  return lines[index % lines.length];
}

function buildRealtimeNarrationLines(snapshot, now) {
  const solar = snapshot.telemetry?.solar ?? {};
  const lunar = snapshot.telemetry?.lunar ?? {};
  const weather = snapshot.weather ?? {};
  const localHour = getLocalHour(now, snapshot.longitude, snapshot.locationTimezone);
  const cloudCover = Number.isFinite(weather.cloudCover) ? Math.round(weather.cloudCover) : null;
  const moonAltitude = Number.isFinite(lunar.altitude) ? Math.round(lunar.altitude) : null;
  const sunAltitude = Number.isFinite(solar.altitude) ? Math.round(solar.altitude) : null;
  const phase = Math.round((snapshot.moonPhase ?? 0) * 100);
  const timeTone = getTimeTone(localHour, sunAltitude);
  const lines = [
    `此刻 ${snapshot.locationName} 正在${timeTone}里，地球把这片天空轻轻托在轨道上。`,
    cloudCover == null
      ? "云层数据还在抵达，但地球表面的光影已经开始说明此刻的天气。"
      : cloudCover > 75
        ? `云量约 ${cloudCover}%，天空被云层压低，光变得更安静。`
        : cloudCover > 35
          ? `云量约 ${cloudCover}%，云正在经过，而不是停留。`
          : `云量约 ${cloudCover}%，天空留出了足够的空白让光经过。`,
    moonAltitude == null
      ? "月亮的位置还在估算中，但它仍然在这个夜晚的几何关系里。"
      : moonAltitude >= 0
        ? `月亮在地平线上方 ${moonAltitude}°，像一枚缓慢移动的坐标。`
        : `月亮还在地平线下 ${Math.abs(moonAltitude)}°，夜色已经为它留出位置。`,
    `月相约 ${phase}% 被照亮，天空没有要求它永远完整。`,
    getSunLine(snapshot, sunAltitude),
    "地球没有切换场景，只是在更大的尺度上继续转动。"
  ];

  return lines.filter(Boolean);
}

function getSunLine(snapshot, sunAltitude) {
  if (!Number.isFinite(sunAltitude)) return "太阳几何还在更新，昼夜边界仍然沿着地表缓慢移动。";
  if (sunAltitude > 8) return `太阳高度约 ${Math.round(sunAltitude)}°，白昼正在地表展开。`;
  if (sunAltitude >= -6) return "太阳贴近地平线，天空正在交接白昼和夜晚。";
  return "太阳已经落到地平线下，城市灯光开始在夜面上变清楚。";
}

function getTimeTone(localHour, sunAltitude) {
  if (Number.isFinite(sunAltitude) && sunAltitude < -6) return "夜色";
  if (localHour >= 5 && localHour < 10) return "清晨";
  if (localHour >= 10 && localHour < 17) return "白昼";
  if (localHour >= 17 && localHour < 20) return "黄昏";
  return "夜色";
}

function getLocalHour(date, longitude, timeZone) {
  if (timeZone) {
    const value = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone
    }).format(date);
    return Number(value);
  }

  return (date.getUTCHours() + longitude / 15 + 24) % 24;
}
