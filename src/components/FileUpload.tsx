import React, { useCallback, useState } from 'react';
import { Upload, FileAudio, Music } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(file => 
      file.type.startsWith('audio/') || 
      file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)
    );

    if (audioFile) {
      onFileSelect(audioFile);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300",
        isDragging 
          ? "border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 scale-[1.02]" 
          : "border-gray-300 hover:border-gray-400 bg-gradient-to-br from-gray-50 to-gray-100",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
        onChange={handleFileInput}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="flex justify-center mb-4">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full blur-xl opacity-30 animate-pulse"></div>
          <div className="relative p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
            <Upload className="h-8 w-8 text-white" />
          </div>
        </div>
      </div>
      <p className="text-lg font-semibold text-gray-800">
        音声ファイルをドロップ
      </p>
      <p className="text-sm text-gray-600 mt-2">
        または <span className="text-blue-600 font-medium">クリックして選択</span>
      </p>
      <div className="flex items-center justify-center space-x-6 mt-6">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <FileAudio className="w-4 h-4" />
          <span>MP3 / WAV</span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Music className="w-4 h-4" />
          <span>M4A / OGG / WebM</span>
        </div>
      </div>
    </div>
  );
};