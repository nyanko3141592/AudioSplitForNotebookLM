import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Download, Loader2, AlertCircle, CheckCircle, RefreshCw, Copy, Key, Trash2, ArrowRight, Pencil } from 'lucide-react';
// import { recoveryManager } from '../../utils/recoveryManager';
import { GeminiTranscriber, downloadTranscription } from '../../utils/geminiTranscriber';
import { markdownToHtml, plainToHtml, buildHtmlDocument, copyHtmlToClipboard } from '../../utils/format';
import type { TranscriptionResult } from '../../utils/geminiTranscriber';
import { apiKeyStorage, localStorage, apiEndpointStorage } from '../../utils/storage';
import { addSummaryToHistory } from '../../utils/summaryHistory';
import type { SummaryHistoryItem } from '../../types/summaryHistory';
import { useFormatPresets, type FormatPreset } from '../../hooks/useFormatPresets';
import { KnowledgePresetSelector } from '../KnowledgePresetSelector';
import { useKnowledgePresets, type KnowledgePreset } from '../../hooks/useKnowledgePresets';
import { defaultKnowledgePresets } from '../../constants/knowledgePresets';

interface SummaryStepProps {
  transcriptionResults: TranscriptionResult[];
  transcriptionBackgroundInfo?: string;
  visualSummary?: string;
  visualCaptures?: Array<{
    id: string;
    imageData: string;
    description: string;
    recordingTime: number;
  }>;
  fileName?: string;
  onBackgroundInfoChange?: (backgroundInfo: string) => void;
  presetApiKey?: string;
  presetApiEndpoint?: string;
  selectedKnowledgePresetIds?: string[];
  onKnowledgePresetSelectionChange?: (ids: string[]) => void;
}

export function SummaryStep({ 
  transcriptionResults,
  transcriptionBackgroundInfo = '',
  visualSummary = '',
  visualCaptures = [],
  fileName = 'audio',
  onBackgroundInfoChange,
  presetApiKey = '',
  presetApiEndpoint = '',
  selectedKnowledgePresetIds,
  onKnowledgePresetSelectionChange,
}: SummaryStepProps) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash-lite');
  const [apiEndpoint, setApiEndpoint] = useState('https://generativelanguage.googleapis.com');
  const [error, setError] = useState<string | null>(null);
  const [summarySettings, setSummarySettings] = useState({
    customPrompt: '',
    backgroundInfo: '',
    isProcessing: false,
    result: '',
    progress: '',
    currentStep: 0,
    totalSteps: 3
  });
  const [useMarkdown, setUseMarkdown] = useState<boolean>(() => {
    const saved = window.localStorage.getItem('summary_use_markdown');
    return saved === '1';
  });
  const [actualSummaryCost, setActualSummaryCost] = useState<number | null>(null);
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetPrompt, setNewPresetPrompt] = useState('');
  const [presetFormError, setPresetFormError] = useState<string | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [lastHistoryItem, setLastHistoryItem] = useState<SummaryHistoryItem | null>(null);
  const [lastGeneratedTitle, setLastGeneratedTitle] = useState('');
  const [organizationName, setOrganizationName] = useState<string>(() => localStorage.getSummaryCompanyName());
  const [meetingDate, setMeetingDate] = useState<string>(() => {
    return localStorage.getSummaryMeetingDate() || new Date().toISOString().slice(0, 10);
  });

  // フォーマットプリセット
  const baseFormatPresets = useMemo<FormatPreset[]>(() => [
    {
      id: 'meeting',
      name: '議事録テンプレート',
      isRemovable: false,
      prompt: `あなたは会議議事録の専門家です。以下の文字起こしを基に、テンプレートに沿って日本語で整理してください。

【議事概要】
- 会議名 / 日付 / 参加者（分かる範囲で）

【決まったこと】
- 箇条書きで具体的に。担当者や期限があれば明記。

【Next Action】
- メンバー名: 内容 / 期限 の形式で列挙。

【議論サマリ】
- トピックごとに見出しをつけ、要点を箇条書きで整理。

【メモ・補足】
- 注意事項や宿題、次回予定があれば記載。

文字起こし結果：
{transcriptions}`
    }
  ], []);

  const { presets: formatPresets, addCustomPreset, removePreset, updateCustomPreset } = useFormatPresets(baseFormatPresets);
  const baseKnowledgePresets = useMemo(() => defaultKnowledgePresets, []);
  const { presets: knowledgePresets, addPreset: addKnowledgePreset, updatePreset: updateKnowledgePreset, removePreset: removeKnowledgePreset } = useKnowledgePresets(baseKnowledgePresets);
  const [internalKnowledgeSelection, setInternalKnowledgeSelection] = useState<string[]>([]);

  const effectiveKnowledgeSelection = selectedKnowledgePresetIds ?? internalKnowledgeSelection;

  const emitKnowledgeSelection = (ids: string[]) => {
    onKnowledgePresetSelectionChange?.(ids);
    if (!selectedKnowledgePresetIds) {
      setInternalKnowledgeSelection(ids);
    }
  };

  useEffect(() => {
    // preset APIキーがある場合はそれを使用、なければストレージから読み込み
    if (presetApiKey) {
      setApiKey(presetApiKey);
    } else {
      const savedApiKey = apiKeyStorage.get();
      if (savedApiKey) {
        setApiKey(savedApiKey);
      }
    }
    
    // モデル選択の復元
    const savedModel = window.localStorage.getItem('summary_model');
    if (savedModel) {
      setSelectedModel(savedModel);
    }

    // APIエンドポイント設定を読み込み（presetがある場合はそれを優先）
    if (presetApiEndpoint) {
      setApiEndpoint(presetApiEndpoint);
    } else {
      const savedEndpoint = apiEndpointStorage.get();
      setApiEndpoint(savedEndpoint);
    }
    
    const savedPrompt = localStorage.getSummaryCustomPrompt();
    
    // 保存されたプロンプトがある場合はそれを使用、なければ議事録プリセットをデフォルトに
    const defaultPrompt = baseFormatPresets.find(preset => preset.id === 'meeting')?.prompt || '';
    if (savedPrompt) {
      setSummarySettings(prev => ({ ...prev, customPrompt: savedPrompt }));
    } else {
      setSummarySettings(prev => ({ ...prev, customPrompt: defaultPrompt }));
      // デフォルトプロンプトも保存しておく
      localStorage.saveSummaryCustomPrompt(defaultPrompt);
    }
    
    // 文字起こしの背景情報のみ引き継ぐ（リロードで永続化しない）
    const backgroundToUse = transcriptionBackgroundInfo || '';
    setSummarySettings(prev => ({ ...prev, backgroundInfo: backgroundToUse }));
  }, [transcriptionBackgroundInfo, presetApiKey]);

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    window.localStorage.setItem('summary_model', value);
  };


  // コスト計算関数（要約用）
  const calculateSummaryCost = (textLength: number, model: string) => {
    const inputTokens = textLength / 4; // おおよそ4文字 = 1トークン
    const millionTokens = inputTokens / 1000000;
    
    const modelPricing = {
      'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
      'gemini-2.5-flash': { input: 0.30, output: 2.50 }, // テキスト価格
      'gemini-2.5-pro': { input: 0.30, output: 2.50 }, // テキスト価格（仮定）
    };
    
    const pricing = modelPricing[model as keyof typeof modelPricing] || modelPricing['gemini-2.0-flash-lite'];
    const inputCost = millionTokens * pricing.input;
    const outputCost = millionTokens * pricing.output * 0.3; // 出力は入力の約30%と仮定
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      tokens: inputTokens
    };
  };

  // 文字起こし結果の総文字数を計算
  const getTotalTextLength = () => {
    return transcriptionResults.reduce((total, result) => {
      return total + (result.transcription?.length || 0);
    }, 0);
  };

  // Auto-summarization removed - summary now requires manual trigger

  const handleCustomPromptChange = (value: string) => {
    setSummarySettings(prev => ({ ...prev, customPrompt: value }));
    localStorage.saveSummaryCustomPrompt(value);
  };

  const handleBackgroundInfoChange = (value: string) => {
    setSummarySettings(prev => ({ ...prev, backgroundInfo: value }));
    // リロードで永続化しない。親へはセッション内で引き回すため通知
    onBackgroundInfoChange?.(value);
  };
  
  const handlePresetSelect = (preset: FormatPreset) => {
    setSummarySettings(prev => ({ ...prev, customPrompt: preset.prompt }));
    localStorage.saveSummaryCustomPrompt(preset.prompt);
  };
 
  const handleOrganizationNameChange = (value: string) => {
    setOrganizationName(value);
    localStorage.saveSummaryCompanyName(value);
  };

  const handleMeetingDateChange = (value: string) => {
    setMeetingDate(value);
    localStorage.saveSummaryMeetingDate(value);
  };

  const handleKnowledgePresetInsert = (selectedPresets: KnowledgePreset[]) => {
    if (!selectedPresets || selectedPresets.length === 0) return;
    setSummarySettings((prev) => {
      const trimmedPrev = prev.backgroundInfo.trim();
      const additions = selectedPresets
        .map((preset) => preset.content?.trim())
        .filter((text): text is string => Boolean(text) && !trimmedPrev.includes(text));

      if (additions.length === 0) {
        return prev;
      }

      const combinedAdditions = additions.join('\n\n');
      const nextBackgroundInfo = trimmedPrev ? `${trimmedPrev}\n\n${combinedAdditions}` : combinedAdditions;
      onBackgroundInfoChange?.(nextBackgroundInfo);
      return { ...prev, backgroundInfo: nextBackgroundInfo };
    });
  };

  const handleCustomPresetSave = () => {
    try {
      if (editingPresetId) {
        const updated = updateCustomPreset(editingPresetId, {
          name: newPresetName,
          prompt: newPresetPrompt
        });
        handlePresetSelect(updated);
      } else {
        const created = addCustomPreset(newPresetName, newPresetPrompt);
        handlePresetSelect(created);
      }
      setNewPresetName('');
      setNewPresetPrompt('');
      setPresetFormError(null);
      setShowPresetForm(false);
      setEditingPresetId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'プリセットの保存に失敗しました';
      setPresetFormError(message);
    }
  };

  const handleCustomPresetCancel = () => {
    setShowPresetForm(false);
    setNewPresetName('');
    setNewPresetPrompt('');
    setPresetFormError(null);
    setEditingPresetId(null);
  };

  const handlePresetDelete = (presetId: string) => {
    removePreset(presetId);
    if (editingPresetId === presetId) {
      handleCustomPresetCancel();
    }
  };

  const handleCustomPresetEdit = (preset: FormatPreset) => {
    setShowPresetForm(true);
    setEditingPresetId(preset.id);
    setNewPresetName(preset.name);
    setNewPresetPrompt(preset.prompt);
    setPresetFormError(null);
  };


  const handleCopySummary = async () => {
    if (!summarySettings.result) return;
    const htmlBody = useMarkdown
      ? markdownToHtml(summarySettings.result)
      : plainToHtml(summarySettings.result);
    await copyHtmlToClipboard(`<div>${htmlBody}</div>`, summarySettings.result);
    // TODO: Add toast notification for copy success
  };

  const showSummarySavedOverlay = (historyItem: SummaryHistoryItem) => {
    try {
      const existing = document.getElementById('summary-history-saved-overlay');
      if (existing) {
        existing.remove();
      }

      const overlay = document.createElement('div');
      overlay.id = 'summary-history-saved-overlay';
      overlay.className = 'fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';

      const panel = document.createElement('div');
      panel.className = 'relative bg-white rounded-3xl shadow-2xl max-w-lg w-full px-8 py-8 text-center border border-green-200';
      panel.innerHTML = `
        <div class="flex flex-col items-center gap-4">
          <div class="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 text-3xl font-bold shadow-inner">✓</div>
          <h4 class="text-2xl font-semibold text-gray-900">要約を保存しました</h4>
          <p class="text-sm text-gray-600">要約一覧ページでいつでも確認できます。</p>
        </div>
      `;

      const actions = document.createElement('div');
      actions.className = 'mt-8 flex flex-col sm:flex-row justify-center gap-3';

      const viewButton = document.createElement('button');
      viewButton.type = 'button';
      viewButton.className = 'px-5 py-3 bg-green-600 text-white font-semibold rounded-full shadow-lg shadow-green-200/80 hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500';
      viewButton.textContent = '今すぐ表示';
      viewButton.onclick = () => {
        try {
          window.localStorage.setItem('pendingOpenSummaryId', historyItem.id);
        } catch {}
        const ev = new CustomEvent('openSummaryById', { detail: { id: historyItem.id } });
        window.dispatchEvent(ev);
        overlay.remove();
      };

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'px-5 py-3 border border-gray-300 text-gray-700 font-medium rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300';
      closeButton.textContent = '閉じる';
      closeButton.onclick = () => overlay.remove();

      actions.appendChild(viewButton);
      actions.appendChild(closeButton);
      panel.appendChild(actions);

      overlay.appendChild(panel);
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          overlay.remove();
        }
      });

      document.body.appendChild(overlay);

      window.setTimeout(() => {
        if (document.body.contains(overlay)) {
          overlay.remove();
        }
      }, 12000);
    } catch (overlayError) {
      console.error('Failed to show summary saved overlay:', overlayError);
    }
  };

  const handleSummarize = async (preset?: FormatPreset) => {
    if (!apiKey || transcriptionResults.length === 0) {
      setError('APIキーと文字起こし結果が必要です');
      return;
    }

    setSummarySettings(prev => ({ 
      ...prev, 
      isProcessing: true, 
      result: '',
      progress: '処理を開始しています...',
      currentStep: 0 
    }));
    setError(null);
    
    // Start recovery tracking - disabled
    // recoveryManager.startAutoSave();
    // recoveryManager.updateStepState('summary', {
    //   isProcessing: true,
    //   transcriptionResults,
    //   backgroundInfo: summarySettings.backgroundInfo
    // });

    try {
      const transcriber = new GeminiTranscriber(apiKey, selectedModel, apiEndpoint);
      let formatPrompt = summarySettings.customPrompt;
      
      // プリセットが指定されている場合
      if (preset) {
        formatPrompt = preset.prompt;
        setSummarySettings(prev => ({ 
          ...prev, 
          progress: `${preset.name}形式で処理中...`,
          currentStep: 1 
        }));
      } else {
        setSummarySettings(prev => ({ 
          ...prev, 
          progress: 'カスタムプロンプトで処理中...',
          currentStep: 1 
        }));
      }
      
      // 背景情報をプロンプトに追加（プリセット・カスタム両方対応）
      if (summarySettings.backgroundInfo) {
        const backgroundContext = `

## 追加情報・背景
${summarySettings.backgroundInfo}

上記の背景情報を踏まえて、文字起こし結果をまとめてください。
`;
        if (formatPrompt && formatPrompt.includes('{transcriptions}')) {
          formatPrompt = formatPrompt.replace('{transcriptions}', backgroundContext + '\n{transcriptions}');
        } else if (formatPrompt) {
          // {transcriptions}プレースホルダーがない場合
          formatPrompt = backgroundContext + '\n\n' + formatPrompt;
        } else {
          // プロンプトが空の場合
          formatPrompt = backgroundContext;
        }
      }

      // 出力形式の明示（デフォルト: プレーンテキスト）
      const outputDirectivePlain = `\n\n出力形式: プレーンテキスト。Markdown記法（#, *, -, 1., \`\`\`, _ など）は使用しない。\n箇条書きは「・」や「▼」などのテキスト記号で表現し、見出しはテキストのみで装飾（例: 【見出し】）とする。\n余分な説明や前置きは出力しない。`;
      const outputDirectiveMarkdown = `\n\n出力形式: Markdown。適切な見出し（#）、リスト（- / 1.）、強調（**）等を用いて整形し、余分な説明は出力しない。`;
      formatPrompt = (formatPrompt || '') + (useMarkdown ? outputDirectiveMarkdown : outputDirectivePlain);

      // Step 2: 文字起こし結果を統合
      const hasVisualInfo = visualSummary && visualSummary.length > 0;
      setSummarySettings(prev => ({ 
        ...prev, 
        progress: hasVisualInfo 
          ? '文字起こし結果と画像解析情報を統合しています...'
          : '文字起こし結果を統合しています...',
        currentStep: 2 
      }));

      const summary = await transcriber.summarizeTranscriptions(
        transcriptionResults,
        formatPrompt || undefined,
        (status: string) => {
          setSummarySettings(prev => ({ 
            ...prev, 
            progress: status,
            currentStep: 3 
          }));
        },
        visualSummary || undefined
      );

      // 実際のコストを計算
      const textLength = getTotalTextLength();
      const cost = calculateSummaryCost(textLength, selectedModel);
      setActualSummaryCost(cost.totalCost);

      setSummarySettings(prev => ({ 
        ...prev, 
        result: summary,
        progress: hasVisualInfo 
          ? 'まとめが完了しました！（画像解析情報も含む）'
          : 'まとめが完了しました！',
        currentStep: 3 
      }));

      void syncSummaryToSheets(summary);

      // Save summary to recovery state - disabled
      // recoveryManager.updateStepState('summary', {
      //   isProcessing: false,
      //   generatedSummary: summary
      // });

      // Generate title using Gemini API
      setSummarySettings(prev => ({ 
        ...prev, 
        progress: 'タイトルを生成しています...',
        currentStep: 4 
      }));
      
      let generatedTitle = '';
      try {
        generatedTitle = await transcriber.generateTitle(summary);
      } catch (titleError) {
        console.error('Title generation failed:', titleError);
        generatedTitle = fileName || 'Untitled';
      }

      // Save to history
      const historyItem = createHistoryItem(summary, generatedTitle);
      
      const saved = addSummaryToHistory(historyItem);
      if (saved) {
        console.log('📚 Summary saved to history with generated title:', generatedTitle);
        showSummarySavedOverlay(historyItem);
        setLastHistoryItem(historyItem);
        setLastGeneratedTitle(generatedTitle);
      } else {
        console.error('Failed to save summary to history');
        setLastHistoryItem(null);
        // Error toast
        try {
          const toast = document.createElement('div');
          toast.className = 'fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-[9999]';
          toast.textContent = '履歴への保存に失敗しました（容量不足の可能性）';
          document.body.appendChild(toast);
          setTimeout(() => { toast.remove(); }, 4000);
        } catch {}
      }
      
      setSummarySettings(prev => ({ 
        ...prev, 
        progress: hasVisualInfo 
          ? 'まとめが完了しました！（画像解析情報も含む）'
          : 'まとめが完了しました！',
        currentStep: 4 
      }));
      
      // Clear recovery state on successful completion - disabled
      // recoveryManager.clearState();
    } catch (error) {
      console.error('Summary error:', error);
      setError(error instanceof Error ? error.message : 'まとめ処理に失敗しました');
      
      // Save error state for recovery - disabled
      // recoveryManager.updateStepState('summary', {
      //   isProcessing: false,
      //   error: error instanceof Error ? error.message : 'まとめ処理に失敗しました'
      // });
    } finally {
      setSummarySettings(prev => ({ ...prev, isProcessing: false }));
      
      // Stop auto-save - disabled
      // recoveryManager.stopAutoSave();
    }
  };;

  const handleDownloadSummary = () => {
    if (summarySettings.result) {
      if (useMarkdown) {
        downloadTranscription(summarySettings.result, 'summary.md', 'text/markdown;charset=utf-8');
      } else {
        downloadTranscription(summarySettings.result, 'summary.txt', 'text/plain;charset=utf-8');
      }
    }
  };

  const createHistoryItem = (summaryText: string, title: string): SummaryHistoryItem => ({
    id: `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    fileName: fileName || 'Untitled',
    title,
    summary: summaryText,
    transcriptionResults: transcriptionResults.map(result => ({
      fileName: result.fileName,
      text: result.transcription || ''
    })),
    visualSummary: visualSummary || undefined,
    visualCaptures: visualCaptures.length > 0 ? visualCaptures : undefined,
    metadata: {
      language: 'ja',
      model: selectedModel,
      createdAt: new Date().toISOString(),
      companyName: organizationName || undefined,
      meetingDate: meetingDate || undefined
    }
  });

  const ensureHistoryItem = (): SummaryHistoryItem | null => {
    if (lastHistoryItem) return lastHistoryItem;
    if (!summarySettings.result) return null;
    const title = lastGeneratedTitle || fileName || 'Untitled';
    const item = createHistoryItem(summarySettings.result, title);
    const saved = addSummaryToHistory(item);
    if (!saved) {
      return null;
    }
    setLastHistoryItem(item);
    return item;
  };

  const handleNavigateToHistory = () => {
    const historyItem = ensureHistoryItem();
    if (!historyItem) {
      window.alert('要約の保存に失敗しました。ストレージ容量を確認してください。');
      return;
    }
    try {
      window.localStorage.setItem('pendingOpenSummaryId', historyItem.id);
    } catch {}
    const ev = new CustomEvent('openSummaryById', { detail: { id: historyItem.id } });
    window.dispatchEvent(ev);
  };

  const handleDownloadAsHtml = () => {
    if (!summarySettings.result) return;
    const htmlBody = useMarkdown
      ? markdownToHtml(summarySettings.result)
      : plainToHtml(summarySettings.result);
    const fullHtml = buildHtmlDocument(htmlBody, 'Summary');
    downloadTranscription(fullHtml, 'summary.html', 'text/html;charset=utf-8');
  };

  if (transcriptionResults.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        前のステップで文字起こしを完了してください
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* まとめ設定（統合） */}
      {apiKey && (
        <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            まとめ設定
          </h3>
          
          <div className="space-y-5">
            {/* Compact Model Selection */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 min-w-0">
                モデル:
              </label>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={summarySettings.isProcessing}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 text-sm"
              >
                <option value="gemini-2.0-flash-lite">Flash-Lite (推奨)</option>
                <option value="gemini-2.5-flash">2.5 Flash (高性能)</option>
                <option value="gemini-2.5-pro">2.5 Pro (最高性能)</option>
              </select>
            </div>

            {/* Format Presets */}
            <div>
              <div className="flex items-center justify-between mb-3 gap-4">
                <label className="text-sm font-medium text-gray-700">
                  形式プリセット（下のテキストエリアに自動入力）
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (showPresetForm) {
                      handleCustomPresetCancel();
                    } else {
                      setShowPresetForm(true);
                      setEditingPresetId(null);
                      setNewPresetName('');
                      setNewPresetPrompt('');
                      setPresetFormError(null);
                    }
                  }}
                  className="text-xs font-medium text-purple-600 hover:text-purple-700"
                >
                  {showPresetForm ? 'フォームを閉じる' : '＋プリセットを追加'}
                </button>
              </div>

              {showPresetForm && (
                <div className="mb-4 p-4 bg-white border border-purple-200 rounded-lg space-y-3 shadow-sm">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">プリセット名</label>
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                      placeholder="例: 社内報告テンプレート"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">プロンプト本文</label>
                    <textarea
                      value={newPresetPrompt}
                      onChange={(e) => setNewPresetPrompt(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm resize-y min-h-28 font-mono"
                      placeholder="{transcriptions} を差し込む位置を含めたテンプレートを入力してください"
                    />
                    <p className="text-xs text-gray-500 mt-1">{`{transcriptions}`} が文字起こし結果に置き換わります</p>
                  </div>
                  {presetFormError && (
                    <p className="text-xs text-red-600">{presetFormError}</p>
                  )}
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleCustomPresetSave}
                      disabled={!newPresetName.trim() || !newPresetPrompt.trim()}
                      className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-40"
                    >
                      {editingPresetId ? '更新' : '保存'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCustomPresetCancel}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {formatPresets.map((preset) => (
                  <div key={preset.id} className="relative">
                    <button
                      onClick={() => handlePresetSelect(preset)}
                      disabled={summarySettings.isProcessing}
                      className="w-full px-4 py-3 rounded-lg transition-all text-sm font-medium disabled:opacity-50 bg-white border border-gray-300 text-gray-700 hover:bg-purple-50 hover:border-purple-300 focus:ring-2 focus:ring-purple-500 text-left"
                    >
                      <span className="block">{preset.name}</span>
                      {preset.isCustom && (
                        <span className="mt-1 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-purple-700 bg-purple-100 rounded-full">
                          ユーザー作成
                        </span>
                      )}
                    </button>
                    {(preset.isCustom || preset.isRemovable) && (
                      <div className="absolute -top-2 -right-2 flex gap-1">
                        {preset.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleCustomPresetEdit(preset)}
                            className="p-1 bg-white border border-gray-200 rounded-full shadow-sm text-gray-500 hover:text-violet-600"
                            aria-label={`${preset.name}を編集`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePresetDelete(preset.id)}
                          className="p-1 bg-white border border-gray-200 rounded-full shadow-sm text-gray-500 hover:text-red-600"
                          aria-label={`${preset.name}を削除`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Prompt Text Area */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                プロンプト（編集可能）
              </label>
              <textarea
                value={summarySettings.customPrompt}
                onChange={(e) => handleCustomPromptChange(e.target.value)}
                placeholder="上のプリセットを選択するか、独自のプロンプトを入力してください..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-32 text-sm resize-y font-mono bg-white"
                disabled={summarySettings.isProcessing}
              />
              <p className="text-xs text-gray-500 mt-1">
                プリセットで定型文を挿入後、自由に編集できます
              </p>
            </div>

            {/* Background Info - moved from detailed settings */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                背景情報（オプション）
              </label>
              <div className="mb-3">
                <KnowledgePresetSelector
                  presets={knowledgePresets}
                  disabled={summarySettings.isProcessing}
                  selectedIds={effectiveKnowledgeSelection}
                  onSelectionChange={emitKnowledgeSelection}
                  onInsert={handleKnowledgePresetInsert}
                  addPreset={addKnowledgePreset}
                  updatePreset={updateKnowledgePreset}
                  removePreset={removeKnowledgePreset}
                />
              </div>
              <textarea
                value={summarySettings.backgroundInfo}
                onChange={(e) => handleBackgroundInfoChange(e.target.value)}
                placeholder="例: 2024年1月26日の定例会議。参加者：田中、佐藤、鈴木。議題：新商品の戦略"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-20 text-sm resize-y"
                disabled={summarySettings.isProcessing}
              />
              <p className="text-xs text-gray-500 mt-1">
                会議の詳細情報を入力すると、より精度の高いまとめが生成されます
              </p>
            </div>

            {/* Meeting metadata */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                議事録の基本情報
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="text-xs text-gray-600 mb-1 block">企業・チーム名</span>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => handleOrganizationNameChange(e.target.value)}
                    placeholder="例: 株式会社テスト 開発部"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    disabled={summarySettings.isProcessing}
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-600 mb-1 block">議事録の日付</span>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => handleMeetingDateChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    disabled={summarySettings.isProcessing}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                この情報は要約履歴やスプレッドシート連携のメタデータとして利用されます
              </p>
            </div>

            {/* Output Format */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">
                出力形式:
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  checked={useMarkdown}
                  onChange={(e) => {
                    setUseMarkdown(e.target.checked);
                    window.localStorage.setItem('summary_use_markdown', e.target.checked ? '1' : '0');
                  }}
                  disabled={summarySettings.isProcessing}
                />
                Markdown形式
              </label>
            </div>
          </div>
        </div>
      )}

      {/* API Key - Show separately if needed */}
      {!presetApiKey && !apiKey && (
        <div className="bg-gray-50 rounded-xl p-6 border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Key className="w-5 h-5" />
            API設定が必要です
          </h3>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Gemini API キー
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500">
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                Google AI Studio
              </a>
              でAPIキーを取得してください
            </p>
          </div>
        </div>
      )}

      {/* API Key Status - Show when configured */}
      {!presetApiKey && apiKey && (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">APIキー設定済み</span>
          </div>
          <button
            onClick={() => {}}
            className="text-xs text-green-700 hover:text-green-800 underline"
          >
            変更
          </button>
        </div>
      )}


      {/* 再生成ボタン（入力・出力セクション間） */}
      {apiKey && !summarySettings.isProcessing && (
        <div className="text-center space-y-3">
          <button
            onClick={() => handleSummarize()}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl mx-auto"
          >
            {summarySettings.result ? (
              <>
                <RefreshCw className="w-5 h-5" />
                再生成
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                まとめ作成
              </>
            )}
          </button>
          
          <div className="text-sm text-gray-600">
            予想コスト: <span className="font-mono font-semibold">${(() => {
              const textLength = getTotalTextLength();
              const cost = calculateSummaryCost(textLength, selectedModel);
              return cost.totalCost.toFixed(4);
            })()}</span>
            <span className="ml-2 text-xs">({getTotalTextLength().toLocaleString()}文字)</span>
          </div>
        </div>
      )}

      {/* Processing Status */}
      {summarySettings.isProcessing && (
        <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
              <span className="text-lg font-semibold text-purple-800">まとめ作成中...</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-gray-700">
                <span>進行状況</span>
                <span>{Math.round((summarySettings.currentStep / summarySettings.totalSteps) * 100)}%</span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${(summarySettings.currentStep / summarySettings.totalSteps) * 100}%` }}
                />
              </div>
              <p className="text-sm text-purple-700 font-medium">{summarySettings.progress}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Summary Result */}
      {summarySettings.result && (
        <div className="bg-green-50 rounded-xl p-6 border border-green-200">
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2 justify-center">
                <CheckCircle className="w-5 h-5" />
                まとめ結果
              </h3>
              {visualSummary && visualSummary.length > 0 && (
                <p className="text-sm text-green-700 bg-green-100 px-3 py-1.5 rounded-full inline-block">
                  📸 画像解析情報も含んで要約されています
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg border border-green-200 p-4 max-h-80 overflow-y-auto">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{summarySettings.result}</pre>
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={handleCopySummary}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <Copy className="w-4 h-4" />
                コピー
              </button>
              <button
                onClick={handleDownloadSummary}
                className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <Download className="w-4 h-4" />
                テキスト
              </button>
              <button
                onClick={handleDownloadAsHtml}
                className="px-6 py-3 bg-pink-600 text-white font-medium rounded-lg hover:bg-pink-700 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <Download className="w-4 h-4" />
                HTML
              </button>
            </div>

            {actualSummaryCost !== null && (
              <div className="text-center text-sm text-gray-600">
                実際のコスト: <span className="font-mono font-semibold">${actualSummaryCost.toFixed(4)}</span>
              </div>
            )}

            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={handleNavigateToHistory}
                className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                一覧へ
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
