import { useState, useEffect } from 'react';
import { FileText, Download, Loader2, Key, AlertCircle, Shield, Trash2 } from 'lucide-react';
import { GeminiTranscriber, downloadTranscription } from '../utils/geminiTranscriber';
import type { TranscriptionResult } from '../utils/geminiTranscriber';
import type { SplitFile } from './DownloadList';
import { apiKeyStorage, localStorage, storage, storageMode } from '../utils/storage';

interface TranscriptionPanelProps {
  splitFiles: SplitFile[];
  isProcessing: boolean;
}

export function TranscriptionPanel({ splitFiles, isProcessing }: TranscriptionPanelProps) {
  const [apiKey, setApiKey] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResults, setTranscriptionResults] = useState<TranscriptionResult[]>([]);
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0, status: '' });
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  const [storageSettings, setStorageSettings] = useState({
    mode: storageMode.getMode()
  });
  
  const defaultPrompt = `この音声ファイルの内容を正確に文字起こししてください。
以下の点に注意してください：
- 話者の発言を忠実に文字起こしする
- 適切な句読点を追加する
- 専門用語や固有名詞は正確に記載する
- フィラー語（えー、あのー等）は適度に省略して読みやすくする
- 複数の話者がいる場合は、話者を区別して記載する

文字起こし結果のみを出力してください。`;

  // 初回読み込み時にストレージからデータを復元
  useEffect(() => {
    const savedApiKey = apiKeyStorage.get();
    const savedPrompt = localStorage.getCustomPrompt();
    
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    if (savedPrompt) {
      setCustomPrompt(savedPrompt);
    }
  }, []);

  // APIキーの保存（モード対応）
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    apiKeyStorage.save(value);
  };

  // ストレージモードの変更
  const handleStorageModeChange = (mode: 'session' | 'persistent' | 'none') => {
    const currentApiKey = apiKey;
    storageMode.setMode(mode);
    setStorageSettings({ mode });
    
    // 新しいモードで再保存
    if (currentApiKey) {
      apiKeyStorage.save(currentApiKey);
    }
  };

  // カスタムプロンプトの保存（ローカルストレージ）
  const handleCustomPromptChange = (value: string) => {
    setCustomPrompt(value);
    localStorage.saveCustomPrompt(value);
  };

  const clearStoredData = () => {
    storage.clearAll();
    setApiKey('');
    setCustomPrompt('');
  };

  const handleTranscribe = async () => {
    if (!apiKey) {
      setError('APIキーを入力してください');
      return;
    }

    if (splitFiles.length === 0) {
      setError('文字起こしする音声ファイルがありません');
      return;
    }

    setError(null);
    setIsTranscribing(true);
    setTranscriptionResults([]);

    try {
      const transcriber = new GeminiTranscriber(apiKey);
      
      const results = await transcriber.transcribeMultipleBlobs(
        splitFiles.map(f => f.blob),
        splitFiles.map(f => f.name),
        (current, total, status) => {
          setCurrentProgress({ current, total, status });
        },
        1000,
        customPrompt || undefined
      );

      setTranscriptionResults(results);
    } catch (error) {
      console.error('Transcription error:', error);
      setError(error instanceof Error ? error.message : '文字起こしに失敗しました');
    } finally {
      setIsTranscribing(false);
      setCurrentProgress({ current: 0, total: 0, status: '' });
    }
  };

  const handleDownloadTranscription = () => {
    if (transcriptionResults.length > 0) {
      const transcriber = new GeminiTranscriber();
      const formatted = transcriber.formatTranscriptions(transcriptionResults);
      downloadTranscription(formatted);
    }
  };

  const hasResults = transcriptionResults.length > 0;
  const successCount = transcriptionResults.filter(r => !r.error).length;

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-violet-600" />
        <h2 className="text-2xl font-bold text-gray-800">
          Gemini APIで文字起こし
        </h2>
      </div>

      {/* API Key Input */}
      <div className="space-y-2">
        <label htmlFor="api-key" className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Key className="w-4 h-4" />
          Gemini API キー
        </label>
        <input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(e) => handleApiKeyChange(e.target.value)}
          placeholder="AIzaSy..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          disabled={isTranscribing}
        />
        <p className="text-xs text-gray-500">
          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-violet-600 hover:underline"
          >
            Google AI Studio
          </a>
          でAPIキーを取得してください
        </p>
      </div>

      {/* Prompt Editor Toggle */}
      <div className="space-y-2">
        <button
          onClick={() => setShowPromptEditor(!showPromptEditor)}
          className="text-sm text-violet-600 hover:text-violet-700 font-medium"
        >
          {showPromptEditor ? '▼' : '▶'} プロンプトをカスタマイズ
        </button>
        
        {showPromptEditor && (
          <div className="space-y-2">
            <label htmlFor="custom-prompt" className="text-sm font-medium text-gray-700">
              カスタムプロンプト（空欄の場合はデフォルトを使用）
            </label>
            <textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => handleCustomPromptChange(e.target.value)}
              placeholder={defaultPrompt}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent h-32 font-mono text-sm"
              disabled={isTranscribing}
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleCustomPromptChange(defaultPrompt)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                デフォルトに戻す
              </button>
              <button
                onClick={() => handleCustomPromptChange('')}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                クリア
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Storage Settings */}
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">APIキー保存方式</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="session"
                checked={storageSettings.mode === 'session'}
                onChange={(e) => handleStorageModeChange(e.target.value as any)}
                className="mr-2"
                disabled={isTranscribing}
              />
              <span className="text-sm">セッションのみ（タブを閉じると削除）🔒</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="persistent"
                checked={storageSettings.mode === 'persistent'}
                onChange={(e) => handleStorageModeChange(e.target.value as any)}
                className="mr-2"
                disabled={isTranscribing}
              />
              <span className="text-sm">永続保存（タブを閉じても保持）⚠️</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="none"
                checked={storageSettings.mode === 'none'}
                onChange={(e) => handleStorageModeChange(e.target.value as any)}
                className="mr-2"
                disabled={isTranscribing}
              />
              <span className="text-sm">保存しない（毎回入力）🛡️</span>
            </label>
          </div>
        </div>

        <button
          onClick={() => setShowSecurityInfo(!showSecurityInfo)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-700"
        >
          <Shield className="w-4 h-4" />
          {showSecurityInfo ? '▼' : '▶'} セキュリティ詳細
        </button>
        
        {showSecurityInfo && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <div className="space-y-2">
              <p><strong>🔐 APIキー:</strong> {storage.getSecurityInfo().apiKeyStorage}</p>
              <p><strong>📝 カスタムプロンプト:</strong> ローカルストレージ（永続保存）</p>
              <p><strong>🛡️ 暗号化:</strong> 簡易難読化済み</p>
              <div className="mt-3 pt-2 border-t border-blue-300">
                <p className="text-blue-800 font-medium mb-2">推奨事項:</p>
                <ul className="text-blue-700 text-xs space-y-1">
                  {storage.getSecurityInfo().recommendations.map((rec, i) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <button
                  onClick={clearStoredData}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  すべてのデータをクリア
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Transcribe Button */}
      <button
        onClick={handleTranscribe}
        disabled={!apiKey || splitFiles.length === 0 || isTranscribing || isProcessing}
        className="w-full px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
      >
        {isTranscribing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            文字起こし中... {currentProgress.current}/{currentProgress.total}
          </>
        ) : (
          <>
            <FileText className="w-5 h-5" />
            文字起こしを開始 ({splitFiles.length}ファイル)
          </>
        )}
      </button>

      {/* Progress Status */}
      {isTranscribing && currentProgress.status && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">{currentProgress.status}</p>
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              完了: {successCount}/{transcriptionResults.length} ファイル
            </div>
            <button
              onClick={handleDownloadTranscription}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              文字起こし結果をダウンロード
            </button>
          </div>

          {/* Transcription Preview */}
          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4 space-y-4">
            {transcriptionResults.map((result) => (
              <div key={result.partNumber} className="space-y-2">
                <h3 className="font-semibold text-gray-800">
                  パート {result.partNumber}: {result.fileName}
                </h3>
                {result.error ? (
                  <p className="text-sm text-red-600">エラー: {result.error}</p>
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {result.transcription.slice(0, 200)}
                    {result.transcription.length > 200 && '...'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}