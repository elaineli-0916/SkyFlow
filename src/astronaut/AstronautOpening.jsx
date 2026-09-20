import { useEffect, useRef, useState } from "react";
import { MoveUp, MoveDown, Orbit, ScanEye, Crosshair, Flashlight, Pause, Hand, X } from "lucide-react";
import { createHandTrackingSession } from "./handTracking.js";
import "./astronaut.css";

const HAND_BONES=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const FINGERTIPS=new Set([4,8,12,16,20]);
function drawHands(canvas,hands) {
  if(!canvas)return;
  const rect=canvas.getBoundingClientRect(),ratio=Math.min(2,window.devicePixelRatio||1);
  const width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext("2d");
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,rect.width,rect.height);
  ctx.lineCap="round";ctx.lineJoin="round";ctx.shadowColor="rgba(80,255,154,.72)";ctx.shadowBlur=5;
  for(const points of hands) {
    if(points?.length!==21)continue;
    ctx.beginPath();
    for(const [a,b] of HAND_BONES){ctx.moveTo(points[a].x*rect.width,points[a].y*rect.height);ctx.lineTo(points[b].x*rect.width,points[b].y*rect.height);}
    ctx.lineWidth=1.3;ctx.strokeStyle="rgba(113,255,166,.78)";ctx.stroke();
    points.forEach((point,index)=>{ctx.beginPath();ctx.arc(point.x*rect.width,point.y*rect.height,FINGERTIPS.has(index)?3:2,0,Math.PI*2);ctx.fillStyle=FINGERTIPS.has(index)?"#d4ffe1":"#65f59b";ctx.fill();});
  }
}

export default function AstronautOpening({camera,active}) {
  const [mode,setMode]=useState("free"),[beam,setBeam]=useState(true),[altitude,setAltitude]=useState(17000);
  const [ready,setReady]=useState(false);
  const [trackingEnabled,setTrackingEnabled]=useState(false),[trackingStatus,setTrackingStatus]=useState("");
  const [trackedHands,setTrackedHands]=useState(0);
  const api=useRef(null),frame=useRef(null),video=useRef(null),handOverlay=useRef(null),tracking=useRef(null);
  useEffect(()=>{
    if(!camera||!active){setReady(false);setTrackingEnabled(false);return;}
    setMode("free");setBeam(true);
    const controller=camera.enterAstronaut({onMode:setMode,onDispose:()=>{tracking.current?.stop();},onPose:pose=>{
      setAltitude(pose.altitude);
      frame.current?.style.setProperty("--head-x",`${pose.hands.x}px`);
      frame.current?.style.setProperty("--head-y",`${pose.hands.y}px`);
      frame.current?.style.setProperty("--hand-roll",`${pose.hands.roll}deg`);
      frame.current?.style.setProperty("--hand-scale",`${pose.hands.scale}`);
    }});
    api.current=controller;
    setReady(true);
    return ()=>{controller.dispose();api.current=null;};
  },[camera,active]);
  useEffect(()=>{
    if(!trackingEnabled||!active||!ready||!video.current)return;
    let mounted=true;
    const session=createHandTrackingSession({video:video.current,
      onIntent:intent=>api.current?.setGestureIntent(intent),
      onLandmarks:hands=>{drawHands(handOverlay.current,hands);if(mounted)setTrackedHands(hands.length);},
      onStatus:message=>{if(mounted)setTrackingStatus(message);},
      onStop:()=>{if(mounted)setTrackingEnabled(false);},
    });
    tracking.current=session;session.start();
    return ()=>{mounted=false;session.stop();drawHands(handOverlay.current,[]);setTrackedHands(0);if(tracking.current===session)tracking.current=null;};
  },[trackingEnabled,active,ready]);
  function toggleTracking() {
    if(trackingEnabled){tracking.current?.stop();setTrackingEnabled(false);setTrackingStatus("");setTrackedHands(0);}
    else {setTrackingStatus("等待摄像头授权");setTrackingEnabled(true);}
  }
  function changeMode(value){api.current?.setMode(value);}
  return <div className="astronaut-opening" ref={frame} data-mode={mode} data-beam={beam}>
    <div className="astronaut-visor" aria-hidden="true"/>
    <img className="astronaut-hands" src="/assets/astronaut-eva-hands.png" alt="" draggable="false"/>
    <div className="astronaut-telemetry" aria-label={`距地表约 ${altitude} 千米`}><span/> {altitude.toLocaleString("en-US")} <small>km</small></div>
    <div className="astronaut-controls" role="toolbar" aria-label="宇航员运动控制">
      <div className="astronaut-modes" role="group" aria-label="运动方式">
        <button aria-pressed={mode==="free"} onClick={()=>changeMode("free")} disabled={!ready||!active}><ScanEye size={15}/><span>自由观察</span></button>
        <button aria-pressed={mode==="orbit"} onClick={()=>changeMode("orbit")} disabled={!ready||!active}><Orbit size={15}/><span>环绕地球</span></button>
        <button aria-pressed={mode==="hover"} onClick={()=>changeMode("hover")} disabled={!ready||!active}><Pause size={14}/><span>定点悬停</span></button>
      </div>
      <div className="astronaut-tools" role="group" aria-label="移动与照明">
        <button aria-label="前进" title="前进 · W / ↑" onClick={()=>api.current?.move(1)} disabled={!ready||!active}><MoveUp size={17}/></button>
        <button aria-label="后退" title="后退 · S / ↓" onClick={()=>api.current?.move(-1)} disabled={!ready||!active}><MoveDown size={17}/></button>
        <button aria-label="回望地球" title="回望地球" onClick={()=>api.current?.recenter()} disabled={!ready||!active}><Crosshair size={17}/></button>
        <button aria-label={beam?"关闭光束":"开启光束"} aria-pressed={beam} title="鼠标指向光束" onClick={()=>{api.current?.setBeam(!beam);setBeam(!beam);}} disabled={!ready||!active}><Flashlight size={16}/></button>
        <button className="astronaut-tracking-toggle" aria-pressed={trackingEnabled} onClick={toggleTracking} disabled={!ready||!active}
          title="单手左右摆：反向环绕，摆动越快速度越快；张开：靠近；握拳：远离"><Hand size={16}/><span>手势追踪</span><i aria-hidden="true"/></button>
      </div>
    </div>
    <p className="astronaut-hint">拖动视角 · 滚轮前后 · WASD 移动</p>
    {trackingEnabled&&<aside className="astronaut-camera" aria-label="手势追踪摄像头预览">
      <video ref={video} autoPlay muted playsInline aria-label="镜像摄像头画面"/>
      <canvas ref={handOverlay} className="astronaut-hand-overlay" aria-hidden="true"/>
      <span className={`astronaut-hand-lock${trackedHands?" is-locked":""}`} aria-hidden="true"><i/>{trackedHands?`HAND ${trackedHands}`:"SEARCH"}</span>
      <button className="astronaut-camera-close" onClick={toggleTracking} aria-label="关闭摄像头"><X size={14}/></button>
      <span className="astronaut-camera-caption">{trackingStatus}</span>
    </aside>}
    <p className={`astronaut-tracking-status${trackingEnabled?" is-sr-only":""}`} role="status" aria-live="polite">{trackingStatus}</p>
  </div>;
}
