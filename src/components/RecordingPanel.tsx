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
    if ((window as any).MediaRecorder && (window as any).MediaRecorder.isTypeSupported?.(mt)) {
      return mt;
    }
  }
  return '';
}

export const RecordingPanel: React.FC<Props> = ({ onRecorded, onRecordingStateChange }) => {
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [tabStream, setTabStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelMic, setLevelMic] = useState(0);
  const [levelTab, setLevelTab] = useState(0);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserMicRef = useRef<AnalyserNode | null>(null);
  const analyserTabRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
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
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, []);

  const stopStream = (s: MediaStream | null) => {
    s?.getTracks().forEach(t => t.stop());
  };

  const stopAll = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    mediaRecorderRef.current = null;
    stopStream(micStream);
    stopStream(tabStream);
    setMicStream(null);
    setTabStream(null);
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
    }
    audioCtxRef.current = null;
    analyserMicRef.current = null;
    analyserTabRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) window.clearInterval(timerRef.current);
    setElapsedSec(0);
    onRecordingStateChange?.(false);
  };

  const pickTabAudio = async () => {
    setError(null);
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
      }
      setTabStream(s);
    } catch (e: any) {
      if (e?.name !== 'NotAllowedError') {
        setError('タブ/システム音声の取得に失敗しました。共有ダイアログで該当タブを選択し、「タブの音声を共有」にチェックしてください。');
      }
    }
  };

  const enableMic = async () => {
    setError(null);
    try {
      // First, try selected device if any
      let constraints: MediaStreamConstraints = { audio: true };
      if (selectedMicId) {
        constraints = { audio: { deviceId: { exact: selectedMicId } as any } };
      }
      let s = await navigator.mediaDevices.getUserMedia(constraints);
      // Fallback if exact device failed to provide audio tracks
      if (s.getAudioTracks().length === 0 && !selectedMicId) {
        s = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      setMicStream(s);
      // After permission granted, refresh device labels
      await refreshDevices();
    } catch (e: any) {
      setError('マイクのアクセスが許可されませんでした。ブラウザの権限設定を確認してください。');
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
        const fileName = `recording_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.webm`;
        const file = new File([blob], fileName, { type: blob.type });
        onRecorded(file);
        setIsRecording(false);
        if (timerRef.current) window.clearInterval(timerRef.current);
        setElapsedSec(0);
        onRecordingStateChange?.(false);
        // Keep streams for additional recordings unless user resets
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

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
  };

  const resetSources = () => {
    stopStream(micStream);
    stopStream(tabStream);
    setMicStream(null);
    setTabStream(null);
    setLevelMic(0);
    setLevelTab(0);
  };

  return (
    <div className="mb-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6">
      {isRecording && (
        <div className="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse" />
            <span className="font-semibold text-red-800">録音中</span>
          </div>
          <div className="text-red-700 font-mono tabular-nums">
            {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:{String(elapsedSec % 60).padStart(2, '0')}
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg">
          <span className="text-white font-bold">REC</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-800">録音して取り込む（マイク＋他タブ音声）</h3>
          <p className="text-xs text-gray-600 mt-1">Google Meet などのタブを選択して音声を共有し、同時にマイクを録音できます。</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <button
          onClick={pickTabAudio}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          他タブ/システム音声を選ぶ
        </button>
        <button
          onClick={enableMic}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          マイクを有効化
        </button>
        <button
          onClick={resetSources}
          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          入力をリセット
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="p-3 border rounded-lg bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">マイク</span>
            <span className={`text-xs ${micStream ? 'text-green-700' : 'text-gray-500'}`}>{micStream ? '接続済み' : '未接続'}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded">
            <div className="h-2 bg-green-500 rounded transition-all" style={{ width: `${levelMic}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
            <select
              value={selectedMicId}
              onChange={(e) => setSelectedMicId(e.target.value)}
              className="px-2 py-2 border border-gray-300 rounded"
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
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              端末更新
            </button>
            <div className="text-xs text-gray-500">
              ラベルが空の場合は一度「マイクを有効化」してください
            </div>
          </div>
        </div>
        <div className="p-3 border rounded-lg bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">他タブ/システム音声</span>
            <span className={`text-xs ${tabStream ? 'text-green-700' : 'text-gray-500'}`}>{tabStream ? '接続済み' : '未接続'}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded">
            <div className="h-2 bg-blue-500 rounded transition-all" style={{ width: `${levelTab}%` }} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={!micStream && !tabStream}
            className={`px-5 py-2 rounded-lg text-white transition-colors ${
              !micStream && !tabStream ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            録音開始
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-5 py-2 rounded-lg text-white bg-red-700 hover:bg-red-800 transition-colors"
          >
            録音停止
          </button>
        )}
        <p className="text-xs text-gray-600">
          タブ選択時にGoogle Meetのタブを選び、「タブの音声を共有」にチェックしてください。
        </p>
      </div>
    </div>
  );
};
