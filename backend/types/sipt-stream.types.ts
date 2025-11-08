import { StreamInOut } from "encore.dev/api";
import WebSocket from "ws";
import { OpenAiRealtimeClient } from "../lib/sip-client";

export interface IHandshake  {
    clientId:string;
}

export interface IClient{
  clienSocket :StreamInOut<InMessage, OutMessage>
  openAISessions:OpenAiRealtimeClient;
  connected:boolean
}


export interface InMessage {
    type: "audio" | "ping" | "message" | "audio_f";
    data?: string | any;
}

export interface OutMessage {
    type: "ack" | "resume" | "error" | "message" | "transcript" | "assistant" | "audio" | "ping" | "pong";
    data?: string | any;
    item_id?: string;
    status?: number;
}

