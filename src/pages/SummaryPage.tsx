import { SummaryHistory } from '../components/SummaryHistory';

export function SummaryPage() {

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              保存された要約
            </h2>
            <SummaryHistory />
          </div>
        </div>
      </div>
    </div>
  );
}