declare function registerProcessor(name: string, processorCtor: any): void;

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: any)
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}
