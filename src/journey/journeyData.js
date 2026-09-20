export const JOURNEY_STOPS=[
  {id:"beijing-first",city:"beijing",name:"北京",en:"BEIJING",latitude:39.9042,longitude:116.4074,year:null,title:"从一片熟悉的天空出发。",words:["好奇","出发"],text:"世界很大。先从抬头开始。"},
  {id:"shanghai-first",city:"shanghai",name:"上海",en:"SHANGHAI",latitude:31.2304,longitude:121.4737,year:null,title:"换一座城市，换一个角度。",words:["流动","观察"],text:"在新的街道里，继续寻找让自己停下脚步的事物。"},
  {id:"new-york",city:"new-york",name:"纽约",en:"NEW YORK",latitude:40.7308,longitude:-73.9973,year:null,title:"把好奇带到更远的地方。",words:["远方","感受力"],text:"建筑、声音与光，成为理解世界的另一种语言。"},
  {id:"maryland",city:"maryland",name:"马里兰",en:"MARYLAND · COLLEGE PARK",latitude:38.9897,longitude:-76.9378,year:null,title:"追问之后，仍然会看月亮。",words:["科学","月光"],text:"用科学靠近世界，也给那些无法被解释的感动留一点位置。"},
  {id:"beijing-return",city:"beijing",name:"北京",en:"BEIJING · AGAIN",latitude:39.9042,longitude:116.4074,year:null,title:"回到旧坐标，带着新的目光。",words:["韧性","重新出发"],text:"方向可以改变。好奇，可以一直在。"},
  {id:"hong-kong",city:"hong-kong",name:"香港",en:"HONG KONG",latitude:22.2936,longitude:114.1694,year:null,title:"在山与海之间，保存一束光。",words:["山海","感受力"],text:"一栋建筑，一轮月亮。把被打动的瞬间，慢慢做成可以再次抵达的地方。"},
  {id:"shanghai-return",city:"shanghai",name:"上海",en:"SHANGHAI · AGAIN",latitude:31.2304,longitude:121.4737,year:null,title:"继续尝试，也继续感受。",words:["迁徙","创造"],text:"把走过的路，变成新的问题与新的作品。"},
  {id:"beijing-now",city:"beijing",name:"北京",en:"BEIJING · STILL LOOKING UP",latitude:39.9042,longitude:116.4074,year:null,title:"走了很远，还是会抬头看天。",words:["好奇","韧性","感受力"],text:"此刻不是终点。还有很多天空，值得再看一眼。"}
];
// Stable alias of the supplied file; Vite's public-file handling treats # in
// the original filename as a URL fragment even when the browser encodes it.
export const JOURNEY_MUSIC="/audio/journey-luoye-guigen.mp3";

// Spherical interpolation follows the short route across the globe, including
// the antimeridian; repeated city pairs receive subtly different arc heights.
export function journeyArc(from,to,index=0,segments=80){
  const vector=p=>{const lat=p.latitude*Math.PI/180,lon=p.longitude*Math.PI/180;return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];};
  const a=vector(from),b=vector(to),angle=Math.acos(Math.max(-1,Math.min(1,a.reduce((s,x,i)=>s+x*b[i],0))));
  const height=Math.min(1100000,Math.max(140000,angle*700000))*(1+index*.055);
  return Array.from({length:segments+1},(_,i)=>{
    const t=i/segments,s=Math.sin(angle),u=s<1e-8?1-t:Math.sin((1-t)*angle)/s,v=s<1e-8?t:Math.sin(t*angle)/s,p=a.map((x,j)=>x*u+b[j]*v);
    return {longitude:Math.atan2(p[1],p[0])*180/Math.PI,latitude:Math.atan2(p[2],Math.hypot(p[0],p[1]))*180/Math.PI,height:15000+Math.sin(t*Math.PI)*height};
  });
}
