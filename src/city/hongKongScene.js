// Coordinates in this study use a local east / south plane (4 units per km).
// Footprints/coastline: OSM. Terrain profiles and untagged heights are art-directed.
export const project = ([lon, lat]) => [(lon - 114.166) * 412, (22.295 - lat) * 444.8];
export const BOUNDS = { west: -14, east: 14, north: -11.5, south: 12.4 };
export const LANDMARKS = [
  { id: "harbour", label: "维多利亚港", en: "Victoria Harbour", point: [0.5, 2.2], height: 0.1, zoom: 1, description: "海风穿过两岸，把山、城和人连接在一起。" },
  { id: "ifc", label: "国际金融中心", en: "IFC · Central", point: project([114.1595, 22.2852]), height: 3.95, zoom: 2.65, targetHeight:1.65, description: "沿中环海岸靠近，细长的塔楼在港湾边升起。" },
  { id: "bank", label: "中银大厦", en: "Bank of China Tower", point: project([114.1616, 22.2794]), height: 3.7, zoom: 2.8, targetHeight:1.45, description: "三角形的玻璃切面，让中环的天际线有了清晰的折角。" },
  { id: "peak", label: "太平山顶", en: "Victoria Peak", point: project([114.1497, 22.2759]), height: .7, zoom: 5.2, targetHeight:.26, view:[9,17,-25], clearRadius:.62, description: "沿山径抵达小小的观景台，把这一刻留给山风与海港。" },
  { id: "icc", label: "环球贸易广场", en: "ICC · West Kowloon", point: project([114.1602, 22.3034]), height: 4.55, zoom: 2.6, targetHeight:1.9, description: "从西九龙看向海港，一座修长的塔楼与对岸遥相呼应。" },
  { id: "clock", label: "尖沙咀钟楼", en: "Tsim Sha Tsui", point: project([114.1694, 22.2935]), height: 0.75, zoom: 2.3, description: "码头、钟楼和缓缓靠岸的渡轮，把城市的节奏放慢。" },
  { id: "convention", label: "香港会展中心", en: "HKCEC · Wan Chai", point: project([114.1730, 22.2834]), height: 1, zoom: 2.8, description: "弧形屋顶伸向水面，像一只停在海港边的白色飞鸟。" },
  { id: "hku", label: "香港大学", en: "HKU · Main Building", point: project([114.13775, 22.28413]), height:1.36, zoom:5.2, view:[-9,22,-23], targetHeight:.38, clearRadius:1.15, description:"沿着红砖拱廊靠近，窗棂、石柱和中央钟楼慢慢显露。" }
];

// Stable local attachment points for future personal photos / footsteps.
// These belong to the stylized sandbox, not surveyed geographic elevations.
export const PEAK_ANCHORS = [
  {id:"peak-sky-terrace",label:"山顶观景台",kind:"photo",offset:[0,.615,0],surface:"building"},
  {id:"peak-arrival",label:"山径入口",kind:"footstep",offset:[-.45,.025,-.37],surface:"terrain"},
  {id:"peak-harbour-view",label:"维港取景点",kind:"photo",offset:[.23,.025,-.56],surface:"terrain"}
];

export function getPeakAnchor(id) {
  const anchor=PEAK_ANCHORS.find(a=>a.id===id);
  if(!anchor)return null;
  const peak=LANDMARKS.find(l=>l.id==="peak"),[dx,dy,dz]=anchor.offset;
  const x=peak.point[0]+dx,z=peak.point[1]+dz;
  return {...anchor,position:[x,(anchor.surface==="terrain"?terrainHeight(x,z):terrainHeight(...peak.point))+dy,z]};
}

export function seededRandom(seed) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}

export function polygonArea(points) {
  return Math.abs(points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2;
}

export function insidePolygon([x, z], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

// Join directed OSM coast ways; open chains are closed along the study boundary.
export function coastChains(features) {
  const lines = features.filter(f => f.kind === "coastline").map(f => f.points.map(project));
  const same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.003;
  const chains = [];
  while (lines.length) {
    let line = lines.pop();
    let found = true;
    while (found) {
      found = false;
      for (let i = 0; i < lines.length; i++) {
        const next = lines[i];
        if (same(line.at(-1), next[0])) { line = line.concat(next.slice(1)); lines.splice(i, 1); found = true; break; }
        if (same(next.at(-1), line[0])) { line = next.concat(line.slice(1)); lines.splice(i, 1); found = true; break; }
      }
    }
    chains.push(line);
  }
  return chains;
}

export function landPolygons(features) {
  let chains = coastChains(features).filter(p=>p.length > 40 && Math.hypot(p[0][0]-p.at(-1)[0], p[0][1]-p.at(-1)[1]) > 0.05);
  // Harbours interrupt a few coastline ways; bridge small pier mouths in the study.
  for (let pass = 0; pass < 10; pass++) {
    let joined = false;
    for (let i = 0; i < chains.length && !joined; i++) for (let j = 0; j < chains.length; j++) {
      if (i === j) continue;
      const a = chains[i].at(-1), b = chains[j][0];
      if (Math.hypot(a[0]-b[0], a[1]-b[1]) < 1.25) {
        chains[i] = chains[i].concat(chains[j]); chains.splice(j,1); joined = true; break;
      }
    }
    if (!joined) break;
  }
  const south = chains.filter(p=>p.every(v=>v[1]>-1)).sort((a,b)=>b.length-a.length)[0];
  const north = chains.filter(p=>p.some(v=>v[1]<-13)).sort((a,b)=>b.length-a.length)[0];
  if (!south || !north) throw new Error("Hong Kong coastline data is incomplete");
  const island = [...south, [south.at(-1)[0], 14], [south[0][0], 14]];
  const kowloon = [...north, [north.at(-1)[0], -16], [north[0][0], -16]];
  return [clipPolygon(island), clipPolygon(kowloon)];
}

function clipPolygon(polygon) {
  let result = polygon;
  for (const [axis, edge, sign] of [[0,BOUNDS.west,1],[0,BOUNDS.east,-1],[1,BOUNDS.north,1],[1,BOUNDS.south,-1]]) {
    const input = result; result = [];
    for (let i=0;i<input.length;i++) {
      const a=input[i], b=input[(i+1)%input.length];
      const ai=(a[axis]-edge)*sign>=0, bi=(b[axis]-edge)*sign>=0;
      if(ai) result.push(a);
      if(ai!==bi) { const t=(edge-a[axis])/(b[axis]-a[axis]); result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]); }
    }
  }
  return result;
}

export function terrainHeight(x, z) {
  if (z < 5) return 0.16;
  const peak = 3.7 * Math.exp(-((x + 7) ** 2 / 15 + (z - 9.4) ** 2 / 9));
  const ridge = 2.15 * Math.exp(-((x - 0.5) ** 2 / 22 + (z - 12) ** 2 / 6));
  const east = 1.65 * Math.exp(-((x - 10) ** 2 / 24 + (z - 11.8) ** 2 / 9));
  const taper = Math.min(1, (z - 5) / 2);
  return 0.16 + Math.max(peak, ridge, east) * taper;
}
