import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  onRecorded: (file: File | File[]) => void;
  onRecordingStateChange?: (active: boolean) => void;
  onSegmentsStateChange?: (hasSegments: boolean) => void;
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

export const RecordingPanel: React.FC<Props> = ({ onRecorded, onRecordingStateChange, onSegmentsStateChange }) => {
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
        setRecordedSegments(prev => {
          const newSegments = [...prev, file];
          // Notify parent about segments state change
          onSegmentsStateChange?.(newSegments.length > 0);
          return newSegments;
        });
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


  const finalizeRecording = async () => {
    console.log('✅ Finalizing recording with all segments');
    
    // Stop current recording if active
    stopCurrentSegment();
    
    // Wait a bit for the current segment to be saved
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Pass all segments to parent for individual transcription
    if (recordedSegments.length > 0) {
      if (recordedSegments.length === 1) {
        // Single segment: pass as single file
        onRecorded(recordedSegments[0]);
      } else {
        // Multiple segments: pass as array for individual transcription
        console.log(`📁 ${recordedSegments.length}個のセグメントを個別に文字起こし処理します`);
        onRecorded(recordedSegments);
      }
    }
    
    // Clean up everything
    setRecordedSegments([]);
    setCurrentSegmentIndex(0);
    setElapsedSec(0);
    setRecordingCompleted(true);
    
    // Notify parent that segments are cleared
    onSegmentsStateChange?.(false);
    
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg">
            <span className="text-white font-bold">🎙️</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">録音機能</h3>
            <p className="text-sm text-gray-600 mt-1">マイクとシステム音声を組み合わせて録音</p>
          </div>
        </div>
        
        {/* メイン録音ボタン */}
        {!isRecording && recordedSegments.length === 0 ? (
          <button
            onClick={startRecording}
            disabled={!micStream && !tabStream}
            className={`px-8 py-4 rounded-xl text-white font-bold text-lg transition-all shadow-lg ${
              !micStream && !tabStream 
                ? 'bg-gray-400 cursor-not-allowed opacity-60' 
                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 hover:shadow-xl hover:scale-105'
            }`}
          >
            <div className="flex items-center gap-3">
              {micStream || tabStream ? (
                <>
                  <span className="w-3 h-3 bg-white rounded-full animate-pulse" />
                  <span>🎙️ 録音開始</span>
                </>
              ) : (
                <span>音声入力を設定してください</span>
              )}
            </div>
          </button>
        ) : isRecording ? (
          <div className="flex gap-2">
            <button
              onClick={isPaused ? resumeRecording : pauseRecording}
              className={`px-4 py-3 rounded-xl text-white font-semibold transition-all shadow-lg ${
                isPaused 
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' 
                  : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700'
              }`}
            >
              {isPaused ? '▶️ 再開' : '⏸️ 一時停止'}
            </button>
            <button
              onClick={stopCurrentSegment}
              className="px-4 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 transition-all shadow-lg"
            >
              ⏹️ 停止
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={startRecording}
              disabled={!micStream && !tabStream}
              className={`px-4 py-3 rounded-xl text-white font-semibold transition-all shadow-lg ${
                !micStream && !tabStream 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
              }`}
            >
              ➕ 続きを録音
            </button>
            <button
              onClick={finalizeRecording}
              className="px-4 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
            >
              ✅ 完了
            </button>
          </div>
        )}
      </div>

      {/* 録音状態表示 */}
      {isRecording && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            <div>
              <span className="font-bold text-red-800">録音中</span>
              {isPaused && <span className="ml-2 text-sm text-yellow-700">（一時停止中）</span>}
            </div>
          </div>
          <div className="text-2xl font-mono text-red-700 font-bold">
            {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:{String(elapsedSec % 60).padStart(2, '0')}
          </div>
        </div>
      )}

      {/* セグメント状態表示 */}
      {!isRecording && recordedSegments.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-blue-600 rounded-full" />
            <span className="font-bold text-blue-800">{recordedSegments.length}個のセグメント録音済み</span>
          </div>
          <div className="flex gap-1 text-xs">
            {recordedSegments.map((_, index) => (
              <span key={index} className="bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
                {index + 1}
              </span>
            ))}
          </div>
        </div>
      )}

      {recordingCompleted && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-green-600 rounded-full" />
            <span className="font-bold text-green-800">録音完了</span>
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

      {/* シンプルな音声設定 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* マイク設定 */}
        <div className="p-4 border rounded-xl bg-blue-50/50 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎤</span>
              <span className="font-semibold text-gray-800">マイク</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${micStream ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {micStream ? '接続済み' : '未接続'}
            </span>
          </div>
          
          {micStream && (
            <div className="mb-3">
              <div className="w-full h-2 bg-gray-200 rounded-full">
                <div 
                  className="h-2 bg-green-500 rounded-full transition-all" 
                  style={{ width: `${levelMic}%` }} 
                />
              </div>
            </div>
          )}

          {/* デバイス選択 */}
          <div className="mb-3 flex-1">
            <select
              value={selectedMicId}
              onChange={async (e) => {
                setSelectedMicId(e.target.value);
                if (micStream && e.target.value) {
                  await enableMic();
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              {micDevices.length === 0 ? (
                <option value="">マイクが見つかりません</option>
              ) : (
                micDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `マイク ${d.deviceId.slice(0, 8)}...`}
                  </option>
                ))
              )}
            </select>
            <button
              onClick={refreshDevices}
              className="w-full mt-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs"
            >
              🔄 デバイス更新
            </button>
          </div>

          <button
            onClick={enableMic}
            className={`w-full px-4 py-2 rounded-lg font-medium transition-all mt-auto ${
              micStream 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            {micStream ? '✅ 接続済み' : '🎙️ 接続する'}
          </button>
        </div>

        {/* システム音声設定 */}
        <div className="p-4 border rounded-xl bg-emerald-50/50 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🖥️</span>
              <span className="font-semibold text-gray-800">システム音声</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${tabStream ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {tabStream ? '接続済み' : '未接続'}
            </span>
          </div>
          
          {tabStream && (
            <div className="mb-3">
              <div className="w-full h-2 bg-gray-200 rounded-full">
                <div 
                  className="h-2 bg-emerald-500 rounded-full transition-all" 
                  style={{ width: `${levelTab}%` }} 
                />
              </div>
            </div>
          )}

          {/* スペーサー - マイク側のデバイス選択分の高さを確保 */}
          <div className="flex-1 mb-3">
            <div className="text-xs text-gray-600 mb-2">タブを選択して音声を共有</div>
            <div className="h-8"></div> {/* select要素の高さ分 */}
            <div className="h-6"></div> {/* デバイス更新ボタンの高さ分 */}
          </div>

          <button
            onClick={pickTabAudio}
            className={`w-full px-4 py-2 rounded-lg font-medium transition-all mt-auto ${
              tabStream 
                ? 'bg-green-500 text-white hover:bg-green-600' 
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            {tabStream ? '✅ 接続済み' : '🖥️ 選択する'}
          </button>
        </div>
      </div>

      {/* ヒント */}
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
        <p className="text-sm text-emerald-800">
          <span className="font-semibold">💡 ヒント：</span>
          Google Meet / Teams / Zoom をブラウザで開き、「システム音声」で該当タブを選択し「タブの音声を共有」をオンにすると、相手の音声も録音できます。
        </p>
      </div>
    </div>
  );
};
