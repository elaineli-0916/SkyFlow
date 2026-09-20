import { readFile, writeFile } from "node:fs/promises";
import { project, polygonArea, BOUNDS } from "../src/city/hongKongScene.js";

const filename = "public/data/hong-kong-osm.json";
const data = JSON.parse(await readFile(filename, "utf8"));
const buildings = data.features.filter((f) => {
  if (f.kind !== "building") return false;
  const points = f.points.map(project);
  const center = points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
  const area = polygonArea(points);
  return center[0] > BOUNDS.west && center[0] < BOUNDS.east && center[1] > BOUNDS.north && center[1] < BOUNDS.south
    && (area > 0.006 || (f.height > 70 && area > 0.002)) && area < 0.6;
});
data.features = [...data.features.filter(f=>f.kind === "coastline"), ...buildings];
data.note = "Bounded footprint sample; tiny structures omitted. Tagged heights retained; missing heights and terrain are stylized at render time.";
await writeFile(filename, JSON.stringify(data));
console.log(JSON.stringify({buildings:buildings.length,bytes:JSON.stringify(data).length}));
