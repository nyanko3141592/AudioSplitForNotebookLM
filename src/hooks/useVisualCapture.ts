import { useState, useCallback, useRef, useEffect } from 'react';
import type { VisualCaptureSettings, CaptureAnalysis, VisualCaptureState } from '../types/visualCapture';
import { defaultVisualCaptureSettings } from '../types/visualCapture';
import { VisualCaptureManager } from '../utils/visualCapture';
import { GeminiVisionAnalyzer, generateVisualBackgroundInfo } from '../utils/geminiVision';

const VISUAL_CAPTURE_SETTINGS_KEY = 'audioSplitter_visualCaptureSettings';

/**
 * ローカルストレージから設定を読み込み
 */
const loadSettingsFromStorage = (): VisualCaptureSettings => {
  try {
    const stored = localStorage.getItem(VISUAL_CAPTURE_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultVisualCaptureSettings, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load visual capture settings from localStorage:', error);
  }
  return defaultVisualCaptureSettings;
};

/**
 * ローカルストレージに設定を保存
 */
const saveSettingsToStorage = (settings: VisualCaptureSettings): void => {
  try {
    localStorage.setItem(VISUAL_CAPTURE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save visual capture settings to localStorage:', error);
  }
};

export const useVisualCapture = () => {
  const [settings, setSettings] = useState<VisualCaptureSettings>(() => loadSettingsFromStorage());
  const [state, setState] = useState<VisualCaptureState>({
    isCapturing: false,
    capturedImages: [],
    nextCaptureIn: 0,
    totalCost: { imagesCount: 0, estimatedTokens: 0, estimatedCostJPY: 0, warning: null }
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });

  const captureManagerRef = useRef<VisualCaptureManager | null>(null);
  const visionAnalyzerRef = useRef<GeminiVisionAnalyzer | null>(null);

  /**
   * 設定を更新
   */
  const updateSettings = useCallback((newSettings: Partial<VisualCaptureSettings>) => {
    setSettings(prev => {
      const updatedSettings = { ...prev, ...newSettings };
      saveSettingsToStorage(updatedSettings);
      return updatedSettings;
    });
  }, []);

  /**
   * API キーを設定
   */
  const setApiCredentials = useCallback((apiKey: string, apiEndpoint?: string) => {
    if (apiKey) {
      visionAnalyzerRef.current = new GeminiVisionAnalyzer(
        apiKey, 
        apiEndpoint || 'https://generativelanguage.googleapis.com',
        'gemini-2.0-flash-lite',
        settings.duplicateThreshold,
        settings.duplicateDetection
      );
    } else {
      visionAnalyzerRef.current = null;
    }
  }, [settings.duplicateThreshold, settings.duplicateDetection]);

  /**
   * ビジュアルキャプチャを開始
   */
  const startCapture = useCallback(async (stream: MediaStream) => {
    if (!settings.enabled) {
      console.log('Visual capture is disabled');
      return;
    }

    console.log('🎥 Starting visual capture with settings:', settings);

    // 既存のマネージャーがあれば停止
    if (captureManagerRef.current) {
      captureManagerRef.current.stopCapture();
    }

    // 新しいマネージャーを作成
    captureManagerRef.current = new VisualCaptureManager(settings);

    // 状態をリセット
    setState(prev => ({
      ...prev,
      isCapturing: true,
      capturedImages: [],
      nextCaptureIn: 0
    }));

    // キャプチャ開始
    await captureManagerRef.current.startCapture(
      stream,
      // キャプチャコールバック
      (analysis: CaptureAnalysis) => {
        console.log('📸 New capture received:', analysis.id);
        setState(prev => ({
          ...prev,
          capturedImages: [...prev.capturedImages, analysis],
          totalCost: {
            imagesCount: prev.capturedImages.length + 1,
            estimatedTokens: (prev.capturedImages.length + 1) * 1000,
            estimatedCostJPY: Math.ceil((prev.capturedImages.length + 1) * 1000 * 0.004),
            warning: null
          }
        }));
      },
      // 状態変更コールバック
      (isCapturing: boolean, nextCaptureIn: number) => {
        setState(prev => ({
          ...prev,
          isCapturing,
          nextCaptureIn
        }));
      }
    );
  }, [settings]);

  /**
   * ビジュアルキャプチャを停止
   */
  const stopCapture = useCallback(() => {
    console.log('🛑 Stopping visual capture');
    
    if (captureManagerRef.current) {
      captureManagerRef.current.stopCapture();
      captureManagerRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isCapturing: false,
      nextCaptureIn: 0
    }));
  }, []);

  /**
   * キャプチャ画像を分析
   */
  const analyzeCaptures = useCallback(async (): Promise<string> => {
    if (!visionAnalyzerRef.current) {
      throw new Error('Gemini API credentials not set');
    }

    if (state.capturedImages.length === 0) {
      return '';
    }

    const unanalyzedCaptures = state.capturedImages.filter(c => !c.description && !c.error && c.imageData);
    
    // If all captures are already analyzed, generate summary from existing data
    if (unanalyzedCaptures.length === 0) {
      const analyzedCaptures = state.capturedImages.filter(c => c.description && !c.error);
      if (analyzedCaptures.length > 0) {
        console.log('🤖 Generating summary from existing analyzed captures...');
        return await visionAnalyzerRef.current.generateSummary(analyzedCaptures);
      }
      return '';
    }

    console.log(`🤖 Starting two-stage analysis: ${unanalyzedCaptures.length} captures...`);
    
    setIsAnalyzing(true);
    setAnalysisProgress({ current: 0, total: unanalyzedCaptures.length });

    try {
      // Stage 1: Individual image analysis
      console.log('📸 Stage 1: Analyzing individual images...');
      const analyzedCaptures = await visionAnalyzerRef.current.analyzeBatch(
        unanalyzedCaptures,
        (current, total) => {
          setAnalysisProgress({ current, total });
        }
      );

      // Update state with individual analysis results
      setState(prev => {
        const updatedCaptures = prev.capturedImages.map(capture => {
          const analyzed = analyzedCaptures.find(a => a.id === capture.id);
          return analyzed || capture;
        });

        return {
          ...prev,
          capturedImages: updatedCaptures
        };
      });

      // Stage 2: Generate comprehensive summary
      console.log('📝 Stage 2: Generating comprehensive summary...');
      const validAnalyzedCaptures = analyzedCaptures.filter(c => c.description && !c.error);
      
      if (validAnalyzedCaptures.length === 0) {
        console.log('⚠️ No valid analyzed captures for summary generation');
        return '';
      }

      const summary = await visionAnalyzerRef.current.generateSummary(validAnalyzedCaptures);
      console.log('✅ Two-stage visual analysis completed:', summary.substring(0, 100) + '...');
      
      return summary;

    } catch (error) {
      console.error('❌ Visual analysis failed:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress({ current: 0, total: 0 });
    }
  }, [state.capturedImages]);

  /**
   * 背景情報を生成（分析済みキャプチャから）
   */
  const generateBackgroundInfo = useCallback((): string => {
    return generateVisualBackgroundInfo(state.capturedImages);
  }, [state.capturedImages]);

  /**
   * 手動で即座にキャプチャを実行
   */
  const captureNow = useCallback(async () => {
    if (!captureManagerRef.current) {
      console.warn('Capture manager not available for manual capture');
      return;
    }
    
    await captureManagerRef.current.captureNow();
  }, []);

  /**
   * 画像をアップロードしてキャプチャに追加
   */
  const uploadImage = useCallback((file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        const analysis: CaptureAnalysis = {
          id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          recordingTime: 0, // アップロード画像は録音時間0とする
          imageData,
          description: '',
          uploaded: true // アップロード画像フラグ
        };

        setState(prev => ({
          ...prev,
          capturedImages: [...prev.capturedImages, analysis],
          totalCost: {
            imagesCount: prev.capturedImages.length + 1,
            estimatedTokens: (prev.capturedImages.length + 1) * 1000,
            estimatedCostJPY: Math.ceil((prev.capturedImages.length + 1) * 1000 * 0.004),
            warning: null
          }
        }));

        console.log('📷 Image uploaded and added to captures:', analysis.id);
        resolve();
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }, []);

  /**
   * キャプチャをクリア
   */
  const clearCaptures = useCallback(() => {
    setState(prev => ({
      ...prev,
      capturedImages: [],
      totalCost: { imagesCount: 0, estimatedTokens: 0, estimatedCostJPY: 0, warning: null }
    }));
  }, []);

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (captureManagerRef.current) {
        captureManagerRef.current.stopCapture();
      }
    };
  }, []);

  return {
    // 設定
    settings,
    updateSettings,
    setApiCredentials,
    
    // 状態
    state,
    isAnalyzing,
    analysisProgress,
    
    // アクション
    startCapture,
    stopCapture,
    captureNow,
    uploadImage,
    analyzeCaptures,
    generateBackgroundInfo,
    clearCaptures,
    
    // 計算値
    hasApiCredentials: visionAnalyzerRef.current !== null,
    canAnalyze: visionAnalyzerRef.current !== null && state.capturedImages.some(c => !c.description && !c.error && c.imageData),
  };
};