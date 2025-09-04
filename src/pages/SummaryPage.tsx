import { SummaryHistory } from '../components/SummaryHistory';

export function SummaryPage() {

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Content */}
      <div className="w-full px-4 lg:px-6 xl:px-8 py-8">
        <SummaryHistory />
      </div>
    </div>
  );
}