import { SummaryHistory } from '../components/SummaryHistory';

export function SummaryPage() {

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top spacer for fixed header */}
      <div className="h-16 flex-shrink-0"></div>
      {/* Content - Full height */}
      <div className="flex-1 overflow-hidden">
        <SummaryHistory />
      </div>
    </div>
  );
}