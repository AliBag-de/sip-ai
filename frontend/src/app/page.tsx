"use client";
import { useState, useRef, useEffect, ChangeEvent, useCallback } from "react";
import { Mic, MicOff, Upload, Wifi, WifiOff } from "lucide-react";
import floatTo16BitPCM, { base64ToArrayBuffer } from "../utils";
import { toast, ToastContainer } from "react-toastify";

interface InMessage {
  type: "ack" | "resume" | "error" | "message" | "transcript" | "assistant" | "audio" | "ping" | "pong";
  data?: string;
  status?: number;
  item_id?: string;
}

const MAX_16BIT_VALUE = 32768.0; // $2^{15}$
const TARGET_SAMPLE_RATE = 16000;
const TARGET_CHANNELS = 1; // Mono
const SAMPLES_PER_FRAME = 320; // 20ms target frame : 16000 * 0.02 = 320 sample

export default function AudioWebSocket() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("Waiting for connection...");
  const [transcripts, setTranscripts] = useState<InMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode>(null);
  const audioContextRef = useRef<AudioContext>(null);

  const assistantPlayerRef = useRef<AudioContext>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const [intervalId, setIntervalId] = useState<number | null>(null);

  const [bytesSent, setBytesSent] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [isErrorExist, setIsErrorExist] = useState(false);
  

  const initializeAudioContext = useCallback(() => {
    if (!assistantPlayerRef.current) {
      const AudioContext = window.AudioContext;
      assistantPlayerRef.current = new AudioContext();
    }
  }, []);

  const createBufferFromPCM = (arrayBuffer: any) => {
    const pcmData = new Int16Array(arrayBuffer); // Read 16-bit data
    const numFrames = pcmData.length; // Each 16-bit value is a frame.
    const buffer = assistantPlayerRef.current!.createBuffer(1, numFrames, 24000);
    const floatOutput = buffer.getChannelData(0);

    for (let i = 0; i < numFrames; i++) {
      floatOutput[i] = pcmData[i] / MAX_16BIT_VALUE;
    }
    return buffer;
  };

  const playNextSegment = useCallback(() => {
    if (!assistantPlayerRef.current || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;
    const buffer = audioQueueRef.current.shift() || null;
    const source = assistantPlayerRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(assistantPlayerRef.current.destination);

    const startTime = assistantPlayerRef.current.currentTime;
    source.start(startTime);

    source.onended = () => {
      playNextSegment();
    };
  }, []);

  const handleAudioContext = useCallback(
    async (base64Data: string) => {
      try {
        initializeAudioContext();
        const audioData = base64ToArrayBuffer(base64Data);
        const audioBuffer = createBufferFromPCM(audioData);
        audioQueueRef.current.push(audioBuffer);
      } catch (e) {
        console.log(e);
      }
    },
    [initializeAudioContext, playNextSegment]
  );

  const startPlaying = () => {
    // initializeAudioContext();
    // if (!isPlayingRef.current && audioQueueRef.current.length > 0) {
    //   playNextSegment();
    // }
    isPlayingRef.current = false;
    assistantPlayerRef.current?.close();
    audioQueueRef.current = [];
    if (isPlayingRef.current) sourceRef.current?.disconnect();
  };

  useEffect(() => {
    if (!isConnected && intervalId) {
      clearInterval(intervalId);
    } else if (isConnected) {
      const interval = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "ping" }));
        }
      }, 5000);
      setIntervalId(Number(interval));
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isConnected]);

  const connectToAI = useCallback(() => {
    if (typeof window === "undefined") return;
    setIsErrorExist(false);
    let clientId = localStorage.getItem("clientId");
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem("clientId", clientId);
    }

    const ws = new WebSocket(`ws://127.0.0.1:4000/sip-stream?clientId=${clientId}`);

    ws.onopen = () => {
      setIsConnected(true);
      setStatus("Connection established ✓");
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      const message: InMessage = JSON.parse(event.data);


      switch (message.type) {
        case "transcript":
        case "assistant":
          setTranscripts((prev) => {
            return [message, ...prev];
          });

          break;
        case "audio":
          handleAudioContext(message.data as string);
          if (!isPlayingRef.current && audioQueueRef.current.length > 0) {
            playNextSegment();
          }
        case "pong":
          console.log("Ping Response :", message.type);
          break;
          case "error":
          const error=message.data
          console.log(error)
          toast.error(error,{
            position: "top-right",
            autoClose: 5000,
           
          })
          setIsErrorExist(true);
          break;
        default:

          break;
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setStatus("Connection error ✗");
    };

    ws.onclose = () => {
      setIsConnected(false);
      setStatus("Connection lost");
      console.log("The WebSocket connection has been closed");
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    return () => {
      // Close connection when exit page
      console.log("useEffect WS closed");
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const startStreaming = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: TARGET_SAMPLE_RATE,
          channelCount: TARGET_CHANNELS,
          frameRate: SAMPLES_PER_FRAME,
        },
        video: false,
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });

      await audioContext.audioWorklet.addModule("/audioWorklets/pcm-processor.js");
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
      workletRef.current = workletNode;

      // console.log(source)

      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const floatFrame = event.data;
        const pcm16 = floatFrame;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const size = pcm16.length * (3 / 4);
          setBytesSent((prev) => prev + size);
          const audioData = JSON.stringify({
            type: "audio",
            data: pcm16,
          });
          wsRef.current.send(audioData);
        }
      };

      source.connect(workletNode).connect(audioContext.destination);
      setIsStreaming(true);
      setStatus("🔴 Real-time transmission");
      setBytesSent(0);
    } catch (error) {
      console.error("Microphone access error:", error);
      setStatus("Microphone access denied ✗");
    }
  };

  // Stop streaming
  const stopStreaming = () => {
    if (isStreaming) {
      try {
        sourceRef.current!.disconnect();
        workletNodeRef.current!.disconnect();
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          audioContextRef.current.close();
        }
      } catch (e) {
        console.warn("Already disconnected:", e);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
    setIsStreaming(false);
    setStatus("Broadcast stopped");
  };
  // Upload audio file
  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    const file = event.target.files[0];
    if (file && file.type.startsWith("audio/")) {
      setStatus("File is being sent...");
      sendAudioData(file);
    } else {
      setStatus("Please select an audio file ✗");
    }
  };

  // Send audio data via WebSocket
  const sendAudioData = async (audioBlob: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const CHUNK_MS = 20;

      // WAV dosyasını decode et
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const sampleRate = audioBuffer.sampleRate;
      const channelData = audioBuffer.getChannelData(0); // mono alıyoruz
      const samplesPerChunk = Math.floor((sampleRate * CHUNK_MS) / 1000);

      console.log(`Sample rate: ${sampleRate}Hz, total samples: ${channelData.length}`);

      for (let i = 0; i < channelData.length; i += samplesPerChunk) {
        const frame = channelData.slice(i, i + samplesPerChunk);
        const message = {
          type: "audio",
          data: Array.from(frame), // Float32Array → normal dizi
        };

        wsRef.current.send(JSON.stringify(message));
        await new Promise((r) => setTimeout(r, CHUNK_MS / 2)); // küçük gecikme (opsiyonel)
      }

      console.log("Voice data sent:", (audioBuffer.length * 3) / 4, "bytes");
    } else {
      setStatus("No WebSocket connection ✗");
      console.error("Not connected to WebSocket");
    }
  };

  return (
    <>
     <ToastContainer />
    
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">SIP-AI-Text Synthesiser</h1>
          <p className="text-gray-600 mb-8">Use the microphone or upload an audio file</p>

          {/* Connection Status */}
          <div className="flex relative  items-center justify-between gap-3 mb-8 p-4 bg-sky-50 rounded-lg">
            <div className="flex flex-1  items-center gap-3">
              {isConnected ? <Wifi className="text-green-500" size={24} /> : <WifiOff className="text-red-500" size={24} />}

              <div>
                <p className="font-semibold text-gray-700">{isConnected ? "Connected" : "No connection"}</p>
                <p className="text-sm text-gray-500">{status}</p>
              </div>
            </div>
            <div className="h-full absolute right-0 py-1  cursor-pointer ">
              <button
                onClick={() => (isConnected ? wsRef.current!.close() : connectToAI())}
                className={`cursor-pointer rounded-r-lg ${isConnected ? "bg-red-600" : "bg-green-600"} h-full px-4 py-2 text-black-700 ring`}
              >
                {isConnected ? "Terminate" : "Connect"}
              </button>
            </div>
          </div>

          {/* Use the Microphone */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Use the Microphone</h2>
            <button
              onClick={isStreaming ? stopStreaming : startStreaming}
              disabled={!isConnected || isErrorExist}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-3 ${
                isStreaming ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              }`}
            >
              {isStreaming ? (
                <>
                  <MicOff size={24} />
                  Stop streaming
                </>
              ) : (
                <>
                  <Mic size={24} />
                  Start talking
                </>
              )}
            </button>
          </div>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or</span>
            </div>
          </div>

          {/* File Upload */}
          <div className="">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Upload Audio File</h2>
            <label
              className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-3 cursor-pointer ${
                (isConnected && !isErrorExist) ? "bg-green-500 hover:bg-green-600" : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              <Upload size={24} />
              Select Audio File
              <input type="file" accept="audio/*" onChange={handleFileUpload} disabled={!isConnected || isErrorExist} className="hidden" />
            </label>
          </div>

          {/* Information Box */}
          <div className="mt-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <button className="p-2 bg-sky-400 self-end m-2 cursor-pointer rounded-lg" onClick={startPlaying}>
              {isPlayingRef.current ? "Stop " : "Ready"}
            </button>
            <div className=" ring ring-blue-100 bg-blue-300">
              {transcripts.map((message, index) => {
                return (
                  <p key={index} className={`text-black  p-1 ${message!.type === "assistant" ? "bg-emerald-200" : "bg-red-200"}`}>
                    {message!.data}
                  </p>
                );
              })}
            </div>
            <div className="mb-2 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Data Sent</p>
                  <p className="text-2xl font-bold text-purple-600">{(bytesSent / 1024).toFixed(1)} KB</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Audio Format</p>
                  <p className="text-2xl font-bold text-purple-600"></p>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  {isStreaming ? <span className="text-sm font-semibold text-red-600">Streaming</span> : <span className="text-sm font-semibold text-gray-600">Not streaming</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
