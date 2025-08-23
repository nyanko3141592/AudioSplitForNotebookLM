// Alternative audio splitting using Web Audio API for better compatibility
export class WebAudioSplitter {
  private audioContext: AudioContext | null = null;

  async splitAudioBySize(file: File, maxSizeBytes: number): Promise<Blob[]> {
    return this.splitAudio(file, 'size', { maxSize: maxSizeBytes });
  }

  async splitAudioByCount(file: File, count: number): Promise<Blob[]> {
    return this.splitAudio(file, 'count', { count });
  }

  private async splitAudio(
    file: File, 
    mode: 'size' | 'count', 
    options: { maxSize?: number; count?: number }
  ): Promise<Blob[]> {
    try {
      // Initialize AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const sampleRate = audioBuffer.sampleRate;
      const numberOfChannels = audioBuffer.numberOfChannels;
      const duration = audioBuffer.duration;
      
      console.log('Original file info:', {
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        duration: duration.toFixed(2) + ' seconds',
        sampleRate,
        channels: numberOfChannels
      });
      
      let numParts: number;
      
      if (mode === 'size' && options.maxSize) {
        // Simple calculation: divide original file size by max size
        numParts = Math.ceil(file.size / options.maxSize);
        console.log(`Size-based splitting: ${file.size} bytes / ${options.maxSize} bytes = ${numParts} parts`);
      } else if (mode === 'count' && options.count) {
        numParts = options.count;
        console.log(`Count-based splitting: ${numParts} parts`);
      } else {
        throw new Error('Invalid split parameters');
      }
      
      const partDuration = duration / numParts;
      const results: Blob[] = [];
      
      console.log(`Creating ${numParts} parts, each ${partDuration.toFixed(2)} seconds long`);
      
      for (let i = 0; i < numParts; i++) {
        const startTime = i * partDuration;
        const endTime = Math.min((i + 1) * partDuration, duration);
        const actualDuration = endTime - startTime;
        
        if (actualDuration <= 0) continue;
        
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const partLength = endSample - startSample;
        
        console.log(`Part ${i + 1}: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s (${actualDuration.toFixed(2)}s, ${partLength} samples)`);
        
        // Create new AudioBuffer for this part
        const partBuffer = this.audioContext.createBuffer(
          numberOfChannels,
          partLength,
          sampleRate
        );
        
        // Copy audio data
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const originalData = audioBuffer.getChannelData(channel);
          const partData = partBuffer.getChannelData(channel);
          
          for (let j = 0; j < partLength; j++) {
            partData[j] = originalData[startSample + j] || 0;
          }
        }
        
        // Convert to WAV blob
        // Use 8-bit compression to reduce file size while maintaining compatibility
        const blob = await this.audioBufferToWav(partBuffer, true);
        const sizeInMB = (blob.size / 1024 / 1024).toFixed(2);
        console.log(`Part ${i + 1} created: ${sizeInMB} MB`);
        results.push(blob);
      }
      
      return results;
    } catch (error) {
      console.error('Web Audio splitting failed:', error);
      throw error;
    }
  }

  private async audioBufferToWav(audioBuffer: AudioBuffer, compress = false): Promise<Blob> {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    
    // Use 8-bit if compression is requested to reduce file size
    const bytesPerSample = compress ? 1 : 2;
    
    // Create WAV header
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * bytesPerSample);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * bytesPerSample, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
    view.setUint16(32, numberOfChannels * bytesPerSample, true);
    view.setUint16(34, bytesPerSample * 8, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * bytesPerSample, true);
    
    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        
        if (compress) {
          // 8-bit PCM (unsigned)
          const value = Math.round((sample + 1) * 127.5);
          view.setUint8(offset, Math.max(0, Math.min(255, value)));
          offset += 1;
        } else {
          // 16-bit PCM (signed)
          const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          view.setInt16(offset, Math.max(-32768, Math.min(32767, value)), true);
          offset += 2;
        }
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }
}

// Fallback function that attempts Web Audio API
export const splitAudioFile = async (
  file: File,
  mode: 'size' | 'count',
  options: { maxSize?: number; count?: number },
  progressCallback?: (progress: number) => void
): Promise<Blob[]> => {
  const splitter = new WebAudioSplitter();
  
  try {
    // Try Web Audio API approach (more compatible with GitHub Pages)
    if (progressCallback) progressCallback(0);
    
    let result: Blob[];
    if (mode === 'size' && options.maxSize) {
      result = await splitter.splitAudioBySize(file, options.maxSize * 1024 * 1024);
    } else if (mode === 'count' && options.count) {
      result = await splitter.splitAudioByCount(file, options.count);
    } else {
      throw new Error('Invalid parameters');
    }
    
    if (progressCallback) progressCallback(100);
    return result;
  } catch (error) {
    console.error('Audio splitting failed:', error);
    throw new Error('音声ファイルの分割に失敗しました。対応していない形式の可能性があります。');
  }
};