import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  onRecorded: (file: File) => void;
  onRecordingStateChange?: (active: boolean) => void;
};

function supportMimeTypes(): string {
  const preferred = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg'
  ];
  for (const mt of preferred) {
    if (window.MediaRecorder && window.MediaRecorder.isTypeSupported?.(mt)) {
      return mt;
    }
  }
  return '';
}

export const RecordingPanel: React.FC<Props> = ({ onRecorded, onRecordingStateChange }) => {
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [tabStream, setTabStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelMic, setLevelMic] = useState(0);
  const [levelTab, setLevelTab] = useState(0);
  const [isMonitoringMic, setIsMonitoringMic] = useState(false);
  const [isMonitoringTab, setIsMonitoringTab] = useState(false);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [recordingCompleted, setRecordingCompleted] = useState(false);
  const [recordedSegments, setRecordedSegments] = useState<File[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const analyserMicRef = useRef<AnalyserNode | null>(null);
  const analyserTabRef = useRef<AnalyserNode | null>(null);
  const previewAnalyserMicRef = useRef<AnalyserNode | null>(null);
  const previewAnalyserTabRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const micRafRef = useRef<number | null>(null);
  const tabRafRef = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<number | null>(null);

  const mimeType = useMemo(() => supportMimeTypes(), []);

  useEffect(() => {
    return () => {
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleDeviceChange = () => {
      refreshDevices();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    refreshDevices();
    return () => {
      console.log('🧹 RecordingPanel cleanup started');
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      
      // Enhanced cleanup for screen sharing crash prevention
      try {
        // Stop all recording activities
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        
        // Cancel any ongoing monitoring
        stopMicMonitoring();
        stopTabMonitoring();
        
        // Safely stop all media tracks
        if (micStream) {
          micStream.getTracks().forEach(track => {
            try {
              track.stop();
            } catch (e) {
              console.warn('Failed to stop mic track during cleanup:', e);
            }
          });
        }
        
        if (tabStream) {
          tabStream.getTracks().forEach(track => {
            try {
              track.stop();
            } catch (e) {
              console.warn('Failed to stop tab track during cleanup:', e);
            }
          });
        }
        
        // Close audio contexts safely
        if (audioCtxRef.current) {
          try { 
            audioCtxRef.current.close(); 
          } catch (e) {
            console.warn('Failed to close audio context during cleanup:', e);
          }
        }
        
        if (previewCtxRef.current) {
          try { 
            previewCtxRef.current.close(); 
          } catch (e) {
            console.warn('Failed to close preview context during cleanup:', e);
          }
        }
        
        console.log('✅ RecordingPanel cleanup completed');
      } catch (e) {
        console.error('Error during RecordingPanel cleanup:', e);
      }
    };
  }, []);

  // Data protection: prevent accidental loss of recorded segments
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('🚨 Page unloading - checking for unsaved data');
      
      // Check if we have recorded segments or are currently recording
      const hasUnsavedData = recordedSegments.length > 0 || isRecording;
      
      if (hasUnsavedData) {
        // Show confirmation dialog to prevent accidental data loss
        const message = isRecording 
          ? '録音中です。ページを離れると録音データが失われます。本当に続行しますか？'
          : `録音したセグメント（${recordedSegments.length}個）が保存されていません。ページを離れると失われます。本当に続行しますか？`;
        
        e.preventDefault();
        e.returnValue = message; // Modern browsers
        return message; // Legacy browsers
      }
      
      // If no unsaved data, perform emergency cleanup
      try {
        // Emergency stop all media streams
        if (micStream) {
          micStream.getTracks().forEach(track => track.stop());
        }
        if (tabStream) {
          tabStream.getTracks().forEach(track => track.stop());
        }
        
        // Stop recording if active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.error('Emergency cleanup error:', e);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [micStream, tabStream, recordedSegments.length, isRecording]);

  const stopStream = (s: MediaStream | null) => {
    s?.getTracks().forEach(t => t.stop());
  };

  const stopAll = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      // Ignore stop errors during cleanup
    }
    mediaRecorderRef.current = null;
    stopStream(micStream);
    stopStream(tabStream);
    setMicStream(null);
    setTabStream(null);
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
    }
    if (previewCtxRef.current) {
      try { previewCtxRef.current.close(); } catch {}
    }
    audioCtxRef.current = null;
    previewCtxRef.current = null;
    analyserMicRef.current = null;
    analyserTabRef.current = null;
    previewAnalyserMicRef.current = null;
    previewAnalyserTabRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
    if (tabRafRef.current) cancelAnimationFrame(tabRafRef.current);
    if (timerRef.current) window.clearInterval(timerRef.current);
    setElapsedSec(0);
    setIsMonitoringMic(false);
    setIsMonitoringTab(false);
    setLevelMic(0);
    setLevelTab(0);
    onRecordingStateChange?.(false);
  };

  const startMicMonitoring = (stream: MediaStream) => {
    if (isMonitoringMic || !stream || stream.getAudioTracks().length === 0) return;
    
    try {
      // Create new AudioContext if needed
      if (!previewCtxRef.current || previewCtxRef.current.state === 'closed') {
        previewCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      
      const ctx = previewCtxRef.current;
      
      // Resume AudioContext if suspended
      if (ctx.state === 'suspended') {
        ctx.resume().catch(console.error);
      }
      
      // Verify the stream track is live before creating source
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack || audioTrack.readyState !== 'live') {
        console.warn('Audio track not live, skipping monitoring');
        return;
      }
      
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8; // Smoother level changes
      previewAnalyserMicRef.current = analyser;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        if (!isMonitoringMic || !previewAnalyserMicRef.current) return;
        
        try {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const level = Math.min(100, Math.round((sum / data.length) / 2));
          setLevelMic(level);
          micRafRef.current = requestAnimationFrame(loop);
        } catch (e) {
          console.error('Error in mic monitoring loop:', e);
          setIsMonitoringMic(false);
        }
      };
      
      setIsMonitoringMic(true);
      loop();
    } catch (e) {
      console.error('Failed to start mic monitoring:', e);
      setIsMonitoringMic(false);
    }
  };

  const startTabMonitoring = (stream: MediaStream) => {
    if (isMonitoringTab || !stream || stream.getAudioTracks().length === 0) return;
    
    try {
      if (!previewCtxRef.current) {
        previewCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = previewCtxRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      previewAnalyserTabRef.current = analyser;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        if (!isMonitoringTab || !previewAnalyserTabRef.current) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setLevelTab(Math.min(100, Math.round((sum / data.length) / 2)));
        tabRafRef.current = requestAnimationFrame(loop);
      };
      
      setIsMonitoringTab(true);
      loop();
    } catch (e) {
      console.error('Failed to start tab monitoring:', e);
    }
  };

  const stopMicMonitoring = () => {
    setIsMonitoringMic(false);
    setLevelMic(0);
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    previewAnalyserMicRef.current = null;
  };

  const stopTabMonitoring = () => {
    setIsMonitoringTab(false);
    setLevelTab(0);
    if (tabRafRef.current) {
      cancelAnimationFrame(tabRafRef.current);
      tabRafRef.current = null;
    }
    previewAnalyserTabRef.current = null;
  };

  const pickTabAudio = async () => {
    setError(null);
    stopTabMonitoring(); // Stop any existing monitoring
    try {
      // Using video: true improves likelihood of getting tab/system audio with picker
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      // Remove video track immediately; we only need audio
      s.getVideoTracks().forEach(t => s.removeTrack(t));
      if (s.getAudioTracks().length === 0) {
        setError('選択したソースに音声トラックがありません。共有ダイアログで「タブの音声を共有」をオンにしてください。');
        return;
      }
      setTabStream(s);
      
      // Ensure AudioContext is ready and start monitoring
      if (!previewCtxRef.current || previewCtxRef.current.state === 'closed') {
        previewCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (previewCtxRef.current.state === 'suspended') {
        await previewCtxRef.current.resume();
      }
      
      // Start monitoring audio levels immediately
      startTabMonitoring(s);
      
      // Enhanced cleanup when tracks end or stream changes
      s.getAudioTracks().forEach(track => {
        // 通常の終了イベント
        track.addEventListener('ended', () => {
          console.log('🔴 Tab audio track ended');
          setTabStream(null);
          stopTabMonitoring();
        });
        
        // 予期せぬミュート状態への対処
        track.addEventListener('mute', () => {
          console.log('🔇 Tab audio track muted');
        });
        
        track.addEventListener('unmute', () => {
          console.log('🔊 Tab audio track unmuted');
        });
      });
      
      // ストリームの inactive イベントも監視
      s.addEventListener('inactive', () => {
        console.log('🔴 Tab stream became inactive');
        setTabStream(null);
        stopTabMonitoring();
      });
    } catch (e: any) {
      if (e?.name !== 'NotAllowedError') {
        setError('タブ/システム音声の取得に失敗しました。共有ダイアログで該当タブを選択し、「タブの音声を共有」にチェックしてください。');
      }
    }
  };

  const enableMic = async () => {
    setError(null);
    
    // Complete cleanup of existing mic stream
    if (micStream) {
      stopMicMonitoring();
      stopStream(micStream);
      setMicStream(null);
    }
    
    // Keep AudioContext alive instead of closing it
    if (previewCtxRef.current && previewCtxRef.current.state === 'suspended') {
      try { 
        await previewCtxRef.current.resume();
      } catch (e) {
        console.warn('Failed to resume AudioContext:', e);
      }
    }
    
    try {
      let s: MediaStream | null = null;
      
      // Try with selected device first
      if (selectedMicId) {
        try {
          const exactConstraints: MediaStreamConstraints = { 
            audio: { 
              deviceId: { exact: selectedMicId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            } 
          };
          s = await navigator.mediaDevices.getUserMedia(exactConstraints);
          
          // Verify the stream has audio tracks and they're working
          if (s.getAudioTracks().length === 0) {
            throw new Error('No audio tracks in selected device stream');
          }
          
          // Test if the audio track is actually active
          const track = s.getAudioTracks()[0];
          if (!track || track.readyState !== 'live' || track.muted) {
            throw new Error('Selected audio track is not active or muted');
          }
          
        } catch (selectedDeviceError) {
          console.warn('Selected device failed:', selectedDeviceError);
          // Clean up failed stream
          if (s) {
            stopStream(s);
            s = null;
          }
        }
      }
      
      // Fallback to default device if selected device failed or not specified
      if (!s) {
        const defaultConstraints: MediaStreamConstraints = { 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };
        s = await navigator.mediaDevices.getUserMedia(defaultConstraints);
        
        if (s.getAudioTracks().length === 0) {
          throw new Error('No audio tracks available from default device');
        }
      }
      
      // Verify we have a valid stream before proceeding
      if (!s || s.getAudioTracks().length === 0) {
        throw new Error('Failed to obtain valid audio stream');
      }
      
      setMicStream(s);
      
      // Immediately start monitoring and ensure AudioContext is running
      if (s && s.getAudioTracks().length > 0) {
        // Create/resume AudioContext first
        if (!previewCtxRef.current || previewCtxRef.current.state === 'closed') {
          previewCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (previewCtxRef.current.state === 'suspended') {
          previewCtxRef.current.resume().catch(console.error);
        }
        
        // Start monitoring immediately
        startMicMonitoring(s);
      }
      
      // Clean up when tracks end
      s.getAudioTracks().forEach(track => {
        track.addEventListener('ended', () => {
          console.log('Mic track ended');
          setMicStream(null);
          stopMicMonitoring();
        });
      });
      
      // After permission granted, refresh device labels
      await refreshDevices();
      
    } catch (e: any) {
      console.error('enableMic error:', e);
      let errorMessage = 'マイクのアクセスに失敗しました。';
      
      if (e.name === 'NotAllowedError') {
        errorMessage = 'マイクのアクセスが許可されませんでした。ブラウザの権限設定を確認してください。';
      } else if (e.name === 'NotFoundError') {
        errorMessage = '指定されたマイクデバイスが見つかりません。デバイスを更新してください。';
      } else if (e.name === 'NotReadableError') {
        errorMessage = 'マイクデバイスが他のアプリケーションで使用中の可能性があります。';
      } else if (e.message.includes('audio track')) {
        errorMessage = '選択したデバイスから音声を取得できません。別のデバイスを試してください。';
      }
      
      setError(errorMessage);
    }
  };

  const refreshDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      setMicDevices(mics);
      if (!selectedMicId) {
        const preferred = mics.find(d => /default|internal/i.test(d.label)) || mics[0];
        if (preferred) setSelectedMicId(preferred.deviceId);
      }
    } catch (e) {
      // Ignore; happens if no permissions yet
    }
  };

  const startRecording = async () => {
    setError(null);
    if (!micStream && !tabStream) {
      setError('マイクまたはタブ音声のいずれかを有効にしてください。');
      return;
    }
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const destination = ctx.createMediaStreamDestination();

      const mix = (s: MediaStream, setLevel: (v: number) => void, analyserRef: React.MutableRefObject<AnalyserNode | null>) => {
        if (!s || s.getAudioTracks().length === 0) return false;
        const source = ctx.createMediaStreamSource(s);
        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        source.connect(gain).connect(analyser).connect(destination);
        // Simple level meter
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          setLevel(Math.min(100, Math.round((sum / data.length) / 2)));
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
        return true;
      };

      const usedMic = micStream ? mix(micStream, setLevelMic, analyserMicRef) : false;
      const usedTab = tabStream ? mix(tabStream, setLevelTab, analyserTabRef) : false;
      if (!usedMic && !usedTab) {
        setError('有効な音声トラックが見つかりません。マイク/タブ音声の設定を確認してください。');
        await ctx.close();
        audioCtxRef.current = null;
        return;
      }

      const options: MediaRecorderOptions = {};
      if (mimeType) options.mimeType = mimeType as any;
      const mr = new MediaRecorder(destination.stream, options);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const segmentNum = currentSegmentIndex + 1;
        const fileName = `recording_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}_segment${segmentNum}.webm`;
        const file = new File([blob], fileName, { type: blob.type });
        
        // Save segment to list
        setRecordedSegments(prev => [...prev, file]);
        setCurrentSegmentIndex(prev => prev + 1);
        
        // Reset chunks for next segment
        chunksRef.current = [];
        
        setIsRecording(false);
        setIsPaused(false);
        if (timerRef.current) window.clearInterval(timerRef.current);
        onRecordingStateChange?.(false);
      };
      mr.start(1000);
      setIsRecording(true);
      onRecordingStateChange?.(true);
      const started = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - started) / 1000));
      }, 1000);
    } catch (e: any) {
      console.error(e);
      setError('録音の開始に失敗しました。ブラウザの対応状況や権限をご確認ください。');
    }
  };

  const pauseRecording = () => {
    console.log('⏸️ Pausing recording');
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    } catch (e) {
      console.error('Error pausing recording:', e);
    }
  };

  const resumeRecording = () => {
    console.log('▶️ Resuming recording');
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        // Restart timer
        const started = Date.now() - (elapsedSec * 1000);
        timerRef.current = window.setInterval(() => {
          setElapsedSec(Math.floor((Date.now() - started) / 1000));
        }, 100);
      }
    } catch (e) {
      console.error('Error resuming recording:', e);
    }
  };

  const stopCurrentSegment = () => {
    console.log('🛑 Stopping current segment');
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch (e) {
      console.error('Error stopping segment:', e);
    }
  };

  const mergeAudioSegments = async (segments: File[]): Promise<File> => {
    console.log(`🔗 Merging ${segments.length} audio segments`);
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffers: AudioBuffer[] = [];
      
      // Load all segments as AudioBuffers
      for (const segment of segments) {
        const arrayBuffer = await segment.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        buffers.push(audioBuffer);
      }
      
      // Calculate total length and create merged buffer
      const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
      const sampleRate = buffers[0].sampleRate;
      const numberOfChannels = buffers[0].numberOfChannels;
      
      const mergedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);
      
      // Copy all segments into the merged buffer
      let offset = 0;
      for (const buffer of buffers) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const channelData = buffer.getChannelData(channel);
          mergedBuffer.getChannelData(channel).set(channelData, offset);
        }
        offset += buffer.length;
      }
      
      // Create a MediaRecorder to encode the merged buffer
      const destination = audioContext.createMediaStreamDestination();
      const source = audioContext.createBufferSource();
      source.buffer = mergedBuffer;
      source.connect(destination);
      
      // Record the merged audio
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: mimeType || 'audio/webm'
      });
      
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      // Return Promise that resolves when recording is done
      return new Promise((resolve, reject) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
          const now = new Date();
          const pad = (n: number) => n.toString().padStart(2, '0');
          const fileName = `recording_merged_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.webm`;
          const file = new File([blob], fileName, { type: blob.type });
          audioContext.close();
          resolve(file);
        };
        
        mediaRecorder.onerror = (e) => {
          audioContext.close();
          reject(e);
        };
        
        mediaRecorder.start();
        source.start();
        
        // Stop recording after the audio finishes playing
        source.onended = () => {
          mediaRecorder.stop();
        };
      });
      
    } catch (error) {
      console.error('Error merging audio segments:', error);
      // Fallback: return the first segment if merging fails
      return segments[0];
    }
  };

  const finalizeRecording = async () => {
    console.log('✅ Finalizing recording with all segments');
    
    // Stop current recording if active
    stopCurrentSegment();
    
    // Wait a bit for the current segment to be saved
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Merge all segments and pass to parent
    if (recordedSegments.length > 0) {
      try {
        // If there's only one segment, just use it
        if (recordedSegments.length === 1) {
          onRecorded(recordedSegments[0]);
        } else {
          // Merge multiple segments
          console.log('🔄 Merging multiple segments...');
          const mergedFile = await mergeAudioSegments(recordedSegments);
          onRecorded(mergedFile);
        }
      } catch (error) {
        console.error('Error processing segments:', error);
        // Fallback: use the first segment
        onRecorded(recordedSegments[0]);
      }
    }
    
    // Clean up everything
    setRecordedSegments([]);
    setCurrentSegmentIndex(0);
    setElapsedSec(0);
    setRecordingCompleted(true);
    
    // Clean up streams and contexts
    stopMicMonitoring();
    stopTabMonitoring();
    stopStream(micStream);
    stopStream(tabStream);
    setMicStream(null);
    setTabStream(null);
    
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {
        // Ignore close errors during cleanup
      }
    }
    audioCtxRef.current = null;
    analyserMicRef.current = null;
    analyserTabRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };


  const resetSources = () => {
    stopMicMonitoring();
    stopTabMonitoring();
    stopStream(micStream);
    stopStream(tabStream);
    setMicStream(null);
    setTabStream(null);
  };

  return (
    <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg">
          <span className="text-white font-bold">🎙️</span>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-800">録音機能</h3>
          <p className="text-sm text-gray-600 mt-1">マイクとシステム音声を組み合わせて録音できます</p>
        </div>
        
        {/* 録音制御ボタン */}
        <div className="flex items-center gap-3">
          {!isRecording && recordedSegments.length === 0 ? (
            <button
              onClick={startRecording}
              disabled={!micStream && !tabStream}
              className={`px-6 py-3 rounded-xl text-white font-semibold transition-all shadow-lg ${
                !micStream && !tabStream 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 hover:shadow-xl'
              }`}
            >
              🎙️ 録音開始
            </button>
          ) : !isRecording && recordedSegments.length > 0 ? (
            <div className="flex gap-2">
              <button
                onClick={startRecording}
                disabled={!micStream && !tabStream}
                className={`px-4 py-3 rounded-xl text-white font-semibold transition-all shadow-lg ${
                  !micStream && !tabStream 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:shadow-xl'
                }`}
              >
                ➕ 続きを録音
              </button>
              <button
                onClick={finalizeRecording}
                className="px-4 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl"
              >
                ✅ 録音を完了
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {!isPaused ? (
                <button
                  onClick={pauseRecording}
                  className="px-4 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-lg hover:shadow-xl"
                >
                  ⏸️ 一時停止
                </button>
              ) : (
                <button
                  onClick={resumeRecording}
                  className="px-4 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl"
                >
                  ▶️ 再開
                </button>
              )}
              <button
                onClick={stopCurrentSegment}
                className="px-4 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
              >
                ⏹️ セグメント終了
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 録音状態表示 */}
      {isRecording && (
        <div className="mb-6 p-4 rounded-xl border-2 border-red-300 bg-red-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            <div>
              <span className="font-bold text-red-800 text-lg">録音中</span>
              {isPaused && <span className="ml-2 text-sm text-yellow-700 font-medium">（一時停止中）</span>}
              <p className="text-xs text-red-700 mt-1">
                {micStream && tabStream ? 'マイク + システム音声' : micStream ? 'マイクのみ' : 'システム音声のみ'}
                {recordedSegments.length > 0 && (
                  <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                    セグメント{currentSegmentIndex + 1} （計{recordedSegments.length + 1}個）
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono tabular-nums text-red-700 font-bold">
              {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:{String(elapsedSec % 60).padStart(2, '0')}
            </div>
            <p className="text-xs text-red-600 mt-1">経過時間</p>
          </div>
        </div>
      )}

      {/* セグメント状態表示 */}
      {!isRecording && recordedSegments.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border-2 border-blue-300 bg-blue-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block w-3 h-3 bg-blue-600 rounded-full" />
            <div>
              <span className="font-bold text-blue-800 text-lg">{recordedSegments.length}個のセグメント録音済み</span>
              <p className="text-xs text-blue-700 mt-1">続きを録音するか、録音を完了してください</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs text-blue-600">
            {recordedSegments.map((_, index) => (
              <span key={index} className="bg-blue-200 px-2 py-1 rounded-full">
                #{index + 1}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {recordingCompleted && (
        <div className="mb-6 p-4 rounded-xl border-2 border-green-300 bg-green-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block w-3 h-3 bg-green-600 rounded-full" />
            <div>
              <span className="font-bold text-green-800 text-lg">録音完了</span>
              <p className="text-xs text-green-700 mt-1">画面共有を自動終了しました</p>
            </div>
          </div>
          <button 
            onClick={() => setRecordingCompleted(false)}
            className="text-green-600 hover:text-green-800 text-xl font-bold"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* マイクセクション */}
        <div className="p-4 border-2 border-blue-200 rounded-xl bg-blue-50/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">🎤</span>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-800">マイク</h4>
              <p className="text-xs text-gray-600">あなたの声を録音します</p>
            </div>
            <div className="ml-auto">
              <span className={`text-xs flex items-center gap-1 px-2 py-1 rounded-full ${micStream ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {micStream && isMonitoringMic && (
                  <span className="inline-block w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse" />
                )}
                {micStream ? '接続済み' : '未接続'}
              </span>
            </div>
          </div>
          
          {/* 音声レベルメーター */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">音声レベル</span>
              <span className="text-xs text-gray-500">{levelMic}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full">
              <div 
                className={`h-3 rounded-full transition-all ${isMonitoringMic ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gray-400'}`} 
                style={{ width: `${levelMic}%` }} 
              />
            </div>
            
            {/* 診断情報 */}
            {micStream && (
              <div className="mt-2 text-xs text-gray-500">
                <div className="grid grid-cols-2 gap-2">
                  <span>
                    トラック状態: {micStream.getAudioTracks()[0]?.readyState || 'unknown'}
                  </span>
                  <span>
                    ミュート: {micStream.getAudioTracks()[0]?.muted ? 'Yes' : 'No'}
                  </span>
                  <span>
                    AudioContext: {previewCtxRef.current?.state || 'none'}
                  </span>
                  <span>
                    監視中: {isMonitoringMic ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* マイク選択 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">デバイス選択</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={selectedMicId}
                onChange={async (e) => {
                  setSelectedMicId(e.target.value);
                  // Auto-refresh mic stream when device selection changes and already enabled
                  if (micStream && e.target.value) {
                    await enableMic();
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                title="マイクデバイスを選択"
              >
                {micDevices.length === 0 ? (
                  <option value="">マイクが見つかりません</option>
                ) : (
                  micDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'マイク'}</option>
                  ))
                )}
              </select>
              <button
                onClick={refreshDevices}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                デバイス更新
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              ラベルが空の場合は一度「有効化」してください
            </p>
          </div>

          {/* マイク制御ボタン */}
          <button
            onClick={enableMic}
            className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
              micStream && isMonitoringMic
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {micStream && isMonitoringMic
              ? '🎙️ マイク接続中'
              : 'マイクを接続'
            }
          </button>
        </div>

        {/* システム音声セクション */}
        <div className="p-4 border-2 border-emerald-200 rounded-xl bg-emerald-50/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">🖥️</span>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-800">システム音声</h4>
              <p className="text-xs text-gray-600">他のタブやアプリの音声を録音</p>
            </div>
            <div className="ml-auto">
              <span className={`text-xs flex items-center gap-1 px-2 py-1 rounded-full ${tabStream ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {tabStream && isMonitoringTab && (
                  <span className="inline-block w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse" />
                )}
                {tabStream ? '接続済み' : '未接続'}
              </span>
            </div>
          </div>
          
          {/* 音声レベルメーター */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">音声レベル</span>
              <span className="text-xs text-gray-500">{levelTab}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full">
              <div 
                className={`h-3 rounded-full transition-all ${isMonitoringTab ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gray-400'}`} 
                style={{ width: `${levelTab}%` }} 
              />
            </div>
          </div>

          {/* 説明とヒント */}
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 font-medium mb-1">💡 使用方法</p>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• Google Meet などのタブを選択</li>
              <li>• 「タブの音声を共有」をチェック</li>
              <li>• 会議音声を録音可能になります</li>
            </ul>
          </div>

          {/* システム音声制御ボタン */}
          <button
            onClick={pickTabAudio}
            className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
              tabStream && isMonitoringTab
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {tabStream && isMonitoringTab
              ? '🖥️ システム音声接続中'
              : 'システム音声を選択'
            }
          </button>
        </div>
      </div>

      {/* 現在の入力状態表示 */}
      {(micStream || tabStream) && !isRecording && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-green-700">✅ 録音準備完了</span>
            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
              {micStream && tabStream ? 'マイク + システム音声' : micStream ? 'マイクのみ' : 'システム音声のみ'}
            </span>
          </div>
          <button
            onClick={resetSources}
            className="px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors text-sm"
          >
            入力をリセット
          </button>
        </div>
      )}

      {!micStream && !tabStream && !isRecording && (
        <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-center">
          <p className="text-gray-600 mb-2">⬇️ まずは音声入力を設定してください ⬇️</p>
          <p className="text-xs text-gray-500">マイクまたはシステム音声（または両方）を有効化すると録音できます</p>
        </div>
      )}
    </div>
  );
};
