import React from 'react';
import { cn } from '../lib/utils';

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
    <div className={cn("space-y-4", disabled && "opacity-50 pointer-events-none")}>
      <h3 className="text-lg font-semibold">分割方式</h3>
      
      <div className="space-y-3">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="radio"
            name="splitMode"
            value="size"
            checked={mode === 'size'}
            onChange={() => onModeChange('size')}
            className="w-4 h-4 text-blue-600"
          />
          <span className="flex items-center space-x-2">
            <span>最大サイズ指定</span>
            <input
              type="number"
              min="1"
              max="200"
              value={maxSize}
              onChange={(e) => onMaxSizeChange(Number(e.target.value))}
              disabled={mode !== 'size'}
              className="w-20 px-2 py-1 border rounded text-sm"
            />
            <span>MB</span>
          </span>
        </label>

        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="radio"
            name="splitMode"
            value="count"
            checked={mode === 'count'}
            onChange={() => onModeChange('count')}
            className="w-4 h-4 text-blue-600"
          />
          <span className="flex items-center space-x-2">
            <span>分割数指定</span>
            <input
              type="number"
              min="2"
              max="100"
              value={splitCount}
              onChange={(e) => onSplitCountChange(Number(e.target.value))}
              disabled={mode !== 'count'}
              className="w-20 px-2 py-1 border rounded text-sm"
            />
            <span>個</span>
          </span>
        </label>
      </div>
    </div>
  );
};