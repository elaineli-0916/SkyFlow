import { readdir, readFile, writeFile, mkdir, copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import exifr from "exifr";
import { fileURLToPath } from "node:url";
import { PHOTO_MEMORY_MARKERS } from "../src/services/photoMemoryService.js";

const places=[
  {prefix:"beijing",city:"beijing",label:"北京",latitude:39.9042,longitude:116.4074},
  {prefix:"hongkong",city:"hong-kong",label:"香港",latitude:22.2936,longitude:114.1694},
  {prefix:"newyork",city:"new-york",label:"纽约",latitude:40.7308,longitude:-73.9973},
  {prefix:"collegepark",city:"maryland",label:"马里兰 · College Park",latitude:38.9897,longitude:-76.9378},
  {prefix:"anhui",city:"anhui",label:"安徽",latitude:31.86,longitude:117.28},
  {prefix:"zhangye",city:"zhangye",label:"张掖",latitude:38.93,longitude:100.45},
  {prefix:"yueyang",city:"yueyang",label:"岳阳",latitude:29.37,longitude:113.13},
  {prefix:"provideniya",city:"provideniya",label:"普罗维杰尼亚",latitude:64.694603,longitude:179.456572},
  {prefix:"los-angeles",city:"los-angeles",label:"洛杉矶",latitude:34.023839,longitude:-118.243058}
];
const captions={
  "beijing-bit-sunrise":"清晨，天空先醒来", "beijing-young":"最初的目光", "beijing-sunset":"落日留在城市边缘", "beijing-thedragon":"抬头，看见另一种形状",
  "newyork-graduation":"某个值得记住的日子", "newyork-washingtownsq":"华盛顿广场，一段流动的记忆",
  "collegepark-lab":"在微小之处，继续追问", "collegepark-moon":"实验室之外，还有月亮",
  "hongkong-victoria peak":"山顶，城市的灯慢慢亮起", "hongkong-victoriapeak2":"把目光交给远处", "hongkong-harbor":"海风与城市之间", "hongkong-ocean":"海面留住了一点光",
  "anhui":"山水之间", "zhangye-caynon":"大地的褶皱", "zhangye-caynon2":"时间留在岩石里", "yueyang":"落日经过水面", "los-angeles":"另一片海岸", "provideniya-morning":"远方的清晨", "provideniya-night":"飞行途中的夜色"
};
// User-supplied capture metadata takes precedence over embedded EXIF. Keep
// partial dates partial: a year or month must not be expanded into a day.
const userMetadata={
  "beijing-bit-sunrise.jpg":{capturedAt:"2019-10-31T06:22:17+08:00",latitude:39.729067,longitude:116.170877,precision:"second"},
  "collegepark-lab.jpg":{capturedAt:"2023-11-01T11:19:06-04:00",latitude:38.988833,longitude:-76.939972,precision:"second"},
  "collegepark-moon.jpg":{capturedAt:"2024-04-23T20:24:10-04:00",latitude:38.989272,longitude:-76.940925,precision:"second"},
  "hongkong-harbor.jpg":{capturedAt:"2025-10-06T14:33:07+08:00",latitude:22.292305,longitude:114.181262,precision:"second"},
  "newyork-graduation.jpg":{capturedAt:"2023-05-18T11:22:27-04:00",latitude:40.682547,longitude:-73.974495,precision:"second"},
  "newyork-washingtownsq.MOV":{capturedAt:"2021-09-18T17:56:18-04:00",latitude:40.730500,longitude:-73.996900,precision:"second"},
  "HongKong-Victoria Peak.jpg":{capturedAt:"2025-10-31T22:19:17+08:00",latitude:22.2759,longitude:114.1455,precision:"second"},
  "HongKong-VictoriaPeak2.jpg":{capturedAt:"2025-10-31",latitude:22.2759,longitude:114.1455,precision:"day"},
  "Hongkong-ocean.jpg":{capturedAt:"2025-10-26",latitude:22.2467,longitude:114.1757,precision:"day"},
  "anhui.jpg":{capturedAt:"2026-03-28",latitude:29.8670,longitude:118.4350,precision:"day"},
  "beijing-sunset.jpg":{capturedAt:"2019",latitude:39.9050,longitude:116.2220,precision:"year"},
  "beijing-thedragon.jpg":{capturedAt:"2026-01-07",latitude:39.8758,longitude:116.3935,precision:"day"},
  "beijing-young.jpg":{capturedAt:"2005",latitude:39.8580,longitude:116.3860,precision:"year"},
  "los-angeles.jpg":{capturedAt:"2019-12",latitude:34.0522,longitude:-118.2437,precision:"month"},
  "provideniya-morning.jpg":{capturedAt:"2019-12",latitude:64.4230,longitude:-173.2260,precision:"month"},
  "provideniya-night.jpg":{capturedAt:"2019-12",latitude:64.4230,longitude:-173.2260,precision:"month"},
  "yueyang.jpg":{capturedAt:"2024-11-01",latitude:29.3571,longitude:113.1290,precision:"day"},
  "zhangye-caynon.jpg":{capturedAt:"2024-08-17",latitude:38.9250,longitude:100.1280,precision:"day"},
  "zhangye-caynon2.jpg":{capturedAt:"2024-08-17",latitude:38.9250,longitude:100.1280,precision:"day"}
};
const memories=[];
const run=promisify(execFile);
let exiftoolAvailable=true;
try{await run("exiftool",["-ver"]);}catch{exiftoolAvailable=false;}

function parseExifDate(value, offset=""){
  if(value instanceof Date)return Number.isNaN(value.getTime())?null:value;
  if(typeof value!=="string")return null;
  const match=value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if(!match)return null;
  const [,year,month,day,hour,minute,second]=match;
  const zone=/^[+-]\d{2}:?\d{2}$/.test(offset)?offset.replace(/^(..)(\d{2})(\d{2})$/,"$1$2:$3"):"Z";
  const date=new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${zone}`);
  return Number.isNaN(date.getTime())?null:date;
}

async function readExiftool(sourcePath){
  if(!exiftoolAvailable)return null;
  try{
    const {stdout}=await run("exiftool",["-j","-n","-DateTimeOriginal","-CreateDate","-ModifyDate","-GPSLatitude","-GPSLongitude","-GPSLatitudeRef","-GPSLongitudeRef","-OffsetTimeOriginal","-OffsetTime",sourcePath]);
    const row=JSON.parse(stdout)?.[0];
    if(!row)return null;
    const offset=row.OffsetTimeOriginal??row.OffsetTime??"";
    const latitude=Number(row.GPSLatitude),longitude=Number(row.GPSLongitude);
    return {
      DateTimeOriginal:parseExifDate(row.DateTimeOriginal,offset),
      CreateDate:parseExifDate(row.CreateDate,offset),
      ModifyDate:parseExifDate(row.ModifyDate,offset),
      latitude:Number.isFinite(latitude)?latitude:null,
      longitude:Number.isFinite(longitude)?longitude:null,
    };
  }catch{return null;}
}
await mkdir(new URL("../public/sky-memories/previews/",import.meta.url),{recursive:true});
for(const filename of (await readdir(new URL("../public/sky-memories/",import.meta.url))).sort()){
  if(!/\.(jpe?g|png|webp|mov|mp4)$/i.test(filename))continue;
  const stem=filename.replace(/\.[^.]+$/,"").toLowerCase(),place=places.find(p=>stem.startsWith(p.prefix));
  if(!place)throw new Error(`No location mapping for ${filename}`);
  const video=/\.(mov|mp4)$/i.test(filename);
  // Parse the direction references too: filtering them out turns western
  // longitudes positive and would put the US photographs in Central Asia.
  const sourcePath=fileURLToPath(new URL(`../public/sky-memories/${encodeURIComponent(filename)}`,import.meta.url));
  let metadata=await exifr.parse(sourcePath).catch(()=>null);
  const metadataNeedsFallback=!metadata||!Number.isFinite(metadata.latitude)||!Number.isFinite(metadata.longitude)||!(metadata.DateTimeOriginal instanceof Date);
  if(metadataNeedsFallback){
    const fallback=await readExiftool(sourcePath);
    if(fallback)metadata={...metadata,...Object.fromEntries(Object.entries(fallback).filter(([,value])=>value!==null))};
  }
  const legacy=PHOTO_MEMORY_MARKERS.find(p=>p.imageUrl.endsWith(filename));
  const supplied=userMetadata[filename];
  const hasGPS=Number.isFinite(metadata?.latitude)&&Number.isFinite(metadata?.longitude);
  const date=metadata?.DateTimeOriginal??metadata?.CreateDate;
  const capturedAt=supplied?.capturedAt??(date instanceof Date&&!Number.isNaN(date.getTime())?date.toISOString():legacy?.capturedAt??null);
  const peak=stem.includes("victoria");
  const originalUrl=`/sky-memories/${encodeURIComponent(filename)}`;
  let url=originalUrl;
  // Some source files are HEIF despite their .jpg extension. Keep originals,
  // but serve a browser-compatible JPEG derivative for those four photographs.
  if(!video&&(await readFile(sourcePath)).subarray(4,12).toString().includes("ftyp")){
    const outputName=stem.replace(/[^a-z0-9]+/g,"-")+".jpg";
    const temporary=await mkdtemp(join(tmpdir(),"skyflow-memory-")),decoded=join(temporary,"decoded.jpg");
    try{
      // FFmpeg assembles HEIF tiles with an internal complex filtergraph;
      // decode first, then resize the normal JPEG in a separate invocation.
      await run("ffmpeg",["-y","-loglevel","error","-i",sourcePath,"-frames:v","1","-q:v","2",decoded]);
      await run("ffmpeg",["-y","-loglevel","error","-i",decoded,"-vf","scale=1600:1600:force_original_aspect_ratio=decrease","-q:v","2",fileURLToPath(new URL(`../public/sky-memories/previews/${outputName}`,import.meta.url))]);
    }finally{await rm(temporary,{recursive:true,force:true});}
    url=`/sky-memories/previews/${outputName}`;
  }
  if(video){
    const outputName=stem.replace(/[^a-z0-9]+/g,"-")+".mp4";
    await run("ffmpeg",["-y","-loglevel","error","-i",sourcePath,"-vf","scale=1280:-2","-c:v","libx264","-pix_fmt","yuv420p","-crf","23","-preset","fast","-c:a","aac","-b:a","128k","-movflags","+faststart",fileURLToPath(new URL(`../public/sky-memories/previews/${outputName}`,import.meta.url))]);
    url=`/sky-memories/previews/${outputName}`;
  }
  memories.push({id:stem.replace(/[^a-z0-9]+/g,"-"),city:place.city,label:place.label,title:captions[stem]??place.label,
    url,originalUrl,kind:video?"video":"image",capturedAt,capturePrecision:supplied?.precision??(capturedAt?"second":null),
    latitude:supplied?.latitude??(hasGPS?metadata.latitude:legacy?.latitude??(peak?22.2759:place.latitude)),
    longitude:supplied?.longitude??(hasGPS?metadata.longitude:legacy?.longitude??(peak?114.1497:place.longitude)),
    locationSource:supplied?"provided":hasGPS?"exif":legacy?"existing":"filename",
    locationNote:supplied?"用户补全的拍摄坐标":hasGPS?"照片拍摄坐标":legacy?"已保存的照片坐标":"按文件名标注的大致位置"});
}
await mkdir(new URL("../src/journey/",import.meta.url),{recursive:true});
await writeFile(new URL("../src/journey/memories.json",import.meta.url),JSON.stringify(memories,null,2)+"\n");
await copyFile(new URL("../public/audio/"+encodeURIComponent("落叶归根-王力宏#9wSJ.mp3"),import.meta.url),new URL("../public/audio/journey-luoye-guigen.mp3",import.meta.url));
console.log(`${memories.length} local memories prepared; ${memories.filter(m=>Number.isFinite(m.latitude)&&Number.isFinite(m.longitude)).length} with coordinates`);
