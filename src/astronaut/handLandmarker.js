export async function createLocalHandLandmarker({signal}) {
  if (!globalThis.Worker || !globalThis.createImageBitmap) throw new Error("HAND_TRACKING_UNSUPPORTED");
  const worker = new Worker(new URL("./handTrackingWorker.js",import.meta.url),{type:"module"});
  let pending, closed=false;
  const aborted = () => new DOMException("Hand tracking stopped","AbortError");
  function close() {
    if (closed) return;
    closed=true;worker.terminate();signal.removeEventListener("abort",close);
    pending?.reject(aborted());pending=null;
  }
  signal.addEventListener("abort",close,{once:true});
  worker.onmessage = ({data}) => {
    if (data.type === "error") pending?.reject(new Error(data.message));
    else pending?.resolve(data.result);
    pending=null;
  };
  worker.onerror = event => {pending?.reject(new Error(event.message));pending=null;};
  function request(message,transfer=[]) {
    return new Promise((resolve,reject)=>{
      if (closed) {reject(aborted());return;}
      const timer=setTimeout(()=>{reject(new Error("HAND_TRACKING_TIMEOUT"));close();},message.type==="init"?45000:5000);
      pending={resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}};
      try {worker.postMessage(message,transfer);} catch(error) {pending.reject(error);pending=null;}
    });
  }
  if (signal.aborted) close();
  try {
    const base=new URL(import.meta.env.BASE_URL,window.location.href);
    await request({type:"init",wasmUrl:new URL("mediapipe/wasm",base).href,modelUrl:new URL("models/hand_landmarker.task",base).href});
    return {
      async detectForVideo(video,timestamp) {
        const bitmap=await createImageBitmap(video);
        if (closed) {bitmap.close();throw aborted();}
        return request({type:"frame",bitmap,timestamp},[bitmap]);
      },
      close,
    };
  } catch(error) {close();throw error;}
}
