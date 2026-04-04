// AudioWorklet processor for real-time PCM audio processing
// This runs in a separate thread and processes audio from the microphone

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);
    this.targetSampleRate = 16000;
    this.chunkSize = 16000; // 1.0 second at 16kHz
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (!input || input.length === 0) {
      return true;
    }

    // Get mono channel data
    const channelData = input[0];

    if (!channelData || channelData.length === 0) {
      return true;
    }

    // Downsample if needed (AudioContext might not be exactly 16kHz)
    const downsampledData = this.downsample(channelData, sampleRate, this.targetSampleRate);

    // Add to buffer
    const newBuffer = new Float32Array(this.buffer.length + downsampledData.length);
    newBuffer.set(this.buffer);
    newBuffer.set(downsampledData, this.buffer.length);
    this.buffer = newBuffer;

    // Send chunks when buffer is large enough
    if (this.buffer.length >= this.chunkSize) {
      const chunk = this.buffer.slice(0, this.chunkSize);
      this.buffer = this.buffer.slice(this.chunkSize);

      // Convert to Int16 PCM
      const pcmData = this.float32ToInt16(chunk);

      // Send to main thread
      this.port.postMessage({
        pcmData: pcmData,
      });
    }

    return true;
  }

  /**
   * Downsample audio from source sample rate to target sample rate
   */
  downsample(input, fromRate, toRate) {
    if (fromRate === toRate) {
      return input;
    }

    const ratio = fromRate / toRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      // Simple linear interpolation for downsampling
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const fraction = srcIndex - srcIndexFloor;

      // Linear interpolation between samples
      output[i] = input[srcIndexFloor] * (1 - fraction) + input[srcIndexCeil] * fraction;
    }

    return output;
  }

  /**
   * Convert Float32 audio samples (-1.0 to 1.0) to Int16 PCM (-32768 to 32767)
   */
  float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);

    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] range
      const sample = Math.max(-1, Math.min(1, float32Array[i]));

      // Convert to 16-bit integer
      // Negative values: multiply by 32768 (0x8000)
      // Positive values: multiply by 32767 (0x7FFF)
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return int16Array;
  }
}

// Register the processor
registerProcessor('audio-processor', AudioProcessor);
