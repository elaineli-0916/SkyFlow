import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, Pause, Play, RotateCcw, Music2, VolumeX, X, ArrowUpRight } from "lucide-react";
import { JOURNEY_STOPS, JOURNEY_MUSIC } from "./journeyData.js";
import memories from "./memories.json";
import LowPolyCityCanvas from "../city/LowPolyCityCanvas.jsx";
import AstronautOpening from "../astronaut/AstronautOpening.jsx";
import "./journey.css";

export default function JourneyExperience({camera,onCitySelect}){
  const [index,setIndex]=useState(-1),[busy,setBusy]=useState(false),[playing,setPlaying]=useState(false);
  const [points,setPoints]=useState([]),[preview,setPreview]=useState(null),[music,setMusic]=useState(false),[musicError,setMusicError]=useState("");
  const [phase,setPhase]=useState("space"),[progress,setProgress]=useState(0),[autoMemory,setAutoMemory]=useState(null),[scene,setScene]=useState("globe");
  const [sandboxMounted,setSandboxMounted]=useState(false),[sandboxStatus,setSandboxStatus]=useState(null),[journeyError,setJourneyError]=useState("");
  const layer=useRef(null),flight=useRef(null),dwell=useRef(),albumTimer=useRef(),playRef=useRef(false),audio=useRef(null),hideTimer=useRef(),goRef=useRef();
  const sandbox=useRef(null),sandboxResolve=useRef(null),sceneRef=useRef("globe"),arrivedStop=useRef(null);
  const opening=useRef(true);opening.current=index<0;
  const stop=JOURNEY_STOPS[index],ending=index===JOURNEY_STOPS.length;
  function pause(cancelFlight=true){
    playRef.current=false;setPlaying(false);clearTimeout(dwell.current);clearInterval(albumTimer.current);
    if(cancelFlight){flight.current?.abort();camera?.stopJourneyMotion();sandbox.current?.cancel();sandbox.current?.stopAutoTour();}
    setPhase(value=>value==="space"?value:"explore");
  }
  function changeScene(value){sceneRef.current=value;setScene(value);}
  function closePreview(){setPreview(null);setAutoMemory(null);clearInterval(albumTimer.current);clearTimeout(hideTimer.current);}
  function takeControl(){if(opening.current)return;pause();closePreview();}
  function waitForSandbox(signal){
    if(sandbox.current)return Promise.resolve(sandbox.current);
    return new Promise((resolve,reject)=>{
      const finish=(error,api)=>{clearTimeout(timer);signal.removeEventListener("abort",abort);sandboxResolve.current=null;error?reject(error):resolve(api);};
      const abort=()=>finish(new DOMException("Journey interrupted","AbortError"));
      const timer=setTimeout(()=>finish(new Error("香港沙盘未能及时载入，先在卫星地图中探索。")),12000);
      sandboxResolve.current=api=>finish(null,api);signal.addEventListener("abort",abort,{once:true});
      if(signal.aborted)abort();
    });
  }
  async function go(next,continuous=false){
    if(!camera)return;
    camera.leaveAstronaut?.();
    clearTimeout(dwell.current);clearInterval(albumTimer.current);clearTimeout(hideTimer.current);flight.current?.abort();
    camera.stopJourneyMotion();sandbox.current?.stopAutoTour();
    const controller=new AbortController();flight.current=controller;
    arrivedStop.current=null;
    setPreview(null);setAutoMemory(null);setJourneyError("");setIndex(next);setBusy(true);setPhase("travel");setProgress(0);layer.current?.setActive(next);
    const nextStop=JOURNEY_STOPS[next],album=memories.filter(m=>m.city===nextStop?.city);
    if(nextStop?.city==="hong-kong")setSandboxMounted(true);
    try{
      if(sceneRef.current==="hong-kong"){
        await sandbox.current?.flyToCity(null,{signal:controller.signal,duration:1.4});
        changeScene("globe");
      }
      let previousProgress=-1;
      const onProgress=t=>{const percent=Math.floor(t*100);if(percent!==previousProgress){previousProgress=percent;layer.current?.setProgress(t);setProgress(t);}};
      if(!nextStop){
        await camera.journeyOverview({signal:controller.signal,ending:next>=JOURNEY_STOPS.length,duration:next<0?3:8,onProgress});
        setPhase("space");camera.startJourneyDrift(true);
        if(next>=JOURNEY_STOPS.length){playRef.current=false;setPlaying(false);}
        return;
      }
      await camera.flyToJourneyStop(nextStop,{signal:controller.signal,memories,onProgress});
      if(nextStop.city==="hong-kong"){
        setPhase("arriving");
        try{
          const api=await waitForSandbox(controller.signal);
          changeScene("hong-kong");
          await api.flyToCity(null,{signal:controller.signal,duration:1.8});
          api.startAutoTour();
        }catch(error){if(error.name==="AbortError")throw error;setJourneyError(error.message);}
      }
      if(controller.signal.aborted)throw new DOMException("Journey interrupted","AbortError");
      if(sceneRef.current==="globe")camera.startJourneyDrift();
      arrivedStop.current=next;
      setPhase("explore");
      let photoIndex=0;
      setAutoMemory(album[0]?.id??null);
      if(album.length>1)albumTimer.current=setInterval(()=>{
        photoIndex++;
        if(photoIndex<album.length)setAutoMemory(album[photoIndex].id);else clearInterval(albumTimer.current);
      },4500);
      if(continuous&&playRef.current)dwell.current=setTimeout(()=>goRef.current(next+1,true),Math.max(10000,album.length*4500));
    }catch(error){if(flight.current===controller){if(error.name!=="AbortError")setJourneyError("镜头暂时未能抵达，可自由拖拽或再次选择这一站。");pause(false);}}
    finally{if(flight.current===controller)setBusy(false);}
  }
  goRef.current=go;
  useEffect(()=>{
    if(!camera)return;
    layer.current=camera.installJourney(memories,{onPoints:setPoints,onInteract:takeControl});
    // The opening owns its first-person camera until the journey begins.
    return ()=>{playRef.current=false;clearTimeout(dwell.current);clearInterval(albumTimer.current);clearTimeout(hideTimer.current);flight.current?.abort();camera.stopJourneyMotion();layer.current?.dispose();layer.current=null;};
  },[camera]);
  useEffect(()=>{const player=audio.current;return ()=>player?.pause();},[]);
  useEffect(()=>{const close=e=>{if(e.key==="Escape"&&!opening.current){closePreview();pause();}};window.addEventListener("keydown",close);return ()=>window.removeEventListener("keydown",close);},[camera]);
  function manual(next){pause();go(next);}
  function togglePlay(){
    if(playing){pause(true);return;}
    // Start audio inside the click gesture; waiting for the camera would lose
    // browser autoplay permission. Resuming a paused tour respects music off.
    if(index<0||ending)playMusic();
    playRef.current=true;setPlaying(true);
    if(index>=0&&!ending&&arrivedStop.current===index){
      if(sceneRef.current==="hong-kong")sandbox.current?.startAutoTour();else camera.startJourneyDrift();
      dwell.current=setTimeout(()=>goRef.current(index+1,true),6000);
    }else go(index<0||ending?0:index,true);
  }
  function openMemory(id,event){
    const memory=memories.find(m=>m.id===id);if(!memory)return;
    clearTimeout(hideTimer.current);pause(true);
    setAutoMemory(null);
    const rect=event.currentTarget.getBoundingClientRect();setPreview({memory,anchor:{x:rect.x+rect.width/2,y:rect.y+rect.height/2}});
  }
  function scheduleHide(){clearTimeout(hideTimer.current);hideTimer.current=setTimeout(()=>setPreview(value=>value?.hover?null:value),350);}
  async function playMusic(){
    setMusicError("");
    audio.current.volume=.32;
    try{await audio.current.play();}catch{setMusicError("音乐暂时无法播放，可再次点击重试。");}
  }
  function toggleMusic(){if(!audio.current.paused)audio.current.pause();else playMusic();}
  // Keep nearby but distinct memories visible during a city pass. Only pins
  // that land almost on top of one another are collapsed (for example the
  // two Victoria Peak photos sharing one GPS coordinate).
  const visible=points.filter((p,i)=>!points.slice(0,i).some(q=>q.city===p.city&&Math.hypot(p.x-q.x,p.y-q.y)<8));
  const activeMemories=memories.filter(m=>m.city===stop?.city);
  const shownMemory=preview?.memory??memories.find(m=>m.id===autoMemory);
  const anchor=points.find(p=>p.id===shownMemory?.id)??preview?.anchor;
  return <section className="journey" data-stage={index<0?"intro":ending?"outro":"chapter"} data-phase={phase} data-scene={scene} aria-label="个人旅程 · 仍然抬头">
    {index<0&&<AstronautOpening camera={camera} active={!busy}/>}
    {sandboxMounted&&<div className="journey-sandbox" aria-hidden={scene!=="hong-kong"} inert={scene!=="hong-kong"?"":undefined}>
      <LowPolyCityCanvas embedded active={scene==="hong-kong"} onReady={api=>{sandbox.current=api;if(api)sandboxResolve.current?.(api);}} onStatus={setSandboxStatus} onCitySelect={onCitySelect} onReturn={()=>manual(index)} onInteract={()=>pause()} autoMemoryId={autoMemory}/>
    </div>}
    <div className="journey-copy" key={index}>
      {index<0?<h1 className="journey-hero-line">这个人一直在迁徙，也一直在观察世界。</h1>:!ending&&<>
        <div className="journey-city"><h1>{stop.name}</h1>{stop.year&&<time>{stop.year}</time>}</div>
        {activeMemories.length>0&&<button className="journey-memory-link" onClick={e=>openMemory(activeMemories[0].id,e)}>此地的 {activeMemories.length} 段记忆 <ArrowUpRight size={13}/></button>}
        {stop.city==="hong-kong"&&<button className="journey-city-entry" onClick={()=>{if(scene==="hong-kong"){pause();changeScene("globe");}else manual(index);}}>{scene==="hong-kong"?"查看香港卫星地图":"走进香港沙盘"} <ArrowRight size={14}/></button>}
      </>}
    </div>
    <div className="journey-map-points" hidden={scene!=="globe"}>
      {visible.map((p,i)=>{
        const memory=memories.find(m=>m.id===p.id),city=JOURNEY_STOPS.find(s=>s.city===p.city);
        const active=p.city===stop?.city;
        const firstForCity=visible.findIndex(item=>item.city===p.city)===i;
        return <button key={p.id} className="journey-memory-point" style={{left:p.x,top:p.y}} data-active={active} data-pin={p.close} aria-label={memory?`${memory.label}：${memory.title}`:`前往${city?.name??p.city}`} aria-expanded={memory?shownMemory?.id===memory.id:undefined} onPointerEnter={e=>{if(e.pointerType!=="touch"&&memory&&!busy&&!playing&&!preview){setPreview({memory,anchor:p,hover:true});}}} onPointerLeave={scheduleHide} onFocus={()=>clearTimeout(hideTimer.current)} onBlur={scheduleHide} onClick={e=>{if(memory){if(shownMemory?.id===p.id&&!preview?.hover)closePreview();else openMemory(p.id,e);}else manual(JOURNEY_STOPS.findIndex(s=>s.city===p.city));}}><span/><img className="journey-coordinate-pin" src="/assets/hk-photo-pin.png" alt="" draggable="false"/>{active&&firstForCity&&<small>{stop.name}</small>}</button>;
      })}
    </div>
    {scene==="globe"&&shownMemory&&anchor&&<MemoryCard key={shownMemory.id} memory={shownMemory} anchor={anchor} onEnter={()=>clearTimeout(hideTimer.current)} onLeave={scheduleHide} onClose={closePreview} onSelect={memory=>{pause();setAutoMemory(null);setPreview({memory,anchor});}}/>}
    <div className="journey-navigation">
      {index<0?<button className="journey-start" onClick={togglePlay} disabled={!camera}>沿着轨迹出发 <ArrowRight size={18}/></button>:<>
        <button className="journey-nav-icon" aria-label="上一段旅程" onClick={()=>manual(index-1)} disabled={!camera}><ArrowLeft size={18}/></button>
        <button className="journey-play" aria-label={playing?"暂停旅程":ending?"重新走一遍":"继续旅程"} onClick={togglePlay} disabled={!camera}>{playing?<Pause size={15}/>:ending?<RotateCcw size={15}/>:<Play size={15}/>}<span>{playing?"暂停片刻":ending?"重新走一遍":"跟随轨迹"}</span></button>
        <button className="journey-nav-icon" aria-label={index===7?"看见整条旅程":"下一段旅程"} onClick={()=>manual(Math.min(8,index+1))} disabled={!camera||ending}><ArrowRight size={18}/></button>
        <div className="journey-step-count">{ending?"∞":String(index+1).padStart(2,"0")}<span>/ {ending?"继续":"08"}</span></div>
      </>}
      {(journeyError||phase==="arriving")&&<span className="journey-flight-status" role="status">{journeyError||(sandboxStatus?.mode==="error"?"沙盘暂未就绪，将保留香港卫星地图…":"维港两岸，正在展开…")}</span>}
      {index>=0&&phase==="travel"&&<span className="journey-flight-track" role="progressbar" aria-label="旅程飞行进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}><i style={{transform:`scaleX(${progress})`}}/></span>}
    </div>
    <div className="journey-music"><button onClick={toggleMusic} aria-pressed={music} aria-label={music?"暂停音乐":"播放音乐：落叶归根"}>{music?<Music2 size={14}/>:<VolumeX size={14}/>}<span>落叶归根</span></button>{musicError&&<small role="status">{musicError}</small>}</div>
    <audio ref={audio} src={JOURNEY_MUSIC} preload="metadata" loop onPlay={()=>setMusic(true)} onPause={()=>setMusic(false)} onError={()=>{setMusic(false);setMusicError("音乐暂时无法加载。");}}/>
  </section>;
}

function MemoryCard({memory,anchor,onEnter,onLeave,onClose,onSelect}){
  const [failed,setFailed]=useState(false),album=memories.filter(m=>m.city===memory.city),position=album.findIndex(m=>m.id===memory.id);
  const year=memory.capturedAt?.slice(0,4);
  const cardWidth=Math.min(440,window.innerWidth-32);
  return <aside className="journey-memory" aria-label={`${memory.label}的空间记忆`} style={{left:Math.max(16,Math.min(anchor.x+24,window.innerWidth-cardWidth-16)),top:Math.max(95,Math.min(anchor.y-200,window.innerHeight-420)),width:cardWidth}} onPointerEnter={onEnter} onPointerLeave={onLeave} onFocus={onEnter} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))onLeave();}}>
    <button className="journey-memory-close" onClick={onClose} aria-label="关闭这段记忆"><X size={15}/></button>
    <div className="journey-memory-media">{failed?<a href={memory.originalUrl??memory.url} target="_blank" rel="noreferrer">打开原始{memory.kind==="video"?"影像":"照片"} <ArrowUpRight size={15}/></a>:memory.kind==="video"?<video src={memory.url} controls playsInline muted preload="metadata" onError={()=>setFailed(true)}/>:<img src={memory.url} alt={memory.title} decoding="async" onError={()=>setFailed(true)}/>}</div>
    <div className="journey-memory-caption"><span>{memory.label} {year&&<time>· {year}</time>}</span></div>
    {album.length>1&&<div className="journey-memory-pages"><button aria-label="上一张记忆" onClick={()=>onSelect(album[(position-1+album.length)%album.length])}><ArrowLeft size={14}/></button><span>{String(position+1).padStart(2,"0")} / {String(album.length).padStart(2,"0")}</span><button aria-label="下一张记忆" onClick={()=>onSelect(album[(position+1)%album.length])}><ArrowRight size={14}/></button></div>}
  </aside>;
}
