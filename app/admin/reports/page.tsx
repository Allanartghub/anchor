'use client';

import AdminNav from '@/components/AdminNav';

export default function AdminReportsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav current="reports" />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Reports & Exports</h1>
          <p className="text-slate-600 mt-2">
            Aggregated exports only. Access restricted to Data Officer role.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Monthly Aggregate Export</h2>
            <p className="text-sm text-slate-600 mb-4">
              Export cohort-level metrics for institutional reporting.
            </p>
            <button
              disabled
              className="px-4 py-2 rounded bg-slate-200 text-slate-500 cursor-not-allowed"
            >
              Export (Restricted)
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">SLA Compliance Report</h2>
            <p className="text-sm text-slate-600 mb-4">
              Summary of response timing and service-level adherence.
            </p>
            <button
              disabled
              className="px-4 py-2 rounded bg-slate-200 text-slate-500 cursor-not-allowed"
            >
              Generate (Restricted)
            </button>
          </div>
        </div>

        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Exports are disabled in this view. Contact a Data Officer for access.
        </div>
      </div>
    </div>
  );
}
