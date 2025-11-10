import { api, StreamInOut } from "encore.dev/api";
import { IClient, IHandshake, InMessage, OutMessage } from "../types/sipt-stream.types";
import { OpenAiRealtimeClient } from "../lib/sip-client";
import { ICallbacks } from "../types/callbaks";
import floatTo16BitPCM from "../util/audio";



const clients = new Map<string, IClient>()

export const manageStream = async (handshake: IHandshake, stream: StreamInOut<InMessage, OutMessage>, aiWS: OpenAiRealtimeClient): Promise<void> => {
    try {
        for await (const income of stream) {
            // console.log("data",income)
            switch (income.type) {
                case "audio":
                case "audio_f":
                    const pcm16 = floatTo16BitPCM(income.data as Float32Array<ArrayBufferLike>);
                    const msg = JSON.stringify({
                        type: "input_audio_buffer.append",
                        audio: pcm16,
                    }); // base64 PCM16
                    aiWS.sendMessage(msg);
                    if (income.type === "audio_f") {
                        aiWS.sendMessage(JSON.stringify({ type: "input_audio_buffer.commit" }));
                        aiWS.sendMessage(JSON.stringify({ type: "response.create" }));

                    }
                    // aiWS.sendMessage(JSON.stringify({ type: "input_audio_buffer.commit" }));
                    break;
                case "message":

                    break;
                case "ping":
                    stream.send({ type: "pong", status: 200 });
                    break;
                default:
                    break;
            }
        }
    } catch (err) {
        console.error("stream error:", err, handshake);
    }
};

export const sipstream = api.streamInOut<IHandshake, InMessage, OutMessage>(
    {
        path: "/sip-stream",
        expose: true,
        auth: false,
    },
    async (handshake: IHandshake, stream) => {
        const callbacks: ICallbacks = {
            onTranscription: (item_id: string, text: string) => {
                stream.send({ type: "transcript", data: text, status: 200, item_id });
            },
            onAssistantMessage: (item_id: string, text: string) => {
                stream.send({ type: "assistant", data: text, status: 200, item_id });
            },
            onAudioFrame: (frame: any) => {
                // console.log(`SOUND FRAMEWORK: ${frame.length} bayt alındı.`);
                const binaryData = Buffer.from(frame, "base64");
                stream.send({ type: "audio", data: frame, status: 200 });
            },
            onError: (error: Error) => {
                console.error(`APPLICATION ERROR: ${error.message}`);
                stream.send({ type: "error", data: error.message, status: 500 });
            },
            onConnected: (socketId: string) => {
                console.log("AI connected", socketId);
            },
            onDisconnected: (socketId: string) => {
                console.log("AI disconnected", socketId);
            },
            onServiceMessage: (data: any, isBinary: boolean) => { },
        };
        const client = clients.get(handshake?.clientId)
        let aiWS = client?.openAISessions;
        try {
            console.log("sip-stream", handshake.clientId);
            if (!client) {
                aiWS = new OpenAiRealtimeClient(callbacks);
                clients.set(handshake?.clientId, {
                    clienSocket: stream,
                    openAISessions: aiWS,
                    connected: false
                })
            }
            aiWS!.connect();
            await manageStream(handshake, stream, aiWS!);
        } catch (err) {
            console.error("stream error:", err, handshake);
        }
        console.warn("Client Disconnected :", handshake);
        clients.delete(handshake?.clientId)
        aiWS!.close();
    }
);
