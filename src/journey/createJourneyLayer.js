import { Cartesian3, Color, ArcType, SceneTransforms, EllipsoidalOccluder } from "cesium";
import { JOURNEY_STOPS, journeyArc } from "./journeyData.js";

export function createJourneyLayer(viewer,memories,{onPoints,onInteract}){
  const canvas=viewer.canvas;
  const ids=[],routes=[],hidden=[];
  const routePositions=[];
  for(const id of ["hong-kong","beijing","new-york"]){const entity=viewer.entities.getById(id);if(entity){hidden.push([entity,entity.show]);entity.show=false;}}
  for(let i=1;i<JOURNEY_STOPS.length;i++){
    const positions=journeyArc(JOURNEY_STOPS[i-1],JOURNEY_STOPS[i],i).map(p=>Cartesian3.fromDegrees(p.longitude,p.latitude,p.height));
    routePositions.push(positions);
    const entity=viewer.entities.add({id:`journey-arc-${i}`,polyline:{positions,arcType:ArcType.NONE,width:1,material:Color.fromCssColorString("#d5c299").withAlpha(.055)}});
    ids.push(entity);routes.push(entity);
  }
  const uniqueStops=JOURNEY_STOPS.filter((s,i,list)=>list.findIndex(p=>p.city===s.city)===i);
  const points=[...memories.map(m=>({id:m.id,city:m.city,memory:true,position:Cartesian3.fromDegrees(m.longitude,m.latitude,30)})),...uniqueStops.map(s=>({id:`stop-${s.city}`,city:s.city,memory:false,position:Cartesian3.fromDegrees(s.longitude,s.latitude,30)}))];
  const occluder=new EllipsoidalOccluder(viewer.scene.globe.ellipsoid,viewer.camera.positionWC);
  let previous="",dead=false,active=-1;
  function project(){
    if(dead)return;
    // Project every rendered frame: a reduced-motion jump may only render
    // once, so a time throttle can leave the previous city's pins on screen.
    const rect=canvas.getBoundingClientRect();
    const close=viewer.camera.positionCartographic.height<350000;
    routes.forEach(r=>{r.show=!close;});
    occluder.cameraPosition=viewer.camera.positionWC;
    const visible=points.flatMap(p=>{
      if(!occluder.isPointVisible(p.position))return [];
      const screen=SceneTransforms.worldToWindowCoordinates(viewer.scene,p.position);
      if(!screen||screen.x<0||screen.y<0||screen.x>viewer.canvas.clientWidth||screen.y>viewer.canvas.clientHeight)return [];
      return [{id:p.id,city:p.city,memory:p.memory,close,x:Math.round(screen.x+rect.left),y:Math.round(screen.y+rect.top)}];
    });
    const signature=JSON.stringify(visible);if(signature!==previous){previous=signature;onPoints(visible);}
  }
  const remove=viewer.scene.postRender.addEventListener(project);
  // Capture input before Cesium's handler so a user can take control of an
  // in-flight camera with the very first drag/wheel gesture.
  canvas.addEventListener("pointerdown",onInteract,true);
  canvas.addEventListener("wheel",onInteract,{passive:true,capture:true});
  viewer.scene.requestRender();
  return {
    setActive(index){active=index;routes.forEach((r,i)=>{r.polyline.positions=routePositions[i];r.polyline.width=index===i+1?2:1;r.polyline.material=Color.fromCssColorString("#d5c299").withAlpha(index<0?.055:index>=8?.42:index===i+1?.85:i<index?.3:.025);});viewer.scene.requestRender();},
    setProgress(t){if(active>0&&active<8){const positions=routePositions[active-1];routes[active-1].polyline.positions=positions.slice(0,Math.max(2,Math.ceil(t*positions.length)));}},
    dispose(){dead=true;remove();canvas.removeEventListener("pointerdown",onInteract,true);canvas.removeEventListener("wheel",onInteract,true);if(!viewer.isDestroyed()){ids.forEach(e=>viewer.entities.remove(e));hidden.forEach(([e,show])=>e.show=show);viewer.scene.requestRender();}}
  };
}
