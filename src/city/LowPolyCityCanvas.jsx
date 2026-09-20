import { Component, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import { ArrowUpRight, Globe2, Moon, Sunset, Minus, Plus, Compass, Map, Move, RotateCcw, MapPin, Trees, Maximize2, Info, X, ChevronLeft, ChevronRight } from "lucide-react";
import * as THREE from "three";
import { LANDMARKS, terrainHeight, getPeakAnchor } from "./hongKongScene.js";
import { project } from "./hongKongScene.js";
import { buildHongKong, disposeHongKong } from "./hongKongGeometry.js";
import { HongKongLandmarks, Ferries } from "./HongKongLandmarks.jsx";
import memories from "../journey/memories.json";
import { memoryIsOpen } from "../journey/journeyCamera.js";

const HK_MEMORIES=memories.filter(memory=>memory.city==="hong-kong");
const HK_PHOTO_GROUPS=Object.values(HK_MEMORIES.reduce((groups,memory)=>{
  const key=`${memory.latitude.toFixed(5)}:${memory.longitude.toFixed(5)}`;
  (groups[key]??={id:`hk-memory-${key.replace(/[^0-9-]+/g,"-")}`,latitude:memory.latitude,longitude:memory.longitude,memories:[]}).memories.push(memory);
  return groups;
},{}));

function InstancedTrees({trees}) {
  const trunks=useRef(),crowns=useRef(),pines=useRef();
  useEffect(()=> {
    const matrix=new THREE.Object3D(),color=new THREE.Color();
    trees.forEach((tree,i)=> {
      const [x,y,z]=tree.position,s=tree.size;
      matrix.position.set(x,y+s*.4,z);matrix.scale.set(s*.12,s*.8,s*.12);matrix.rotation.set(0,tree.rotation,0);matrix.updateMatrix();trunks.current.setMatrixAt(i,matrix.matrix);
      matrix.position.y=y+s*1.27;matrix.scale.set(s*.7,s*(tree.pine?1.25:.8),s*.7);matrix.updateMatrix();
      const active=tree.pine?pines.current:crowns.current,inactive=tree.pine?crowns.current:pines.current;
      active.setMatrixAt(i,matrix.matrix);active.setColorAt(i,color.set(tree.color));
      matrix.scale.setScalar(0);matrix.updateMatrix();inactive.setMatrixAt(i,matrix.matrix);
    });
    for(const ref of [trunks,crowns,pines]){ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere();if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;}
  },[trees]);
  return <group>
    <instancedMesh ref={trunks} args={[null,null,trees.length]} castShadow><cylinderGeometry args={[.7,1,1,5]}/><meshStandardMaterial color="#948966" roughness={1}/></instancedMesh>
    <instancedMesh ref={crowns} args={[null,null,trees.length]} castShadow receiveShadow><icosahedronGeometry args={[1,0]}/><meshStandardMaterial flatShading roughness={1}/></instancedMesh>
    <instancedMesh ref={pines} args={[null,null,trees.length]} castShadow receiveShadow><coneGeometry args={[1,2,6]}/><meshStandardMaterial flatShading roughness={1}/></instancedMesh>
  </group>;
}

function Geography({data,forest,night}) {
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.1,.45]} receiveShadow><planeGeometry args={[420,420]}/><meshStandardMaterial color={night?"#244b5b":"#7db7ac"} roughness={night?.32:.48} metalness={night?.2:.04}/></mesh>
    <mesh geometry={data.surroundings.land} receiveShadow><meshStandardMaterial color={night?"#607585":"#ffffff"} vertexColors roughness={1}/></mesh>
    <mesh geometry={data.surroundings.hills} receiveShadow><meshStandardMaterial color={night?"#809c9b":"#ffffff"} vertexColors roughness={1} flatShading/></mesh>
    {data.surroundings.shoreline.map((points,i)=><Line key={`coast-${i}`} points={points} color={night?"#80aebd":"#efe8ca"} transparent opacity={night?.4:.7} lineWidth={1}/>)}
    <mesh geometry={data.terrain} receiveShadow castShadow><meshStandardMaterial color={night?"#809c9b":"#ffffff"} vertexColors roughness={1} flatShading side={THREE.DoubleSide}/></mesh>
    <mesh geometry={data.buildings} castShadow receiveShadow><meshStandardMaterial color={night?"#8dabbc":"#ffffff"} vertexColors roughness={.86} flatShading/></mesh>
    <mesh geometry={data.details} receiveShadow><meshStandardMaterial color={night?"#a1b8c0":"#ffffff"} vertexColors roughness={.8}/></mesh>
    {night&&<group name="city-night-facades">
      <mesh geometry={data.windows}><meshBasicMaterial vertexColors side={THREE.DoubleSide} toneMapped={false}/></mesh>
      <lineSegments geometry={data.outlines}><lineBasicMaterial color="#9dc6d5" transparent opacity={.16} depthWrite={false}/></lineSegments>
    </group>}
    {forest && <InstancedTrees trees={data.trees}/>}
    <Line points={[[-3,.02,2.6],[-2,.02,2.25],[-.5,.02,1.8],[.9,.02,1.2]]} color={night?"#668c9d":"#c2ddcc"} dashed dashSize={.065} gapSize={.1} lineWidth={1}/>
    {[-7,-4,3,7,10].map((x,i)=><Line key={x} points={[[x,.001,1-i*.12],[x+.4,.001,.97-i*.12],[x+.75,.001,1-i*.12]]} color={night?"#497386":"#9bc9b9"} lineWidth={.8}/>)}
    <HongKongLandmarks night={night}/>
  </group>;
}

function SceneBridge({onReady,onAutoChange,reducedMotion,dragMode}) {
  const controls=useRef(),flight=useRef(),orbit=useRef(false),autoTour=useRef(false);
  const {camera,size}=useThree();
  const baseZoom=useRef(26);
  useEffect(()=> {baseZoom.current=Math.min(size.width/(size.width<700?34:45),size.height/28);camera.zoom=baseZoom.current;camera.updateProjectionMatrix();},[camera,size]);
  useEffect(()=> {
    const cancel=()=>{const f=flight.current;if(f){flight.current=null;f.cleanup();f.reject(new DOMException("Flight cancelled","AbortError"));}};
    const animate=(target,offset,zoom,{signal,duration=1.65}={})=>new Promise((resolve,reject)=> {
      cancel();orbit.current=false;autoTour.current=false;onAutoChange?.(false);
      if(signal?.aborted){reject(new DOMException("Flight cancelled","AbortError"));return;}
      controls.current?.update();
      const cleanup=()=>signal?.removeEventListener("abort",cancel);
      const nextTarget=new THREE.Vector3(...target);
      flight.current={start:performance.now(),duration:reducedMotion?0:duration,from:camera.position.clone(),fromTarget:controls.current.target.clone(),fromZoom:camera.zoom,to:nextTarget.clone().add(new THREE.Vector3(...offset)),toTarget:nextTarget,toZoom:baseZoom.current*zoom,cleanup,resolve,reject};
      signal?.addEventListener("abort",cancel,{once:true});
    });
    const overview=(options)=>animate([-1.3,0,.6],[13,22,-29],1,options);
    const api={
      flyToCity:(_city,options)=>overview(options),reset:(signal)=>overview({signal}),cancel,
      focusLandmark:(id,options)=>{const l=LANDMARKS.find(l=>l.id===id);if(!l)return Promise.reject(new Error("Unknown landmark"));return id==="harbour"?overview(options):animate([l.point[0],terrainHeight(...l.point)+(l.targetHeight??.5),l.point[1]],l.view??[11,19,-25],l.zoom,options);},
      getAnchor:getPeakAnchor,
      focusAnchor:(id,options)=>{const anchor=getPeakAnchor(id);return anchor?animate(anchor.position,[9,17,-25],5.2,options):Promise.reject(new Error("Unknown site anchor"));},
      setView:(view)=>view==="top"?animate([-12,0,11],[0,60,.1],.38):overview(),
      orbit:()=>{cancel();autoTour.current=false;orbit.current=!orbit.current;onAutoChange?.(orbit.current);return orbit.current;},
      startAutoTour:()=>{if(reducedMotion)return false;cancel();orbit.current=true;autoTour.current=true;onAutoChange?.(true);return true;},
      stopAutoTour:()=>{autoTour.current=false;orbit.current=false;onAutoChange?.(false);},
      zoom:(factor)=>{cancel();autoTour.current=false;orbit.current=false;onAutoChange?.(false);camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,baseZoom.current*.22,baseZoom.current*6);camera.updateProjectionMatrix();}
    };
    onReady(api);
    return ()=>{cancel();onReady(null);};
  },[camera,onReady,onAutoChange,reducedMotion]);
  useFrame((_,delta)=> {
    const f=flight.current;
    if(f){const t=f.duration===0?1:Math.min(1,(performance.now()-f.start)/(f.duration*1000)),e=t*t*(3-2*t);camera.position.lerpVectors(f.from,f.to,e);controls.current.target.lerpVectors(f.fromTarget,f.toTarget,e);camera.zoom=THREE.MathUtils.lerp(f.fromZoom,f.toZoom,e);camera.updateProjectionMatrix();controls.current.update();if(t===1){flight.current=null;f.cleanup();f.resolve();}}
    if(orbit.current && !reducedMotion){
      const offset=camera.position.clone().sub(controls.current.target);
      offset.applyAxisAngle(new THREE.Vector3(0,1,0),delta*(autoTour.current?.014:.045));
      camera.position.copy(controls.current.target).add(offset);
      if(autoTour.current){camera.zoom=Math.min(baseZoom.current*1.22,camera.zoom+delta*.018);camera.updateProjectionMatrix();}
      controls.current.update();
    }
  });
  return <OrbitControls ref={controls} target={[-1.3,0,.6]} enablePan screenSpacePanning={false}
    mouseButtons={{LEFT:dragMode==="pan"?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:dragMode==="pan"?THREE.MOUSE.ROTATE:THREE.MOUSE.PAN}}
    touches={{ONE:dragMode==="pan"?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE,TWO:dragMode==="pan"?THREE.TOUCH.DOLLY_ROTATE:THREE.TOUCH.DOLLY_PAN}}
    enableDamping dampingFactor={.09} minZoom={baseZoom.current*.22} maxZoom={baseZoom.current*6} minPolarAngle={.01} maxPolarAngle={Math.PI*.445} onStart={()=>{orbit.current=false;autoTour.current=false;onAutoChange?.(false);const f=flight.current;if(f){flight.current=null;f.cleanup();f.reject(new DOMException("Camera interrupted","AbortError"));}}}/>;
}

function PhotoMemoryLayer({night,autoMemoryId}) {
  return <group name="hk-photo-memory-pins">
    {HK_PHOTO_GROUPS.map(group=>{
      const [x,z]=project([group.longitude,group.latitude]);
      const y=z>5?terrainHeight(x,z)+.38:.42;
      return <PhotoMemoryPin key={group.id} memories={group.memories} position={[x,y,z]} night={night} autoMemoryId={autoMemoryId}/>;
    })}
  </group>;
}

function PhotoMemoryPin({memories:album,position,night,autoMemoryId}) {
  const [expanded,setExpanded]=useState(false),[manual,setManual]=useState(null),[cardSide,setCardSide]=useState("right"),[index,setIndex]=useState(0);
  const [failed,setFailed]=useState(false);
  const [cardPosition,setCardPosition]=useState({left:18,top:18});
  const {camera,size}=useThree();
  const memory=album[index]??album[0];
  useEffect(()=>{const next=album.findIndex(m=>m.id===autoMemoryId);if(next>=0)setIndex(next);},[autoMemoryId,album]);
  useEffect(()=>setFailed(false),[memory.id]);
  useFrame(()=>{
    const projected=new THREE.Vector3(...position).project(camera);
    const baseZoom=Math.min(size.width/(size.width<700?34:45),size.height/28);
    const zoomRatio=camera.zoom/baseZoom;
    const nearCenter=projected.z>-1&&projected.z<1&&Math.hypot(projected.x,projected.y)<.58;
    const automatic=autoMemoryId===undefined?nearCenter&&zoomRatio>2.35:album.some(m=>m.id===autoMemoryId);
    const next=memoryIsOpen(manual,automatic);
    const nextSide=projected.x>(size.width<700 ? .12 : .38)?"left":"right";
    const cardWidth=Math.min(420,size.width-32),cardHeight=Math.min(370,size.height-160);
    const sx=(projected.x*.5+.5)*size.width,sy=(-projected.y*.5+.5)*size.height;
    const left=Math.round(Math.max(16,Math.min(sx+(nextSide==="left"?-cardWidth-18:18),size.width-cardWidth-16))-sx+11);
    const top=Math.round(Math.max(90,Math.min(sy-cardHeight-12,size.height-cardHeight-130))-sy+14);
    if(next!==expanded)setExpanded(next);
    if(nextSide!==cardSide)setCardSide(nextSide);
    if(next&&(left!==cardPosition.left||top!==cardPosition.top))setCardPosition({left,top});
  });
  return <Html position={position} center zIndexRange={[35,0]}>
    <div className={`hk-photo-memory-anchor${expanded?" is-expanded":""} opens-${cardSide}`} onPointerDown={event=>event.stopPropagation()}>
      <span className="hk-photo-pin-halo" aria-hidden="true"/>
      <button className="hk-photo-pin" aria-label={`${expanded?"收起":"展开"}${memory.label}照片：${memory.title}`} aria-pressed={expanded} title={`${memory.label} · ${memory.title}`} onClick={()=>setManual(!expanded)}><img src="/assets/hk-photo-pin.png" alt="" draggable="false"/></button>
      {expanded&&<aside className="hk-photo-memory-card" style={{...cardPosition,width:Math.min(420,size.width-32),"--hk-memory-media-height":`${Math.min(255,Math.max(140,size.height-330))}px`}} aria-label={`${memory.label}照片记忆`}>
        <div className="hk-photo-memory-head"><span>{memory.label}</span><time>{memory.capturedAt?.slice(0,10)??"记忆坐标"}</time></div>
        <div className="hk-photo-memory-media">{failed?<a href={memory.originalUrl??memory.url} target="_blank" rel="noreferrer">打开原始照片 ↗</a>:<img src={memory.url} alt={memory.title} loading="eager" onError={()=>setFailed(true)}/>}</div>
        <div className="hk-photo-memory-caption"><strong>{memory.title}</strong><small>{memory.latitude.toFixed(4)}° N · {Math.abs(memory.longitude).toFixed(4)}° E</small></div>
        {album.length>1&&<div className="hk-photo-memory-pages"><button aria-label="上一张香港照片" onClick={()=>setIndex((index-1+album.length)%album.length)}><ChevronLeft size={12}/></button><span>{String(index+1).padStart(2,"0")} / {String(album.length).padStart(2,"0")}</span><button aria-label="下一张香港照片" onClick={()=>setIndex((index+1)%album.length)}><ChevronRight size={12}/></button></div>}
        <button className="hk-photo-memory-close" aria-label="收起照片" onClick={()=>{setManual(false);setExpanded(false);}}>收起</button>
      </aside>}
    </div>
  </Html>;
}

class SceneErrorBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div className="hk-load-message">三维场景未能启动。<button onClick={()=>window.location.reload()}>重新加载</button></div>:this.props.children;}
}

export default function LowPolyCityCanvas({onReady,onStatus,onCitySelect,onReturn,onInteract,embedded=false,active=true,autoMemoryId}) {
  const [data,setData]=useState(null),[failed,setFailed]=useState(false),[selected,setSelected]=useState("harbour"),[theme,setTheme]=useState("sunset"),[forest,setForest]=useState(true),[labels,setLabels]=useState(true),[view,setView]=useState("overview"),[orbiting,setOrbiting]=useState(false),[about,setAbout]=useState(false);
  const [dragMode,setDragMode]=useState("pan");
  const cameraApi=useRef(),readyRef=useRef(onReady),root=useRef();readyRef.current=onReady;
  const reducedMotion=useMemo(()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches,[]);
  const bridgeReady=useMemo(()=>api=>{cameraApi.current=api;readyRef.current?.(api);},[]);
  useEffect(()=> {
    const controller=new AbortController();let built;
    Promise.all(["/data/hong-kong-osm.json","/data/hong-kong-coast.json"].map(url=>fetch(url,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error("Scene data unavailable");return r.json();}))).then(([json,coastline])=> {
      if(controller.signal.aborted)return;
      built=buildHongKong(json.features,coastline);setData(built);onStatus?.({mode:"low-poly",message:"香港 · 山海之间"});
    }).catch(error=>{if(error.name!=="AbortError"){setFailed(true);onStatus?.({mode:"error",message:"香港沙盘数据暂不可用"});}});
    return ()=>{controller.abort();if(built)disposeHongKong(built);};
  },[onStatus]);
  function focus(id){setSelected(id);setView("overview");setOrbiting(false);cameraApi.current?.focusLandmark(id).catch(()=>{});}
  function setCameraView(next){setView(next);setOrbiting(false);if(next==="overview")setSelected("harbour");cameraApi.current?.setView(next).catch(()=>{});}
  const chosen=LANDMARKS.find(l=>l.id===selected),night=theme==="night";
  return <div className="city-canvas low-poly-canvas hk-atlas" ref={root} data-theme={theme} data-embedded={embedded} data-drag-mode={dragMode} onPointerDownCapture={onInteract} onWheelCapture={onInteract} aria-label="可拖拽和缩放的香港风格化城市三维沙盘">
    <SceneErrorBoundary>{data && <Canvas frameloop={active?"always":"demand"} orthographic shadows dpr={[1,1.5]} camera={{position:[11.7,22,-28.4],zoom:26,near:.1,far:180}} gl={{antialias:true,alpha:false}} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.12;}}>
      <color attach="background" args={[night?"#111e2b":"#e9ddc9"]}/><fog attach="fog" args={[night?"#111e2b":"#e9ddc9",62,115]}/>
      <ambientLight intensity={night?.16:.6}/><hemisphereLight args={[night?"#9abbd9":"#f9fff2",night?"#182b38":"#acb79c",night?.55:1.4]}/>
      <directionalLight position={night?[-18,22,-15]:[-25,10,-9]} intensity={night?1:2.5} color={night?"#a5c8e4":"#ffcc8f"} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-camera-near={1} shadow-camera-far={80} shadow-normalBias={.025} shadow-bias={-.00015} shadow-radius={3}/>
      {night&&<directionalLight position={[20,12,9]} intensity={1.1} color="#7096ca"/>}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.72,0]} receiveShadow><planeGeometry args={[200,200]}/><meshStandardMaterial color={night?"#182937":"#e5d9c2"} roughness={1}/></mesh>
      <Geography data={data} forest={forest} night={night}/><Ferries reducedMotion={reducedMotion} night={night}/><PhotoMemoryLayer night={night} autoMemoryId={autoMemoryId}/>
      {labels && LANDMARKS.map(l=><Html key={l.id} position={[l.point[0],l.id==="harbour"?.06:terrainHeight(...l.point)+(l.height??1)+.16,l.point[1]]} center zIndexRange={[20,0]} style={{pointerEvents:"none"}}><button className={`hk-place ${selected===l.id?"is-selected":""} hk-place-${l.id}`} onClick={()=>focus(l.id)} aria-label={`飞往${l.label}`}><span/>{l.label}</button></Html>)}
      <SceneBridge onReady={bridgeReady} onAutoChange={setOrbiting} reducedMotion={reducedMotion} dragMode={dragMode}/>
    </Canvas>}</SceneErrorBoundary>
    {!data && <div className="hk-load-message" role="status">{failed?"香港沙盘数据加载失败":"正在搭建维港两岸…"}{failed&&<button onClick={()=>window.location.reload()}>重新加载</button>}</div>}
    <div className="hk-ui">
      <div className="hk-title"><div className="hk-kicker"><i/> HONG KONG · SPATIAL ATLAS</div><h1>山海香港 <span>香<br/>港</span></h1><p>一半山色，一半海港。</p></div>
      <nav className="hk-city-switch" aria-label="切换城市"><button onClick={onReturn}><Globe2 size={14}/> 地球</button><span/><button aria-current="page" onClick={()=>focus("harbour")}>香港</button><button onClick={()=>onCitySelect("beijing")}>北京</button><button onClick={()=>onCitySelect("new-york")}>纽约</button></nav>
      <div className="hk-light-switch" role="group" aria-label="沙盘光照"><button aria-pressed={!night} onClick={()=>setTheme("sunset")}><Sunset size={15}/>日落</button><button aria-pressed={night} onClick={()=>setTheme("night")}><Moon size={15}/>夜间</button><button className="hk-about" aria-label="关于香港沙盘" onClick={()=>setAbout(!about)}><Info size={16}/></button></div>
      <div className="hk-compass"><Compass size={30} strokeWidth={1}/><span>N</span></div>
      <div className="hk-zoom"><button aria-label="放大沙盘" onClick={()=>cameraApi.current?.zoom(1.2)}><Plus size={18}/></button><button aria-label="缩小沙盘" onClick={()=>cameraApi.current?.zoom(1/1.2)}><Minus size={18}/></button></div>
      <div className="hk-caption" aria-live="polite"><span>{String(LANDMARKS.indexOf(chosen)+1).padStart(2,"0")} /</span>{chosen.description}</div>
      <div className="hk-toolbar" role="toolbar" aria-label="沙盘视图控制">
        <Tool icon={RotateCcw} label="全景" active={view==="overview"&&!orbiting} onClick={()=>setCameraView("overview")}/><Tool icon={Compass} label="环绕" active={orbiting} onClick={()=>setOrbiting(cameraApi.current?.orbit()??false)}/><Tool icon={Map} label="俯视" active={view==="top"} onClick={()=>setCameraView("top")}/><Tool icon={Move} label="平移" active={dragMode==="pan"} onClick={()=>setDragMode(dragMode==="pan"?"rotate":"pan")}/><span className="hk-tool-divider"/><Tool icon={Trees} label="山林" active={forest} onClick={()=>setForest(!forest)}/><Tool icon={MapPin} label="地标" active={labels} onClick={()=>setLabels(!labels)}/><span className="hk-tool-divider"/><Tool icon={Maximize2} label="全屏" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});else root.current?.closest("main")?.requestFullscreen?.().catch(()=>{});}}/>
      </div>
      <div className="hk-legend"><span><i className="is-forest"/>连绵山林</span><span><i className="is-water"/>维港水岸</span><span><i className="is-city"/>城市肌理</span></div>
      <div className="hk-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth</a><span>风格化地形 · 非实测模型</span></div>
      <div className="hk-gesture" aria-live="polite">{dragMode==="pan"?"拖拽平移 · Shift + 拖拽旋转 · 滚轮缩放":"拖拽旋转 · 右键平移 · 滚轮缩放"}</div>
      {about&&<div className="hk-about-panel"><button aria-label="关闭沙盘说明" onClick={()=>setAbout(false)}><X size={16}/></button><span>ABOUT THIS ATLAS</span><h2>把香港，放进一张微缩地图。</h2><p>{data?.buildingCount.toLocaleString()} 栋建筑沿真实轮廓生长，{data?.trees.length.toLocaleString()} 棵几何树木铺向山脊。水面、建筑与山体均为独立三维几何。</p><p>建筑、维港及主要岛屿海岸线来自 OpenStreetMap（ODbL），远处大陆和小岛采用 Natural Earth 的简化轮廓。缺失高度、山体起伏及重点地标为艺术化演绎；日落与夜间为场景光照预设。</p></div>}
    </div>
  </div>;
}

function Tool({icon:Icon,label,active=false,onClick}){return <button aria-label={label} aria-pressed={active} onClick={onClick}><Icon size={19} strokeWidth={1.5}/><span>{label}</span></button>;}
