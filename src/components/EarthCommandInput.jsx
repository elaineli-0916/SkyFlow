import { Image, Mic, Send, Square, X } from "lucide-react";
import { useRef, useState } from "react";

function EarthCommandInput({ response, onSubmit, busy }) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [voiceState, setVoiceState] = useState("idle");
  const [voiceError, setVoiceError] = useState("");
  const recorderRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const command = value.trim();
    if (!command && attachments.length === 0) return;
    await onSubmit({ text: command, attachments });
    setValue("");
    setAttachments([]);
  }

  async function handleFiles(files, kind) {
    const nextAttachments = await Promise.all(
      Array.from(files).map(async (file) => ({
        kind,
        name: file.name,
        mimeType: file.type,
        dataUrl: await readAsDataUrl(file)
      }))
    );

    setAttachments((current) => [...current, ...nextAttachments].slice(0, 4));
  }

  function removeAttachment(index) {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleVoiceButton() {
    if (voiceState === "recording") {
      await stopVoiceRecording();
      return;
    }

    await startVoiceRecording();
  }

  async function startVoiceRecording() {
    setVoiceError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Microphone input is not available in this browser.");
      return;
    }

    try {
      const recorder = await createPcmRecorder();
      recorderRef.current = recorder;
      setVoiceState("recording");
    } catch (error) {
      setVoiceState("idle");
      setVoiceError(error.message || "Could not open the microphone.");
    }
  }

  async function stopVoiceRecording() {
    const recorder = recorderRef.current;
    if (!recorder) return;

    setVoiceState("transcribing");
    recorderRef.current = null;

    try {
      const audioBase64 = await recorder.stop();
      const transcript = await transcribeMicrophoneAudio(audioBase64);

      if (!transcript) {
        setVoiceError("I did not catch any speech.");
        setVoiceState("idle");
        return;
      }

      setValue(transcript);
      await onSubmit({ text: transcript, attachments: [] });
      setValue("");
      setAttachments([]);
      setVoiceState("idle");
    } catch (error) {
      setVoiceError(error.message || "Voice transcription failed.");
      setVoiceState("idle");
    }
  }

  return (
    <div className="earth-command">
      <form className="earth-command-form" onSubmit={handleSubmit}>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ask the Earth..."
          aria-label="Ask the Earth"
        />
        <label className="earth-command-file-button" aria-label="Attach image" title="Attach image">
          <Image size={15} />
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => handleFiles(event.target.files, "image")}
          />
        </label>
        <button
          type="button"
          className={voiceState === "recording" ? "recording" : ""}
          aria-label={voiceState === "recording" ? "Stop voice input" : "Start voice input"}
          aria-pressed={voiceState === "recording"}
          title={voiceState === "recording" ? "Stop voice input" : "Start voice input"}
          disabled={busy || voiceState === "transcribing"}
          onClick={handleVoiceButton}
        >
          {voiceState === "recording" ? <Square size={13} /> : <Mic size={15} />}
        </button>
        <button type="submit" aria-label="Send Earth command" title="Send Earth command" disabled={busy}>
          <Send size={15} />
        </button>
      </form>
      {(voiceState === "recording" || voiceState === "transcribing" || voiceError) && (
        <p className={`earth-command-voice-status ${voiceState === "recording" ? "recording" : ""}`}>
          {voiceState === "recording" && "Listening... tap again to send"}
          {voiceState === "transcribing" && "Transcribing with Paraformer..."}
          {voiceState === "idle" && voiceError}
        </p>
      )}
      {attachments.length > 0 && (
        <div className="earth-command-attachments">
          {attachments.map((attachment, index) => (
            <button key={`${attachment.name}-${index}`} type="button" onClick={() => removeAttachment(index)}>
              <span>{attachment.kind}</span>
              <strong>{attachment.name}</strong>
              <X size={12} />
            </button>
          ))}
        </div>
      )}
      {response && <p className="earth-command-response">{response}</p>}
    </div>
  );
}

async function transcribeMicrophoneAudio(audioBase64) {
  const response = await fetch("/api/asr/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      audioBase64,
      format: "pcm",
      sampleRate: 16000
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Could not transcribe the microphone audio.");
  }

  const result = await response.json();
  return String(result.text || "").trim();
}

async function createPcmRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true
    }
  });
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const chunks = [];

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(floatToPcm16(downsampleBuffer(input, audioContext.sampleRate, 16000)));
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  return {
    async stop() {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close();
      return `data:audio/pcm;base64,${bytesToBase64(mergeChunks(chunks))}`;
    }
  };
}

function downsampleBuffer(buffer, inputRate, outputRate) {
  if (inputRate === outputRate) return buffer;

  const ratio = inputRate / outputRate;
  const length = Math.round(buffer.length / ratio);
  const result = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(Math.floor((index + 1) * ratio), buffer.length);
    let total = 0;

    for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
      total += buffer[inputIndex];
    }

    result[index] = total / Math.max(1, end - start);
  }

  return result;
}

function floatToPcm16(buffer) {
  const bytes = new Uint8Array(buffer.length * 2);
  const view = new DataView(bytes.buffer);

  for (let index = 0; index < buffer.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, buffer[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return bytes;
}

function mergeChunks(chunks) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const merged = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function bytesToBase64(bytes) {
  let binary = "";
  const batchSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + batchSize));
  }

  return btoa(binary);
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

export default EarthCommandInput;
