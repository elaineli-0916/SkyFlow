import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BOUNDS, project, insidePolygon, terrainHeight } from "./hongKongScene.js";

const smooth = x => {const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
const distanceFromCore = (x,z) => Math.max(0,BOUNDS.west-x,x-BOUNDS.east,BOUNDS.north-z,z-BOUNDS.south);
export function coastalPolygons(data) {
  return data.features.map(f=> {
    const rings=f.rings.map(r=>r.map(project));
    const points=rings[0];
    return {...f,rings,bounds:{minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))}};
  });
}
export function containsLand(point,polygon) {
  const [x,z]=point,b=polygon.bounds;
  return x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&insidePolygon(point,polygon.rings[0])&&!polygon.rings.slice(1).some(r=>insidePolygon(point,r));
}
function shoreDistance(x,z,polygon) {
  let distance=Infinity;
  for(const ring of polygon.rings)for(let i=1;i<ring.length;i++) {
    const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    distance=Math.min(distance,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
  }
  return distance;
}
function contextHeight(x,z,polygon) {
  const d=distanceFromCore(x,z),blend=smooth(d/5);
  const hill=(cx,cz,height,rx,rz)=>height*Math.exp(-((x-cx)**2/rx**2+(z-cz)**2/rz**2));
  // These broad terrain profiles are stylized; only the coast is geographic.
  let height=0;
  if(polygon.id==="mainland")height=Math.max(hill(-18,-38,3.2,17,10),hill(15,-35,3,16,8),hill(50,-30,2.5,14,15));
  else if(polygon.id==="hong-kong-island")height=Math.max(hill(12,18,2.5,10,7),hill(24,27,1.8,8,8),hill(-6,18,2.1,9,6));
  else if(polygon.id==="lamma")height=Math.max(hill(-22,29,1.65,6,7),hill(-11,43,1.75,6,8));
  else if(polygon.id==="lantau")height=Math.max(hill(-82,17,4,20,11),hill(-115,27,4.5,17,11));
  else if(polygon.id==="tsing-yi")height=hill(-30,-23,1.5,4,6);
  const core=terrainHeight(x,z)-.16;
  if(height*blend<.005)return .16+core*(1-blend);
  return .16+core*(1-blend)+height*blend*smooth(shoreDistance(x,z,polygon)/3.2);
}
function colorAt(x,z,height=.15) {
  const d=distanceFromCore(x,z);
  const relief=smooth((height-.16)/1.2);
  const near=new THREE.Color("#e1e4c9").lerp(new THREE.Color("#a6ba86"),relief);
  const far=new THREE.Color("#d1daca").lerp(new THREE.Color("#c4d0b3"),relief);
  return near.lerp(far,smooth(d/48)*.75);
}
function colorGeometry(geometry) {
  const positions=geometry.attributes.position,colors=[];
  for(let i=0;i<positions.count;i++)colorAt(positions.getX(i),positions.getZ(i),positions.getY(i)).toArray(colors,i*3);
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));geometry.deleteAttribute("uv");return geometry;
}
function axis(min,start,end,max) {
  const points=[];
  for(let x=min;x<start;x+=Math.abs(x)<55?.75:1.5)points.push(x);
  for(let x=start;x<end;x+=.48)points.push(x);
  points.push(end);
  for(let x=end+.75;x<max;x+=Math.abs(x)<55?.75:1.5)points.push(x);
  points.push(max);return points;
}

export function buildCoastalContext(data) {
  if(!data?.features?.length)throw new Error("Hong Kong coastline data is missing");
  const polygons=coastalPolygons(data),parts=[],shoreline=[];
  const terrainPolygons=coastalPolygons({features:data.features.filter(f=>f.terrainRings).map(f=>({...f,rings:f.terrainRings}))});
  for(const polygon of polygons) {
    const [outer,...holes]=polygon.rings;
    const shape=new THREE.Shape(outer.map(([x,z])=>new THREE.Vector2(x,-z)));
    shape.holes=holes.map(r=>new THREE.Path(r.map(([x,z])=>new THREE.Vector2(x,-z))));
    const g=new THREE.ExtrudeGeometry(shape,{depth:.4,bevelEnabled:false,curveSegments:1});
    g.rotateX(-Math.PI/2);g.translate(0,-.25,0);parts.push(colorGeometry(g));
    // The far mainland is closed at a remote data boundary; that closure is
    // never styled as a coast. All island rings retain their actual outline.
    for(const ring of polygon.rings) {
      let segment=[];
      for(let i=0;i<ring.length;i++) {
        const [x,z]=ring[i],far=polygon.id==="mainland"&&(x<-180||x>129||z<-161||z>104);
        if(far){if(segment.length>1)shoreline.push(segment);segment=[];}
        else segment.push([x,.17,z]);
      }
      if(segment.length>1)shoreline.push(segment);
    }
  }
  const land=mergeGeometries(parts);parts.forEach(g=>g.dispose());land.computeBoundingBox();
  // Coarse surfaces outside the modeled center meet its original .48 grid.
  const xs=axis(-153,BOUNDS.west,BOUNDS.east,103),zs=axis(-97,5,BOUNDS.south,78);
  const positions=[],cache=new Map();
  function height(x,z,p) {
    const key=`${x},${z}`;
    if(!cache.has(key))cache.set(key,contextHeight(x,z,p));
    return cache.get(key);
  }
  for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++) {
    const [x0,x1,z0,z1]=[xs[i-1],xs[i],zs[j-1],zs[j]];
    if(x0>=BOUNDS.west&&x1<=BOUNDS.east&&z0>=5&&z1<=BOUNDS.south)continue;
    const polygon=terrainPolygons.find(p=>containsLand([(x0+x1)/2,(z0+z1)/2],p));if(!polygon)continue;
    const corners=[[x0,z0],[x1,z0],[x0,z1],[x1,z1]];
    for(const indices of [[0,2,1],[1,2,3]]) {
      const tri=indices.map(n=>corners[n]);if(!tri.every(p=>containsLand(p,polygon)))continue;
      const vertices=tri.map(([x,z])=>[x,height(x,z,polygon),z]);
      if(vertices.every(p=>p[1]<=.175))continue;
      positions.push(...vertices.flat());
    }
  }
  const hills=new THREE.BufferGeometry();hills.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));hills.computeVertexNormals();colorGeometry(hills);hills.computeBoundingBox();
  return {land,hills,shoreline,polygons};
}
