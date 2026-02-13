'use client';

import AdminNav from '@/components/AdminNav';

export default function AdminGovernancePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav current="governance" />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Governance & Audit</h1>
          <p className="text-slate-600 mt-2">
            Audit, retention, and access logs. Restricted to Data Officer or System Admin.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Admin Audit Logs</h2>
            <p className="text-sm text-slate-600">
              Immutable record of access to support cases and exports.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Retention Health</h2>
            <p className="text-sm text-slate-600">
              Monitoring of TTL jobs and expiration queue status.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Consent & Access Logs</h2>
            <p className="text-sm text-slate-600">
              Track consent scope and break-glass access events.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Break-Glass Access</h2>
            <p className="text-sm text-slate-600">
              Emergency access requests are recorded and reviewed here.
            </p>
          </div>
        </div>

        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Governance panels require elevated permissions.
        </div>
      </div>
    </div>
  );
}
