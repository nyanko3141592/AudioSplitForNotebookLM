import React from 'react';
import { 
  FileAudio, 
  Mic,
  Upload,
  Shield, 
  Zap, 
  Globe 
} from 'lucide-react';

type Props = {
  currentPage: 'transcribe' | 'split';
  onPageChange: (page: 'transcribe' | 'split') => void;
  isRecordingActive?: boolean;
};

export const HeroSection: React.FC<Props> = ({ currentPage, onPageChange, isRecordingActive = false }) => {
  return (
    <div className="bg-gradient-to-r from-violet-600 to-purple-600 py-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center text-white">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            爆速議事録
          </h1>
          <p className="text-lg text-white/90">
            録音から文字起こし・要約まで3ステップで完了
          </p>
        </div>

      </div>
    </div>
  );
};