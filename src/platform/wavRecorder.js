/**
 * Browser-native PCM 16-bit 16kHz mono WAV audio recorder using Web Audio API.
 * Produces clean, uncompressed audio/wav blobs supported natively by Sarvam AI.
 */

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type & fmt */
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (PCM = 1) */
  view.setUint16(20, 1, true);
  /* channel count (1 = mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * 1 * 2) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data subchunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  /* Write 16-bit PCM samples */
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export async function createWavRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass();
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch {}
  }
  const sampleRate = audioContext.sampleRate;
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const chunks = [];

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  let stopped = false;

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    try {
      source.disconnect();
      processor.disconnect();
      audioContext.close();
    } catch {}
    stream.getTracks().forEach((track) => track.stop());
  };

  return {
    stop: async () => {
      cleanup();
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      if (totalLength === 0) return null;

      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      // Downsample to 16kHz if audio context ran at higher rate
      const targetRate = 16000;
      let finalSamples = merged;
      if (sampleRate !== targetRate) {
        const ratio = sampleRate / targetRate;
        const newLength = Math.round(merged.length / ratio);
        finalSamples = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
          finalSamples[i] = merged[Math.round(i * ratio)];
        }
      }

      return encodeWav(finalSamples, targetRate);
    },
    cancel: () => {
      cleanup();
    },
  };
}

