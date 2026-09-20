import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { LANDMARKS, terrainHeight } from "./hongKongScene.js";
import { buildLandmarkFacade, disposeLandmarkFacade } from "./hongKongFacades.js";

const ivory="#edf0df", glass="#7fa7a0", trim="#cdded0";
const NightContext=createContext(false);
function Box({position=[0,0,0],size,color=ivory,lit=false,...props}) {
  const night=useContext(NightContext);
  return <mesh position={position} castShadow receiveShadow {...props}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.78} emissive={night&&lit?"#ffcf87":"#000000"} emissiveIntensity={.85}/></mesh>;
}
function DetailedFacade({id}) {
  const night=useContext(NightContext);
  const model=useMemo(()=>buildLandmarkFacade(id),[id]);
  const outlines=useMemo(()=>new THREE.EdgesGeometry(model.glass,35),[model]);
  useEffect(()=>()=>{disposeLandmarkFacade(model);outlines.dispose();},[model,outlines]);
  return <group name={`landmark-${id}`}>{Object.entries(model).filter(([kind])=>kind!=="nightWindows").map(([kind,geometry])=>
    <mesh key={kind} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={kind==="glass"?.4:kind==="metal"?.55:.88} metalness={kind==="glass"?.14:kind==="metal"?.16:0} emissive={night?"#81aebc":"#000000"} emissiveIntensity={kind==="metal"?.22:.025}/>
    </mesh>
  )}{night&&<>
    <mesh geometry={model.nightWindows}><meshBasicMaterial vertexColors side={THREE.DoubleSide} toneMapped={false}/></mesh>
    <lineSegments geometry={outlines}><lineBasicMaterial color="#aacbd3" transparent opacity={.24} depthWrite={false}/></lineSegments>
  </>}</group>;
}
function ConventionCentre() {
  const roof=useMemo(()=> {
    const points=[],indices=[],n=24;
    for(let i=0;i<=n;i++){const t=i/n,x=(t-.5)*1.38;for(let j=0;j<=12;j++){const v=j/12;points.push(x,.46+Math.sin(t*Math.PI)*.18+Math.sin(v*Math.PI)*.12,(v-.5)*.92*(.7+.3*Math.sin(t*Math.PI)));}}
    for(let i=0;i<n;i++)for(let j=0;j<12;j++){const a=i*13+j;indices.push(a,a+1,a+13,a+1,a+14,a+13);}
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();return g;
  },[]);
  return <group rotation={[0,-.13,0]}>
    <Box position={[0,.05,0]} size={[1.55,.1,1.05]} color="#d5d5be"/><Box position={[0,.23,0]} size={[1.14,.34,.65]} color={glass}/>
    <mesh geometry={roof} castShadow><meshStandardMaterial color="#edf0e4" side={THREE.DoubleSide} roughness={.72}/></mesh>
    {[-.5,-.3,-.1,.1,.3,.5].map(x=><Box key={x} position={[x,.29,-.337]} size={[.024,.38,.025]} color={trim}/>)}
    {[-1,1].map(sign=><group key={sign}>
      {Array.from({length:14},(_,i)=><Box key={`window-${i}`} position={[-.494+i*.076,.265,sign*.334]} size={[.059,.23,.005]} color={glass} lit/>)}
      {Array.from({length:15},(_,i)=><Box key={i} position={[-.53+i*.076,.27,sign*.331]} size={[.008,.29,.012]} color={ivory}/>)}
      {[.17,.27,.37].map(y=><Box key={y} position={[0,y,sign*.334]} size={[1.12,.008,.014]} color={trim}/>)}
    </group>)}
    {Array.from({length:13},(_,i)=>{
      const t=(i+1)/14,x=(t-.5)*1.38;
      return <Line key={i} points={Array.from({length:17},(_,j)=>{const v=j/16;return [x,.468+Math.sin(t*Math.PI)*.18+Math.sin(v*Math.PI)*.12,(v-.5)*.92*(.7+.3*Math.sin(t*Math.PI))];})} color="#bccbbe" lineWidth={.7}/>;
    })}
    <Box position={[0,.12,-.55]} size={[1,.12,.17]}/>
  </group>;
}
function ClockTower() {
  const night=useContext(NightContext);
  return <group>
    <Box position={[0,.04,0]} size={[.31,.08,.31]}/><Box position={[0,.31,0]} size={[.16,.53,.16]} color="#b99572"/>
    {[.13,.36,.53].map(y=><Box key={y} position={[0,y,0]} size={[.185,.028,.185]} color="#e6d8b6"/>)}
    <Box position={[0,.64,0]} size={[.21,.19,.21]} color="#c5ae85"/>
    <mesh position={[0,.66,-.111]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.056,.056,.008,16]}/><meshStandardMaterial color="#f4f0d9" emissive={night?"#eed4a2":"#000000"} emissiveIntensity={.9}/></mesh>
    <Line points={[[0,.699,-.12],[0,.66,-.12],[.028,.645,-.12]]} color="#4d665b" lineWidth={1}/>
    <Box position={[0,.75,0]} size={[.23,.028,.23]}/><mesh position={[0,.82,0]}><coneGeometry args={[.145,.13,4]}/><meshStandardMaterial color="#789985"/></mesh>
  </group>;
}
function Pier({position,rotation=0}) {
  return <group position={position} rotation={[0,rotation,0]}>
    <Box position={[0,.025,0]} size={[.43,.05,.95]} color="#c8d1b8"/><Box position={[0,.12,0]} size={[.32,.18,.7]} color="#e3e4cd"/>
    {[-.13,.13].map(x=><Box key={x} position={[x,.17,0]} size={[.025,.08,.61]} color="#568d7b" lit/>)}
    <mesh position={[0,.235,0]} rotation={[0,Math.PI/4,0]} scale={[1,1,2.5]}><coneGeometry args={[.24,.11,4]}/><meshStandardMaterial color="#809e83"/></mesh>
  </group>;
}
function Wheel() {
  const night=useContext(NightContext);
  return <group position={[-1.83,.18,4.22]} rotation={[0,.1,0]}>
    <Box position={[0,.025,0]} size={[.6,.05,.26]}/><Line points={[[-.18,0,.09],[0,.38,0],[.18,0,.09]]} color={ivory} lineWidth={2}/>
    <mesh position={[0,.38,0]}><torusGeometry args={[.31,.008,4,48]}/><meshStandardMaterial color={ivory} emissive={night?"#b5d7e1":"#000000"} emissiveIntensity={1}/></mesh>
    {Array.from({length:12},(_,i)=> {const angle=i*Math.PI/6,x=Math.cos(angle)*.31,y=.38+Math.sin(angle)*.31;return <group key={i}><Line points={[[0,.38,0],[x,y,0]]} color="#d9e4d6" lineWidth={.7}/><Box position={[x,y-.025,0]} size={[.048,.046,.035]} color="#b78e6b"/></group>;})}
  </group>;
}
export function HongKongLandmarks({night=false}) {
  const models={clock:ClockTower,convention:ConventionCentre};
  const detailed=["ifc","icc","bank","hku","peak"];
  return <NightContext.Provider value={night}><group>{LANDMARKS.filter(l=>models[l.id]||detailed.includes(l.id)).map(l=> {const Model=models[l.id];return <group key={l.id} position={[l.point[0],terrainHeight(...l.point),l.point[1]]}>{Model?<Model/>:<DetailedFacade id={l.id}/>}</group>;})}
    <Pier position={[-2.7,.02,3.3]}/><Pier position={[1.14,.02,.82]} rotation={Math.PI}/><Wheel/>
  </group></NightContext.Provider>;
}
export function Ferries({reducedMotion=false,night=false}) {
  const ferry=useRef(),second=useRef();
  useFrame(({clock})=> {
    const t=reducedMotion?0:clock.elapsedTime*.055;
    if(ferry.current){ferry.current.position.set(-1.5+Math.sin(t)*2.2,.015,1.7+Math.cos(t)*.45);ferry.current.rotation.y=-Math.PI/2+Math.sin(t)*.2;}
    if(second.current){second.current.position.set(6+Math.sin(t*.7)*2,.015,.3);second.current.rotation.y=Math.PI/2;}
  });
  return <NightContext.Provider value={night}><group>{[ferry,second].map((ref,index)=><group key={index} ref={ref} scale={index===0?1:.85}>
    <mesh rotation={[0,Math.PI/2,0]} scale={[1,1,2.7]} castShadow><cylinderGeometry args={[.08,.055,.07,8]}/><meshStandardMaterial color="#356e64"/></mesh>
    <Box position={[0,.073,0]} size={[.13,.075,.31]}/><Box position={[0,.12,0]} size={[.12,.025,.24]} color="#628b75"/>
    {[-.069,.069].map(x=><Box key={x} position={[x,.076,0]} size={[.006,.035,.23]} color="#477668" lit/>)}
    <Box position={[0,.155,.065]} size={[.025,.055,.027]} color="#c2a57b"/>
    <Line points={[[-.07,-.002,.2],[-.15,-.002,.49],[-.19,-.002,.65]]} color="#bbd9c7" lineWidth={1}/><Line points={[[.07,-.002,.2],[.15,-.002,.49],[.19,-.002,.65]]} color="#bbd9c7" lineWidth={1}/>
  </group>)}</group></NightContext.Provider>;
}
