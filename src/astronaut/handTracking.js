import { createHandGestureFilter, HAND_CONTROL } from "./handGestures.js";

const defaultDetector = async options => {
  const {createLocalHandLandmarker}=await import("./handLandmarker.js");
  return createLocalHandLandmarker(options);
};

export function cameraErrorMessage(error) {
  if (["NotAllowedError","SecurityError"].includes(error?.name)) return "摄像头未获授权 · 可继续使用鼠标";
  if (["NotFoundError","NotReadableError","OverconstrainedError"].includes(error?.name)) return "摄像头不可用 · 可继续使用鼠标";
  if (error?.message==="HAND_TRACKING_UNSUPPORTED") return "当前浏览器不支持手势追踪";
  return "手势追踪暂不可用 · 可继续使用鼠标";
}

// The session owns every camera resource. stop() is safe during permission prompts,
// model loading, inference, React unmount and the transition into Journey.
export function createHandTrackingSession({
  video, onIntent=()=>{}, onLandmarks=()=>{}, onStatus=()=>{}, onStop=()=>{},
  mediaDevices=globalThis.navigator?.mediaDevices, createDetector=defaultDetector,
  requestFrame=callback=>requestAnimationFrame(callback), cancelFrame=id=>cancelAnimationFrame(id),
  clock=()=>performance.now(),
  documentTarget=globalThis.document, windowTarget=globalThis.window,
}) {
  const abort=new AbortController(),filter=createHandGestureFilter();
  let stopped=false,started=false,stream=null,detector=null,frame=null;
  let lastInference=-Infinity,lastVideoTime=-1,lastStatus="";
  function status(value) {if (!stopped && value!==lastStatus) {lastStatus=value;onStatus(value);}}
  function neutral() {onIntent(filter.reset());onLandmarks([]);}
  function stop() {
    if (stopped) return;
    stopped=true;abort.abort();
    if (frame!==null) cancelFrame(frame);
    stream?.getTracks().forEach(track=>track.stop());
    detector?.close();detector=null;
    if (video.srcObject===stream) {video.pause();video.srcObject=null;}
    neutral();
    onStop();
  }
  function fail(error) {status(cameraErrorMessage(error));stop();}
  function visibility() {
    neutral();lastVideoTime=-1;
    if (documentTarget?.hidden) status("摄像头已开启 · 追踪已暂停");
  }
  documentTarget?.addEventListener("visibilitychange",visibility,{signal:abort.signal});
  windowTarget?.addEventListener("pagehide",stop,{signal:abort.signal});

  async function tick(now) {
    if (stopped) return;
    if (!documentTarget?.hidden && video.readyState>=2 && video.currentTime!==lastVideoTime && now-lastInference>=HAND_CONTROL.frameInterval) {
      lastInference=now;lastVideoTime=video.currentTime;
      try {
        const result=await detector.detectForVideo(video,now);
        if (stopped) return;
        if (documentTarget?.hidden || clock()-now>HAND_CONTROL.staleFrame) {neutral();}
        else {
          const intent=filter.update(result,now);
          onIntent(intent);
          const landmarks=result.landmarks||[],strength=Math.round(Math.max(Math.abs(intent.lateral),Math.abs(intent.zoom))*100);
          onLandmarks(landmarks);
          status(!landmarks.length ? "摄像头已开启 · 请伸出一只手" :
            intent.lateral ? `已识别手掌 · ${intent.lateral>0?"向右":"向左"}环绕 ${strength}%` :
            intent.zoom ? `已识别手掌 · ${intent.zoom>0?"靠近":"远离"} ${strength}%` : "已识别手掌 · 等待动作");
        }
      } catch(error) {if (!stopped) fail(error);return;}
    }
    if (!stopped) frame=requestFrame(tick);
  }
  async function start() {
    if (started||stopped) return;
    started=true;
    try {
      if (!mediaDevices?.getUserMedia) throw new Error("HAND_TRACKING_UNSUPPORTED");
      status("等待摄像头授权");
      const acquired=await mediaDevices.getUserMedia({audio:false,video:{facingMode:"user",width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}}});
      if (stopped) {acquired.getTracks().forEach(track=>track.stop());return;}
      stream=acquired;video.srcObject=stream;
      for (const track of stream.getTracks()) track.addEventListener("ended",()=>fail(new DOMException("Camera ended","NotReadableError")),{signal:abort.signal});
      await video.play();
      if (stopped) return;
      status("摄像头已开启 · 正在载入手势");
      const loaded=await createDetector({signal:abort.signal});
      if (stopped) {loaded.close();return;}
      detector=loaded;status("摄像头已开启 · 请伸出一只手");
      frame=requestFrame(tick);
    } catch(error) {if (!stopped) fail(error);}
  }
  return {start,stop};
}
