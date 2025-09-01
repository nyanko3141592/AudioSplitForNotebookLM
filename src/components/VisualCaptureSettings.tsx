import React, { useState } from 'react';
import { Camera, Clock, Image, AlertTriangle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import type { VisualCaptureSettings } from '../types/visualCapture';
import { estimateCapturesCost } from '../utils/visualCapture';

interface VisualCaptureSettingsProps {
  settings: VisualCaptureSettings;
  onSettingsChange: (settings: VisualCaptureSettings) => void;
  disabled?: boolean;
  className?: string;
}

export const VisualCaptureSettingsComponent: React.FC<VisualCaptureSettingsProps> = ({
  settings,
  onSettingsChange,
  disabled = false,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSettingChange = <K extends keyof VisualCaptureSettings>(
    key: K,
    value: VisualCaptureSettings[K]
  ) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  const costEstimation = estimateCapturesCost(settings.maxCaptures);
  const totalDuration = (settings.maxCaptures - 1) * settings.interval;
  const totalMinutes = Math.ceil(totalDuration / 60);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}>
      {/* メインのチェックボックスとトグル */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-3 cursor-pointer flex-1">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleSettingChange('enabled', e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center p-1.5 bg-blue-100 rounded-lg">
              <Camera className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <span className="font-medium text-gray-900">
                映像キャプチャ機能を有効にする
              </span>
              <p className="text-xs text-gray-600">
                タブ共有録音中に画面をキャプチャして分析
              </p>
            </div>
          </div>
        </label>
        
        {/* 詳細設定の展開ボタン */}
        {settings.enabled && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            disabled={disabled}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* 現在の設定を簡単に表示（折りたたまれている時） */}
      {settings.enabled && !isExpanded && (
        <div className="mt-3 ml-7 text-xs text-gray-500">
          {settings.interval}秒間隔 • 最大{settings.maxCaptures}枚 • 画質{Math.round(settings.imageQuality * 100)}% • 推定費用¥{costEstimation.estimatedCostJPY}
        </div>
      )}

      {/* 詳細設定（展開時のみ表示） */}
      {settings.enabled && isExpanded && (
        <div className="mt-6 space-y-6 border-t border-gray-100 pt-6">
          {/* キャプチャ間隔 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              <Clock className="w-4 h-4 inline mr-2" />
              キャプチャ間隔
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="15"
                max="300"
                step="15"
                value={settings.interval}
                onChange={(e) => handleSettingChange('interval', parseInt(e.target.value))}
                disabled={disabled}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="15"
                  max="300"
                  value={settings.interval}
                  onChange={(e) => handleSettingChange('interval', parseInt(e.target.value) || 15)}
                  disabled={disabled}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">秒</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              推奨: 60秒（コストと情報量のバランス）
            </p>
          </div>

          {/* 最大枚数 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              <Image className="w-4 h-4 inline mr-2" />
              最大キャプチャ枚数
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={settings.maxCaptures}
                onChange={(e) => handleSettingChange('maxCaptures', parseInt(e.target.value))}
                disabled={disabled}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.maxCaptures}
                  onChange={(e) => handleSettingChange('maxCaptures', parseInt(e.target.value) || 1)}
                  disabled={disabled}
                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">枚</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              推奨: 5-10枚（長時間録音でも適度な情報量）
            </p>
          </div>

          {/* 画質設定 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              画質設定
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="30"
                max="100"
                step="10"
                value={Math.round(settings.imageQuality * 100)}
                onChange={(e) => handleSettingChange('imageQuality', parseInt(e.target.value) / 100)}
                disabled={disabled}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex items-center gap-2">
                <span className="w-10 text-sm text-gray-700 font-mono">
                  {Math.round(settings.imageQuality * 100)}%
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              70%推奨: 分析に十分で転送量も適度
            </p>
          </div>

          {/* 重複検出設定 */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={settings.duplicateDetection}
                onChange={(e) => handleSettingChange('duplicateDetection', e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">重複画像検出</span>
                <div className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                  API節約
                </div>
              </div>
            </label>
            
            {settings.duplicateDetection && (
              <div className="ml-7 space-y-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    類似度閾値: {Math.round(settings.duplicateThreshold * 100)}%
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0.8"
                      max="0.99"
                      step="0.01"
                      value={settings.duplicateThreshold}
                      onChange={(e) => handleSettingChange('duplicateThreshold', parseFloat(e.target.value))}
                      disabled={disabled}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0.8"
                        max="0.99"
                        step="0.01"
                        value={settings.duplicateThreshold}
                        onChange={(e) => handleSettingChange('duplicateThreshold', parseFloat(e.target.value) || 0.95)}
                        disabled={disabled}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    95%推奨: ほぼ同じ画面のみ重複とみなす（85%未満は非推奨）
                  </p>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-green-800">
                      <p className="font-medium mb-1">API呼び出し効率化</p>
                      <p>類似した画像は1枚のみ分析し、結果を共有することでコストを削減します。</p>
                      <p className="mt-1 font-medium text-green-900">最大10枚まで選択して分析（時系列で均等分散）</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 録音時間と費用の目安 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h4 className="font-medium text-blue-900">設定内容の確認</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <div>• 最大録音時間: <strong>約{totalMinutes}分</strong> ({settings.maxCaptures}枚 × {settings.interval}秒間隔)</div>
                  <div>• 推定API費用: <strong>¥{costEstimation.estimatedCostJPY}</strong> (約{costEstimation.estimatedTokens}トークン)</div>
                  <div>• 1回目は即座に撮影、その後{settings.interval}秒間隔で{settings.maxCaptures - 1}回撮影</div>
                </div>
              </div>
            </div>
          </div>

          {/* コスト警告 */}
          {costEstimation.warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-900">コスト注意</h4>
                  <p className="text-sm text-amber-800 mt-1">
                    {costEstimation.warning}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 制限事項の説明 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">制限事項・注意点</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• タブ共有録音時のみ有効（マイク録音では動作しません）</li>
              <li>• Gemini API キーが必要です</li>
              <li>• インターネット接続が必要です</li>
              <li>• 画像分析には数秒かかる場合があります</li>
              <li>• プライベートな内容が画面に表示されている場合はご注意ください</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};