import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BOUNDS, LANDMARKS, project, seededRandom, landPolygons, insidePolygon, terrainHeight, polygonArea } from "./hongKongScene.js";
import { buildCoastalContext } from "./hongKongCoast.js";

const cream = ["#e6e8d5", "#d7dfcc", "#eef0df", "#ccd8c9", "#e1e1ca", "#d5ded3"];
const greens = ["#6c9568", "#7fa775", "#a3b782", "#527e60", "#94ac73"];
function shapeOf(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  return shape;
}
function paint(geometry, color) {
  const c = new THREE.Color(color), count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) c.toArray(colors, i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  // A shared attribute layout lets thousands of footprints use one draw call.
  geometry.deleteAttribute("uv");
  return geometry;
}
function merged(parts) {
  if (!parts.length) return new THREE.BufferGeometry();
  const geometry = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  return geometry;
}
function block(parts, position, scale, color) {
  const geometry = new THREE.BoxGeometry(...scale).toNonIndexed();
  geometry.translate(...position);
  parts.push(paint(geometry, color));
}

// Windows and silhouette lines share two batches across the entire city.
// A separate seed keeps the existing sunset geography unchanged.
function nightFacadeBuilder() {
  const positions=[],colors=[],edges=[];
  const random=seededRandom(20909);
  const lights=["#f3ce91","#e7b86f","#c8dce0","#e9d9af"].map(c=>new THREE.Color(c));
  function building(points,base,height) {
    const winding=Math.sign(points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0))||1;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      if(length<.018)continue;
      edges.push(a[0],base,a[1],a[0],base+height,a[1],a[0],base+height,a[1],b[0],base+height,b[1]);
      const nx=dz/length*winding*.003,nz=-dx/length*winding*.003;
      const cols=Math.min(24,Math.floor(length/.068)),floors=Math.min(45,Math.floor(height/.085));
      for(let floor=0;floor<floors;floor++)for(let col=0;col<cols;col++) {
        if(random()>.46)continue;
        const t=(col+.5)/cols,cx=a[0]+dx*t+nx,cz=a[1]+dz*t+nz,cy=base+(floor+.53)*height/floors;
        const half=Math.min(.018,length/cols*.28),wx=dx/length*half,wz=dz/length*half,hy=Math.min(.02,height/floors*.23);
        const quad=[[cx-wx,cy-hy,cz-wz],[cx+wx,cy-hy,cz+wz],[cx+wx,cy+hy,cz+wz],[cx-wx,cy+hy,cz-wz]];
        const color=lights[Math.floor(random()*lights.length)];
        for(const index of [0,1,2,0,2,3]){positions.push(...quad[index]);color.toArray(colors,colors.length);}
      }
    }
  }
  function finish() {
    const windows=new THREE.BufferGeometry(),outlines=new THREE.BufferGeometry();
    windows.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    windows.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    outlines.setAttribute("position",new THREE.Float32BufferAttribute(edges,3));
    windows.computeBoundingSphere();outlines.computeBoundingSphere();
    return {windows,outlines};
  }
  return {building,finish};
}

// All base geography is built once. No map image is used by the sandbox.
export function buildHongKong(features,coastline) {
  const random = seededRandom(8803);
  const lands = landPolygons(features);
  const landParts = [], buildingParts = [], detailParts = [], shoreline = [];
  const nightFacades=nightFacadeBuilder();
  const surroundings=buildCoastalContext(coastline);
  for (const polygon of lands) {
    const geometry = new THREE.ExtrudeGeometry(shapeOf(polygon), { depth: .4, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2); geometry.translate(0, -.25, 0);
    landParts.push(paint(geometry, "#e1e4c9"));
    shoreline.push(polygon.map(([x, z]) => [x, .18, z]));
  }

  // A continuous triangulated surface, instead of overlapping cone mountains.
  const terrainPositions = [], terrainColors = [];
  const step = .48;
  for (let z = 5; z < BOUNDS.south; z += step) for (let x = BOUNDS.west; x < BOUNDS.east; x += step) {
    const corners = [[x,z],[Math.min(x+step,BOUNDS.east),z],[x,Math.min(z+step,BOUNDS.south)],[Math.min(x+step,BOUNDS.east),Math.min(z+step,BOUNDS.south)]];
    for (const indices of [[0,2,1],[1,2,3]]) {
      const tri = indices.map(i=>corners[i]);
      if (!tri.every(p=>insidePolygon(p, lands[0]))) continue;
      const h = tri.reduce((s,p)=>s+terrainHeight(...p),0)/3;
      const color = new THREE.Color(h > .4 ? "#a6ba86" : "#dce0bf");
      color.multiplyScalar(.95 + random()*.1);
      for (const [px,pz] of tri) { terrainPositions.push(px,terrainHeight(px,pz),pz); color.toArray(terrainColors, terrainColors.length); }
    }
  }
  const terrain = new THREE.BufferGeometry();
  terrain.setAttribute("position", new THREE.Float32BufferAttribute(terrainPositions,3));
  terrain.setAttribute("color", new THREE.Float32BufferAttribute(terrainColors,3)); terrain.computeVertexNormals();

  const footprints = [];
  let buildingCount = 0;
  for (const feature of features) {
    if (feature.kind !== "building") continue;
    const points = feature.points.map(project);
    if (points.length < 4) continue;
    const center = points.slice(0,-1).reduce((s,p)=>[s[0]+p[0]/(points.length-1),s[1]+p[1]/(points.length-1)],[0,0]);
    const [x,z] = center, area = polygonArea(points);
    if (!lands.some(p=>insidePolygon(center,p))) continue;
    // Bespoke silhouettes replace their source footprints, avoiding double towers.
    if (LANDMARKS.some(l=>l.id!=="harbour" && Math.hypot(x-l.point[0],z-l.point[1]) < (l.clearRadius ?? (l.id === "convention" ? .64 : l.id === "clock" ? .26 : .3)))) continue;
    const base = terrainHeight(x,z);
    let height = feature.height ? Math.min(3.9, feature.height * .009) : .13 + random()*.53 + (area > .028 ? random()*.55 : 0);
    if (base > 1.1) height = Math.min(height,.32);
    const geometry = new THREE.ExtrudeGeometry(shapeOf(points), { depth:height, bevelEnabled:false, steps:1, curveSegments:1 });
    geometry.rotateX(-Math.PI/2); geometry.translate(0,base,0);
    buildingParts.push(paint(geometry,cream[Math.floor(random()*cream.length)])); buildingCount++;
    nightFacades.building(points,base,height);
    footprints.push({points,center,radius:Math.max(...points.map(p=>Math.hypot(p[0]-x,p[1]-z)))});
    const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
    const minZ=Math.min(...points.map(p=>p[1])),maxZ=Math.max(...points.map(p=>p[1]));
    // Roof plant and tiny raised cores make close views feel like a model.
    if (area > .012 && height > .35) block(detailParts,[x,base+height+.035,z],[(maxX-minX)*.33,.07,(maxZ-minZ)*.3],"#bdcaba");
    if (height > .7 && points.length <= 8) {
      // Thin facade rails follow the real footprint, not a texture plane.
      for (let i=1;i<points.length;i++) {
        const a=points[i-1],b=points[i],length=Math.hypot(a[0]-b[0],a[1]-b[1]);
        if(length<.045 || length>.7) continue;
        for(let floor=.18;floor<height-.05;floor+=.14) {
          const rail = new THREE.BoxGeometry(length,.011,.008).toNonIndexed();
          rail.rotateY(-Math.atan2(b[1]-a[1],b[0]-a[0])); rail.translate((a[0]+b[0])/2,base+floor,(a[1]+b[1])/2);
          detailParts.push(paint(rail,"#a5bbae"));
        }
      }
    }
  }

  // Spatial buckets keep tree/footprint collision checks cheap and deterministic.
  const buckets = new Map();
  for (const f of footprints) {
    const key=`${Math.floor(f.center[0])},${Math.floor(f.center[1])}`;
    if(!buckets.has(key)) buckets.set(key,[]); buckets.get(key).push(f);
  }
  function clearOfBuildings(x,z) {
    for(let dx=-1;dx<=1;dx++) for(let dz=-1;dz<=1;dz++) {
      for(const f of buckets.get(`${Math.floor(x)+dx},${Math.floor(z)+dz}`) ?? []) {
        if(Math.hypot(x-f.center[0],z-f.center[1])<f.radius+.035) return false;
      }
    }
    return !LANDMARKS.some(l=>Math.hypot(x-l.point[0],z-l.point[1])<(l.clearRadius ?? .5));
  }
  const trees=[];
  for(let i=0;i<12500 && trees.length<1900;i++) {
    const x=BOUNDS.west+random()*(BOUNDS.east-BOUNDS.west),z=BOUNDS.north+random()*(BOUNDS.south-BOUNDS.north);
    if(!lands.some(p=>insidePolygon([x,z],p))) continue;
    const y=terrainHeight(x,z);
    if(y<.35 && random()>.12) continue;
    if(!clearOfBuildings(x,z)) continue;
    trees.push({position:[x,y,z],size:.12+random()*.16,color:greens[Math.floor(random()*greens.length)],pine:random()>.55,rotation:random()*6.28});
  }
  return {land:merged(landParts),terrain,buildings:merged(buildingParts),details:merged(detailParts),...nightFacades.finish(),surroundings,shoreline,trees,buildingCount};
}

export function disposeHongKong(data) {
  for (const key of ["land","terrain","buildings","details","windows","outlines"]) data[key]?.dispose();
  data.surroundings?.land?.dispose();data.surroundings?.hills?.dispose();
}
