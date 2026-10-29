// Helper utilities for PCM audio encoding/decoding with Gemini Live API

export function pcmFloat32ToBase64(float32Array: Float32Array): string {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  let binary = '';
  const bytes = new Uint8Array(int16Array.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function playPcmChunk(
  ctx: AudioContext,
  base64Data: string,
  timeState: { nextStartTime: number; activeSources: AudioBufferSourceNode[] }
) {
  try {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    // Live API output is 24kHz single channel
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, timeState.nextStartTime);
    source.start(startTime);
    timeState.nextStartTime = startTime + buffer.duration;
    timeState.activeSources.push(source);

    source.onended = () => {
      const idx = timeState.activeSources.indexOf(source);
      if (idx > -1) timeState.activeSources.splice(idx, 1);
    };
  } catch (err) {
    console.error('Failed to play PCM audio chunk:', err);
  }
}
