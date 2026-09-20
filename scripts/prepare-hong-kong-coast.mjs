import { readFile, writeFile } from "node:fs/promises";
import { coastChains, insidePolygon, polygonArea } from "../src/city/hongKongScene.js";

// Offline preparation only. The demo loads the compact result without an API.
// Inputs: Natural Earth 10m land, Overpass coastline ways, and Nominatim islands.
const read = async path => JSON.parse(await readFile(path, "utf8"));
const signedArea = points => points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;
const openRing = p => p.slice(0, p[0][0]===p.at(-1)[0]&&p[0][1]===p.at(-1)[1]?-1:undefined);
function clip(points, bounds) {
  let result=openRing(points);
  for(const [axis,edge,sign] of [[0,bounds[0],1],[0,bounds[2],-1],[1,bounds[1],1],[1,bounds[3],-1]]) {
    const input=result;result=[];
    for(let i=0;i<input.length;i++) {
      const a=input[i],b=input[(i+1)%input.length],ai=(a[axis]-edge)*sign>=0,bi=(b[axis]-edge)*sign>=0;
      if(ai)result.push(a);
      if(ai!==bi){const t=(edge-a[axis])/(b[axis]-a[axis]);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    }
  }
  return result;
}
function nearest(point,ring) {
  let best={distance:Infinity};
  for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
    const p=[a[0]+dx*t,a[1]+dy*t],distance=Math.hypot(p[0]-point[0],p[1]-point[1]);
    if(distance<best.distance)best={index:i,point:p,distance};
  }
  return best;
}
function simplify(points,tolerance) {
  if(points.length<=2)return points;
  const [a,b]=[points[0],points.at(-1)],dx=b[0]-a[0],dy=b[1]-a[1];let max=tolerance,index=-1;
  for(let i=1;i<points.length-1;i++) {
    const p=points[i],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
    const d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
    if(d>max){max=d;index=i;}
  }
  return index<0?[a,b]:[...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)];
}
function ring(points,tolerance=.00012) {
  const opened=openRing(points),p=simplify([...opened,opened[0]],tolerance);
  return p.map(point=>point.map(v=>Number(v.toFixed(6))));
}
const natural=await read("/tmp/skyflow-natural-earth-land.geojson");
const naturalPolygons=natural.features.flatMap(f=>f.geometry.type==="MultiPolygon"?f.geometry.coordinates:[f.geometry.coordinates]);
let mainland=clip(naturalPolygons.find(p=>insidePolygon([114.17,22.32],p[0]))[0],[113.72,22.06,114.48,22.66]);
if(signedArea(mainland)<0)mainland.reverse();

// Replace the entire near mainland arc, including both harbour entrances.
// Using the directed coastline keeps Kowloon connected north to New Territories.
const regional=await read("/tmp/skyflow-regional-coast.json");
const ways=regional.elements.filter(e=>e.type==="way").map(e=>({kind:"coastline",points:e.geometry.map(p=>[p.lon,p.lat])}));
const chains=coastChains(ways),unproject=([x,z])=>[x/412+114.166,22.295-z/444.8];
const closed=p=>Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<.003;
const north=chains.filter(p=>!closed(p)&&p.some(v=>v[1]<-13)).sort((a,b)=>b.length-a.length)[0].map(unproject);
const a=nearest(north[0],mainland),b=nearest(north.at(-1),mainland);
if(a.distance>.025||b.distance>.025)throw new Error("Harbour shore does not align with mainland");
const rest=[];let i=(b.index+1)%mainland.length;
while(i!==(a.index+1)%mainland.length){rest.push(mainland[i]);i=(i+1)%mainland.length;}
mainland=[a.point,...north,b.point,...rest];
const features=[{id:"mainland",label:"九龙 · 新界",source:"OpenStreetMap regional coast + Natural Earth distant coast",rings:[ring(mainland,.00006)]}];
for(const [file,id,label] of [["hk-island","hong-kong-island","香港岛"],["lamma","lamma","南丫岛"],["tsing-yi","tsing-yi","青衣岛"],["lantau","lantau","大屿山"]]) {
  const result=(await read(`/tmp/skyflow-${file}.json`)).find(x=>x.type==="island"&&["Polygon","MultiPolygon"].includes(x.geojson?.type));
  if(!result)throw new Error(`Missing physical island: ${id}`);
  const polygons=result.geojson.type==="Polygon"?[result.geojson.coordinates]:result.geojson.coordinates;
  polygons.sort((a,b)=>polygonArea(b[0])-polygonArea(a[0]));
  for(const [index,p] of polygons.entries()) {
    if(index>0&&polygonArea(p[0])<.000005)continue;
    features.push({id:index===0?id:`${id}-${index}`,label,source:`OpenStreetMap ${result.osm_type}/${result.osm_id}`,rings:p.map(r=>ring(r,id==="hong-kong-island"?.000035:.00012))});
  }
}
for(const [index,p] of chains.entries()) {
  if(!closed(p)||polygonArea(p)<.035)continue;
  const coords=p.map(unproject),center=coords.reduce((s,p)=>[s[0]+p[0]/coords.length,s[1]+p[1]/coords.length],[0,0]);
  if(features.some(f=>insidePolygon(center,f.rings[0])))continue;
  // Concave islands can have a vertex mean in the sea (notably Lamma).
  // Area and bounds detect their duplicate way ring independently of that mean.
  const bounds=r=>[Math.min(...r.map(p=>p[0])),Math.min(...r.map(p=>p[1])),Math.max(...r.map(p=>p[0])),Math.max(...r.map(p=>p[1]))];
  const box=bounds(coords),area=polygonArea(coords);
  if(features.some(f=>Math.abs(polygonArea(f.rings[0])-area)/area<.03&&bounds(f.rings[0]).every((v,i)=>Math.abs(v-box[i])<.001)))continue;
  const simplified=ring(coords);if(simplified.length<4||polygonArea(simplified)<1e-10)continue;
  features.push({id:`osm-islet-${index}`,label:"周边岛屿",source:"OpenStreetMap coastline ways",rings:[simplified]});
}
// Retain other small real islands, but never duplicate the four detailed ones
// or reintroduce the pre-reclamation Stonecutters Island in the core district.
for(const [index,p] of naturalPolygons.entries()) {
  const coords=p[0];if(coords.length>500||!coords.every(([x,y])=>x>113.85&&x<114.4&&y>22.1&&y<22.5))continue;
  const center=coords.reduce((s,p)=>[s[0]+p[0]/coords.length,s[1]+p[1]/coords.length],[0,0]);
  if(center[0]>113.88&&center[0]<114.40&&center[1]>22.10&&center[1]<22.43)continue;
  if(features.some(f=>insidePolygon(center,f.rings[0])||insidePolygon(f.rings[0][0],coords)))continue;
  if(center[0]>114.12&&center[0]<114.2&&center[1]>22.3&&center[1]<22.33)continue;
  features.push({id:`islet-${index}`,label:"周边岛屿",source:"Natural Earth",rings:[ring(coords)]});
}
// Relief is deliberately coarse. Its sampling mask need not walk every pier
// vertex; the rendered land and shoreline always use the detailed rings above.
for(const f of features)if(["mainland","hong-kong-island","lamma","tsing-yi","lantau"].includes(f.id))f.terrainRings=f.rings.map(r=>ring(r,.00065));
const result={source:"OpenStreetMap contributors; Natural Earth",license:"ODbL-1.0 (OSM); public domain (Natural Earth)",preparedAt:new Date().toISOString(),reference:"https://www.google.com/maps/@22.29,114.155,11z",note:"Physical land only. Mainland distant coast generalized; regional coast and main islands use OSM. Heights are stylized.",features};
await writeFile(new URL("../public/data/hong-kong-coast.json",import.meta.url),JSON.stringify(result));
console.log({features:features.length,points:features.reduce((s,f)=>s+f.rings.reduce((n,r)=>n+r.length,0),0),bytes:JSON.stringify(result).length,harbourJoinsMeters:[a.distance,b.distance].map(d=>Math.round(d*111000))});
