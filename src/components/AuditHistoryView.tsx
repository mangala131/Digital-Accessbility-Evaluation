import { Trash2, ExternalLink } from 'lucide-react';
import type { AuditReport } from '../shared/wcag.ts';

interface AuditHistoryViewProps {
  history: AuditReport[];
  onSelectReport: (report: AuditReport) => void;
  onDeleteReport: (id: string) => void;
  onClearAll: () => void;
  onStartNew: () => void;
}

export function AuditHistoryView({
  history,
  onSelectReport,
  onDeleteReport,
  onClearAll,
  onStartNew,
}: AuditHistoryViewProps) {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Audit History
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Saved WCAG 2.2 evaluation snapshots stored locally in your browser session.
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Clear all history
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <h2 className="text-base font-semibold text-slate-900">No saved audits yet</h2>
          <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
            Evaluate a live web page URL or HTML document in the Audit Workbench to track conformance trends here.
          </p>
          <button
            type="button"
            onClick={onStartNew}
            className="mt-5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Run First Audit
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th scope="col" className="py-3 px-4">Target Document</th>
                  <th scope="col" className="py-3 px-4 w-24">Level</th>
                  <th scope="col" className="py-3 px-4 w-32 text-right">Conformance</th>
                  <th scope="col" className="py-3 px-4 w-28 text-right">Failures</th>
                  <th scope="col" className="py-3 px-4 w-44">Evaluated</th>
                  <th scope="col" className="py-3 px-4 w-36 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-medium text-slate-900 truncate">
                        {item.documentProfile.title}
                      </div>
                      <div className="text-xs font-mono text-slate-500 truncate mt-0.5">
                        {item.target}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-700 whitespace-nowrap">
                      2.2 {item.targetLevel}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {item.conformanceRate}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {item.findings.length}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                      {new Date(item.auditedAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectReport(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          Open
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete audit for ${item.documentProfile.title}`}
                          onClick={() => onDeleteReport(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-700 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
