import React from 'react';
import { cn } from '../lib/utils';
import { HardDrive, Hash } from 'lucide-react';

export type SplitMode = 'size' | 'count';

interface SplitOptionsProps {
  mode: SplitMode;
  onModeChange: (mode: SplitMode) => void;
  maxSize: number;
  onMaxSizeChange: (size: number) => void;
  splitCount: number;
  onSplitCountChange: (count: number) => void;
  disabled?: boolean;
}

export const SplitOptions: React.FC<SplitOptionsProps> = ({
  mode,
  onModeChange,
  maxSize,
  onMaxSizeChange,
  splitCount,
  onSplitCountChange,
  disabled
}) => {
  return (
    <div className={cn("space-y-6", disabled && "opacity-50 pointer-events-none")}>
      <h3 className="text-lg font-bold text-gray-800 flex items-center">
        <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full mr-3"></div>
        分割方式を選択
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          className={cn(
            "relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200",
            mode === 'size' 
              ? "border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg" 
              : "border-gray-200 hover:border-gray-300 bg-white"
          )}
          onClick={() => onModeChange('size')}
        >
          <div className="flex items-start space-x-3">
            <input
              type="radio"
              name="splitMode"
              value="size"
              checked={mode === 'size'}
              onChange={() => onModeChange('size')}
              className="w-5 h-5 text-blue-600 mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <HardDrive className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-gray-800">最大サイズ指定</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                各ファイルの最大サイズを指定して分割
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={maxSize}
                  onChange={(e) => onMaxSizeChange(Number(e.target.value))}
                  disabled={mode !== 'size'}
                  className={cn(
                    "w-24 px-3 py-2 rounded-lg font-medium transition-all",
                    mode === 'size' 
                      ? "border-2 border-blue-300 bg-white text-blue-600" 
                      : "border border-gray-300 bg-gray-50 text-gray-400"
                  )}
                />
                <span className={cn(
                  "font-medium",
                  mode === 'size' ? "text-blue-600" : "text-gray-400"
                )}>MB</span>
              </div>
            </div>
          </div>
        </div>

        <div 
          className={cn(
            "relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200",
            mode === 'count' 
              ? "border-purple-500 bg-gradient-to-br from-purple-50 to-blue-50 shadow-lg" 
              : "border-gray-200 hover:border-gray-300 bg-white"
          )}
          onClick={() => onModeChange('count')}
        >
          <div className="flex items-start space-x-3">
            <input
              type="radio"
              name="splitMode"
              value="count"
              checked={mode === 'count'}
              onChange={() => onModeChange('count')}
              className="w-5 h-5 text-purple-600 mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <Hash className="w-5 h-5 text-purple-600" />
                <span className="font-semibold text-gray-800">分割数指定</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                指定した個数に均等分割
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="2"
                  max="100"
                  value={splitCount}
                  onChange={(e) => onSplitCountChange(Number(e.target.value))}
                  disabled={mode !== 'count'}
                  className={cn(
                    "w-24 px-3 py-2 rounded-lg font-medium transition-all",
                    mode === 'count' 
                      ? "border-2 border-purple-300 bg-white text-purple-600" 
                      : "border border-gray-300 bg-gray-50 text-gray-400"
                  )}
                />
                <span className={cn(
                  "font-medium",
                  mode === 'count' ? "text-purple-600" : "text-gray-400"
                )}>個</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};