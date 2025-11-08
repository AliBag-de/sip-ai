class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.samplesPerFrame = 320; // 20ms @ 16kHz
  }
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const ch = input[0];
      for (let i = 0; i < ch.length; i++) this.buffer.push(ch[i]);
      while (this.buffer.length >= this.samplesPerFrame) {
        const frame = this.buffer.splice(0, this.samplesPerFrame);
        this.port.postMessage(frame);
      }
    }
    return true;
  }
}
registerProcessor("pcm-processor", PCMProcessor);
