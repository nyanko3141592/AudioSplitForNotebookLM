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
      
      let numParts: number;
      
      if (mode === 'size' && options.maxSize) {
        // Estimate number of parts based on file size
        numParts = Math.ceil(file.size / options.maxSize);
      } else if (mode === 'count' && options.count) {
        numParts = options.count;
      } else {
        throw new Error('Invalid split parameters');
      }
      
      const partDuration = duration / numParts;
      const results: Blob[] = [];
      
      for (let i = 0; i < numParts; i++) {
        const startTime = i * partDuration;
        const endTime = Math.min((i + 1) * partDuration, duration);
        const actualDuration = endTime - startTime;
        
        if (actualDuration <= 0) continue;
        
        const startSample = Math.floor(startTime * sampleRate);
        const endSample = Math.floor(endTime * sampleRate);
        const partLength = endSample - startSample;
        
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
        const blob = await this.audioBufferToWav(partBuffer);
        results.push(blob);
      }
      
      return results;
    } catch (error) {
      console.error('Web Audio splitting failed:', error);
      throw error;
    }
  }

  private async audioBufferToWav(audioBuffer: AudioBuffer): Promise<Blob> {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    
    // Create WAV header
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert audio data to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }
}

// Fallback function that attempts FFmpeg first, then Web Audio API
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