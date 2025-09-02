import { SummaryHistory } from '../components/SummaryHistory';

export function SummaryPage() {

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <SummaryHistory />
      </div>
    </div>
  );
}