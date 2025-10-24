import React, { useEffect, useMemo, useRef, useState } from 'react';

import { extractTabMetadata, formatTabMetadataForBackground } from '../utils/tabMetadataExtractor';
import { useVisualCapture } from '../hooks/useVisualCapture';
import { VisualCaptureSettingsComponent } from './VisualCaptureSettings';
import { CaptureGallery } from './CaptureGallery';
import type { VisualCaptureSettings } from '../types/visualCapture';

import { downloadAllAsZip } from '../utils/download';
import type { SplitFile } from './DownloadList';
type Props = {
  onRecorded: (file: File | File[]) => void;
  onRecordingStateChange?: (active: boolean) => void;
  onSegmentsStateChange?: (hasSegments: boolean) => void;
  onTabMetadataExtracted?: (metadata: string) => void;
  onVisualCapturesReady?: (captures: any[]) => void;
  onVideoRecorded?: (videoFile: File) => void;
  apiKey?: string;
  apiEndpoint?: string;
  visualCaptureSettings?: VisualCaptureSettings;
  onVisualCaptureSettingsChange?: (settings: VisualCaptureSettings) => void;
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

export const RecordingPanel: React.FC<Props> = ({ 
  onRecorded, 
  onRecordingStateChange, 
  onSegmentsStateChange, 
  onTabMetadataExtracted, 
  onVisualCapturesReady,
  onVideoRecorded,
  apiKey,
  apiEndpoint,
  visualCaptureSettings,
  onVisualCaptureSettingsChange 
}) => {
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
  const [recordedSegments, setRecordedSegments] = useState<File[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [recordedVideo, setRecordedVideo] = useState<File | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const videoChunksRef = useRef<BlobPart[]>([]);
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

  // Visual capture hook integration
  const visualCapture = useVisualCapture();

  // Initialize visual capture settings and API credentials
  useEffect(() => {
    if (visualCaptureSettings) {
      visualCapture.updateSettings(visualCaptureSettings);
    }
    if (apiKey) {
      visualCapture.setApiCredentials(apiKey, apiEndpoint);
    }
  }, [visualCaptureSettings, apiKey, apiEndpoint]);

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
    
    // Stop visual capture
    visualCapture.stopCapture();
    
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore error */ }
    }
    if (previewCtxRef.current) {
      try { previewCtxRef.current.close(); } catch { /* ignore error */ }
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
      // Request video if visual capture is enabled OR if video mode is enabled
      const needsVideo = visualCapture.settings.enabled || isVideoMode;
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: needsVideo,
        audio: true
      });
      
      // Extract tab metadata if video track is available
      let metadata = null;
      if (needsVideo && s.getVideoTracks().length > 0) {
        metadata = await extractTabMetadata(s);
        console.log('📊 Extracted tab metadata:', metadata);
      }
      
      // Clone stream for visual capture before removing video tracks
      let visualStream: MediaStream | null = null;
      if (visualCapture.settings.enabled && s.getVideoTracks().length > 0) {
        try {
          visualStream = s.clone();
          await visualCapture.startCapture(visualStream);
          console.log('🎥 Visual capture started successfully with cloned stream');
        } catch (visualError) {
          console.warn('📸 Visual capture failed to start:', visualError);
          // Don't fail the entire tab sharing if visual capture fails
        }
      }
      
      // Store video stream if in video mode
      if (isVideoMode && s.getVideoTracks().length > 0) {
        const videoStreamClone = s.clone();
        setVideoStream(videoStreamClone);
        console.log('🎬 Video stream stored for recording');
      }
      
      // Remove video track from the main audio stream if present
      s.getVideoTracks().forEach(t => s.removeTrack(t));
      if (s.getAudioTracks().length === 0) {
        setError('選択したソースに音声トラックがありません。共有ダイアログで「タブの音声を共有」をオンにしてください。');
        return;
      }
      setTabStream(s);
      
      // Send tab metadata to parent for background information
      if (metadata && onTabMetadataExtracted) {
        const formattedMetadata = formatTabMetadataForBackground(metadata);
        console.log('📋 Sending formatted tab metadata to parent:', formattedMetadata);
        onTabMetadataExtracted(formattedMetadata);
      }
      
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
  };;;

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
    } catch {
      // Ignore; happens if no permissions yet
    }
  };

  const startRecording = async () => {
    setError(null);
    if (!micStream && !tabStream) {
      setError('マイクまたはタブ音声のいずれかを有効にしてください。');
      return;
    }
    
    // Check if video mode is enabled but no video stream
    if (isVideoMode && !videoStream) {
      setError('録画モードが有効ですが、画面共有が開始されていません。タブを再選択してください。');
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
      
      // Start video recording if in video mode
      if (isVideoMode && videoStream) {
        const videoOptions: MediaRecorderOptions = {
          mimeType: 'video/webm;codecs=vp8,opus'
        };

        // Combine the captured screen video with the mixed audio (mic + system)
        const compositeStream = new MediaStream();
        videoStream.getVideoTracks().forEach(track => {
          compositeStream.addTrack(track);
        });

        const mixedAudioTracks = destination.stream.getAudioTracks();
        if (mixedAudioTracks.length > 0) {
          mixedAudioTracks.forEach(track => {
            compositeStream.addTrack(track);
          });
        } else {
          // Fallback to whatever audio tracks the original screen stream exposed
          videoStream.getAudioTracks().forEach(track => {
            compositeStream.addTrack(track);
          });
        }

        const vr = new MediaRecorder(compositeStream, videoOptions);
        videoRecorderRef.current = vr;
        videoChunksRef.current = [];
        
        vr.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) videoChunksRef.current.push(ev.data);
        };
        
        vr.onstop = () => {
          const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
          const now = new Date();
          const pad = (n: number) => n.toString().padStart(2, '0');
          const fileName = `screen_recording_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.webm`;
          const file = new File([blob], fileName, { type: blob.type });
          
          // Store video file separately for download
          setRecordedVideo(file);
          
          // Notify parent about video recording
          onVideoRecorded?.(file);

          // Auto-download video locally
          try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch (e) {
            console.warn('Auto-download video failed:', e);
          }
          
          videoChunksRef.current = [];
        };
        
        vr.start(1000);
        console.log('🎬 Video recording started');
      }
      
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
      // Pause video recording if active
      if (videoRecorderRef.current && videoRecorderRef.current.state === 'recording') {
        videoRecorderRef.current.pause();
        console.log('⏸️ Video recording paused');
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
      // Resume video recording if active
      if (videoRecorderRef.current && videoRecorderRef.current.state === 'paused') {
        videoRecorderRef.current.resume();
        console.log('▶️ Video recording resumed');
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
      // Stop video recording if active
      if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
        videoRecorderRef.current.stop();
        console.log('🎬 Video recording stopped');
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
    
    // Pass visual captures to parent for separate analysis step (async to avoid setState during render)
    if (visualCapture.state.capturedImages.length > 0 && onVisualCapturesReady) {
      console.log('📸 Passing visual captures to parent:', visualCapture.state.capturedImages.length);
      // Use setTimeout to defer the callback to the next tick
      setTimeout(() => {
        onVisualCapturesReady(visualCapture.state.capturedImages);
      }, 0);
    }

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

      // Auto-download audio locally if not in video mode
      if (!isVideoMode) {
        try {
          const now = new Date();
          const pad = (n: number) => n.toString().padStart(2, '0');
          const baseName = `recording_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.webm`;
          if (recordedSegments.length === 1) {
            const blob = recordedSegments[0];
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = blob.name || baseName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } else {
            // Zip and download
            const splitFiles: SplitFile[] = recordedSegments.map((seg, idx) => ({
              name: seg.name || `segment_${idx + 1}.webm`,
              size: seg.size,
              blob: seg
            }));
            await downloadAllAsZip(splitFiles, baseName);
          }
        } catch (e) {
          console.warn('Auto-download audio failed:', e);
        }
      }
    }
    
    // Clean up everything
    setRecordedSegments([]);
    setCurrentSegmentIndex(0);
    setElapsedSec(0);
    setRecordedVideo(null);
    setVideoStream(null);
    setIsVideoMode(false);
    
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
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold transition-all shadow-lg"
            >
              🛑 セグメント終了
            </button>
          </div>
        ) : recordedSegments.length > 0 ? (
          <button
            onClick={finalizeRecording}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:scale-105"
          >
            📝 録音完了・文字起こし開始
          </button>
        ) : null}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* 録音中の表示 */}
      {isRecording && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
              <span className="font-semibold text-red-800">
                {isPaused ? '⏸️ 録音一時停止中' : '🔴 録音中...'}
              </span>
            </div>
            <div className="text-red-700 font-mono font-bold">
              {Math.floor(elapsedSec / 60)}:{(elapsedSec % 60).toString().padStart(2, '0')}
            </div>
          </div>
          {recordedSegments.length > 0 && (
            <div className="mt-2 text-sm text-red-700">
              セグメント {currentSegmentIndex + 1} | 保存済み: {recordedSegments.length}個
            </div>
          )}
        </div>
      )}

      {/* 録音済みセグメントの表示 */}
      {recordedSegments.length > 0 && !isRecording && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-400 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-green-600">📁</span>
              <span className="font-semibold text-green-800">録音完了</span>
            </div>
            <span className="text-green-700 text-sm">
              {recordedSegments.length}個のセグメント ({Math.round(recordedSegments.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024 * 100) / 100}MB)
            </span>
          </div>
          <p className="text-sm text-green-700 mt-2">
            「録音完了・文字起こし開始」ボタンを押すと各セグメントが個別に文字起こしされます
          </p>
        </div>
      )}

      {/* 録画済み動画のダウンロード */}
      {recordedVideo && !isRecording && (
        <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-blue-600">🎥</span>
              <span className="font-semibold text-blue-800">画面録画完了</span>
            </div>
            <button
              onClick={() => {
                const url = URL.createObjectURL(recordedVideo);
                const a = document.createElement('a');
                a.href = url;
                a.download = recordedVideo.name;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>💾</span>
              <span>動画をダウンロード</span>
              <span className="text-xs">({Math.round(recordedVideo.size / 1024 / 1024 * 100) / 100}MB)</span>
            </button>
          </div>
        </div>
      )}

      {/* 音声入力設定 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* マイク設定 */}
        <div className="bg-gray-50 p-4 rounded-xl border flex flex-col">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            🎤 マイク入力
            {micStream && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">接続済み</span>}
          </h4>
          
          {/* マイクデバイス選択 */}
          <div className="mb-3">
            <div className="text-xs text-gray-600 mb-2">入力デバイス</div>
            <select 
              value={selectedMicId} 
              onChange={(e) => setSelectedMicId(e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {micDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${d.deviceId.slice(0, 5)}...`}
                </option>
              ))}
            </select>
            <button 
              onClick={refreshDevices}
              className="text-xs text-blue-600 hover:text-blue-800 mt-1"
            >
              デバイスを更新
            </button>
          </div>
          
          {/* 音量レベル */}
          {micStream && (
            <div className="mb-3">
              <div className="text-xs text-gray-600 mb-2">音量レベル</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-150"
                  style={{ width: `${levelMic}%` }}
                />
              </div>
            </div>
          )}

          {/* ボタンを下に配置 */}
          <div className="mt-auto">
            <button
              onClick={micStream ? () => { stopMicMonitoring(); stopStream(micStream); setMicStream(null); } : enableMic}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-all ${
                micStream 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {micStream ? '✅ 接続済み' : '🎤 マイクを有効化'}
            </button>
          </div>
        </div>

        {/* タブ音声設定 */}
        <div className="bg-gray-50 p-4 rounded-xl border flex flex-col">
          <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            🖥️ タブ音声
            {tabStream && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">接続済み</span>}
          </h4>
          
          {/* 録画モードトグル - タブ選択前に配置 */}
          <div className={`mb-3 flex items-center justify-between p-3 rounded-lg transition-all ${
            isVideoMode ? 'bg-blue-100 border border-blue-300' : 'bg-white border border-gray-200'
          }`}>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <span>🎥 画面録画モード</span>
              {isVideoMode ? (
                <span className="text-xs text-blue-600 font-semibold">（有効）</span>
              ) : (
                <span className="text-xs text-gray-500">（タブ共有時に録画）</span>
              )}
            </label>
            <button
              onClick={() => setIsVideoMode(!isVideoMode)}
              disabled={isRecording}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isVideoMode ? 'bg-blue-600' : 'bg-gray-300'
              } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isVideoMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {/* 録画モード有効時の説明 */}
          {isVideoMode && (
            <div className="mb-3 p-2 bg-blue-50 border-l-2 border-blue-400 rounded text-xs text-blue-700">
              <p>📹 タブ選択時に画面も録画されます</p>
            </div>
          )}
          
          {/* タブ選択の説明 */}
          <div className="mb-3">
            <div className="text-xs text-gray-600 mb-2">タブを選択して音声を共有</div>
          </div>

          {/* 音量レベル */}
          {tabStream && (
            <div className="mb-3">
              <div className="text-xs text-gray-600 mb-2">音量レベル</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-150"
                  style={{ width: `${levelTab}%` }}
                />
              </div>
            </div>
          )}

          {/* ボタンを下に配置 */}
          <div className="mt-auto">
            <button
              onClick={tabStream ? () => { stopTabMonitoring(); stopStream(tabStream); setTabStream(null); setVideoStream(null); } : pickTabAudio}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-all ${
                tabStream 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-gray-500 text-white hover:bg-gray-600'
              }`}
            >
              {tabStream ? '✅ 接続済み' : '🖥️ 選択する'}
            </button>
          </div>
        </div>
      </div>

      {/* ヒント */}
      <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
        <p className="text-sm text-emerald-800">
          <span className="font-semibold">💡 ヒント：</span>
          Google Meet / Teams / Zoom をブラウザで開き、「システム音声」で該当タブを選択し「タブの音声を共有」をオンにすると、相手の音声も録音できます。
        </p>
      </div>

      {/* Visual Capture Settings */}
      {tabStream && visualCaptureSettings && onVisualCaptureSettingsChange && (
        <VisualCaptureSettingsComponent
          settings={visualCaptureSettings}
          onSettingsChange={onVisualCaptureSettingsChange}
          disabled={isRecording}
          className="mb-6"
        />
      )}

      {/* Manual Capture & Upload */}
      {visualCaptureSettings?.enabled && (
        <div className="mb-6 bg-blue-50 rounded-xl p-4 border border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            📸 画像キャプチャ・アップロード
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 手動キャプチャ */}
            <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
              <div>
                <div className="font-medium text-gray-800">手動キャプチャ</div>
                <div className="text-sm text-gray-600">今の画面を撮影</div>
              </div>
              <button
                onClick={visualCapture.captureNow}
                disabled={!tabStream || !visualCapture.state.isCapturing}
                className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                  !tabStream || !visualCapture.state.isCapturing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                }`}
              >
                📷 キャプチャ
              </button>
            </div>

            {/* 画像アップロード */}
            <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
              <div>
                <div className="font-medium text-gray-800">画像アップロード</div>
                <div className="text-sm text-gray-600">ファイルから追加</div>
              </div>
              <label className="px-3 py-2 rounded-lg font-medium transition-all text-sm bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg cursor-pointer">
                📁 アップロード
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        await visualCapture.uploadImage(file);
                        e.target.value = ''; // Reset input
                      } catch (error) {
                        console.error('Failed to upload image:', error);
                      }
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="mt-3 text-xs text-blue-600 space-y-1">
            {!tabStream && (
              <p>• 手動キャプチャはタブ共有開始後に利用可能になります</p>
            )}
            <p>• アップロード画像は重複チェックの対象外となり、必ず分析されます</p>
          </div>
        </div>
      )}

      {/* Capture Gallery */}
      {tabStream && visualCapture.state.capturedImages.length > 0 && (
        <CaptureGallery
          captures={visualCapture.state.capturedImages}
          isAnalyzing={visualCapture.isAnalyzing}
          analysisProgress={visualCapture.analysisProgress}
          onAnalyzeCaptures={visualCapture.hasApiCredentials ? visualCapture.analyzeCaptures : undefined}
          className="mb-6"
        />
      )}
    </div>
  );
};
