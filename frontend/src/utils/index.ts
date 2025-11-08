const floatTo16BitPCM = (float32Array: Float32Array): string => {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const base64Data = arrayBufferToBase64(buffer)
  return base64Data;
}

//Array Buffer -> Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}



// Base64 -> ArrayBuffer
export const base64ToArrayBuffer = (base64Data: string): ArrayBuffer => {
  const rawBinaryData = atob(base64Data);
  const audioData = new Uint8Array(rawBinaryData.length);
  for (let i = 0; i < rawBinaryData.length; i++) {
    audioData[i] = rawBinaryData.charCodeAt(i);
  }
  return audioData.buffer;
}


export default { floatTo16BitPCM, arrayBufferToBase64 };