import { API_KEY, API_URL } from "../services/encore.service";
import { ICallbacks } from "../types/callbaks";
import WebSocket from "ws";
import { OpenAIRealtimeEventType } from "../types/openAiEventTypes";

const EVENT = {
  type: "session.update",
  session: {
    // audio: {
    //     input: {
    //         format: {
    //             type: "audio/pcm",
    //             rate: 16000,
    //         },
    //     },
    // },
    // Lock the output to audio (set to ["text"] if you want text without audio)
    // output_modalities: ["text"],
    modalities: ["audio", "text"],
    // Server-VAD: commits itself when the conversation ends
    turn_detection: { type: "server_vad", silence_duration_ms: 800 },

    input_audio_format: "pcm16",
    // activate the transcript
    input_audio_transcription: { model: "gpt-4o-mini-transcribe" },

    // Output sound settings
    voice: "alloy",
    output_audio_format: "pcm16",
    instructions: "Speak clearly and briefly. Confirm understanding before taking actions. Reply in the language I spoke"

  },
};


export class OpenAiRealtimeClient {
  private aiWS: WebSocket | null;
  private options: WebSocket.ClientOptions | undefined;
  private callbacks: ICallbacks;
  private url: string;
  private api_key: string;

  constructor(callbacks: ICallbacks, options = {}) {
    this.aiWS = null;
    this.url = API_URL() || "GPT_URL";
    this.api_key = API_KEY() || "GPT_API_KEY";

    this.options = {
      headers: {
        Authorization: "Bearer " + this.api_key,
        "OpenAI-Beta": "realtime=v1",
      },
    };
    this.callbacks = callbacks;
  }
  public close() {
    this.aiWS?.close();
  }

  public connect() {
    if (this.aiWS && this.aiWS.OPEN) {
      console.log(this.aiWS);
      console.log("Already Connected");
      return;
    }
    // return{ status: 200, message: "Already Connected" }
    try {
      this.aiWS = new WebSocket(this.url!, this.options);
      console.log("AI Connection succesfully");
      this.eventListeners();
    } catch {
      console.warn("AI Connection failed");
    }
  }

  public sendMessage<T>(data: string, event?: string) {
    if (!this.aiWS || !this.aiWS.OPEN) {
      console.warn("AI Socket is not connected");
      return;
    }

    this.aiWS.send(data);
  }

  private eventListeners() {
    if (!this.aiWS) return;

    this.aiWS.on("open", () => {
      this.sendMessage(JSON.stringify(EVENT));
      this.callbacks.onConnected(this.aiWS?.OPEN);
    });

    this.aiWS.on("close", () => {
      this.callbacks.onDisconnected(this.aiWS?.CLOSED);
    });

    this.aiWS.on("error", (err) => {
      this.callbacks.onError(err);
    });

    this.aiWS.on("message", (message, isBinary) => {
      const parsedData = JSON.parse(message as any);

      if (!parsedData?.type.includes(".audio.delta")) console.log(parsedData.type)
      this.callbacks.onServiceMessage(parsedData, isBinary);
      switch (parsedData?.type) {
        case OpenAIRealtimeEventType.ResponseTextDone:
        case OpenAIRealtimeEventType.ResponseAudioTranscriptDone:
          this.callbacks.onAssistantMessage(parsedData.item_id, parsedData?.transcript);
          break;
        case OpenAIRealtimeEventType.ResponseAudioTranscriptDone:
        case OpenAIRealtimeEventType.ConversationItemInputAudioTranscriptionCompleted:
          this.callbacks.onTranscription(parsedData.item_id, parsedData?.transcript);
          break;
        case OpenAIRealtimeEventType.ConversationItemInputAudioTranscriptionDelta:
          // this.callbacks.onTranscription(parsedData.item_id,parsedData?.delta)
          break;
        case OpenAIRealtimeEventType.ResponseAudioDelta:
          this.callbacks.onAudioFrame(parsedData?.delta);
          break;
        default:
          break;
      }
    });
  }
}
