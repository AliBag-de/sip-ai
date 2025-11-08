export interface ICallbacks {
    onTranscription(item_id:string,ext: string): void
    onAssistantMessage(item_id:string,text: string): void
    onAudioFrame(frame: Buffer): void
    onError(error: Error): void
    onConnected(data:any):void
    onDisconnected(data:any):void
    onServiceMessage(data:any,isBinary:boolean):void


}