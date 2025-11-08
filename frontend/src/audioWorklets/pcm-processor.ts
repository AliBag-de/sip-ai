
// This file may be located in the public directory or under /src/audioWorklets
// If you are using Webpack/Vite, it is loaded as an asset



class PCMProcessor extends AudioWorkletProcessor   {
  private buffer: number[]
  private samplesPerFrame = 320; // 20ms @ 16kHz
  constructor() {
    super(); 
    this.buffer = [];
    this.samplesPerFrame = 320; // 20ms @ 16kHz mono
  }
  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (input && input[0]) {
      const channelData = input[0];
      this.buffer.push(...channelData);

      while (this.buffer.length >= this.samplesPerFrame) {
        const frame = this.buffer.splice(0, this.samplesPerFrame);
        this.port.postMessage(frame);
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
