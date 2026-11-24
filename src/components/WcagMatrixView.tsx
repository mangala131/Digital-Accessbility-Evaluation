import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Minus } from 'lucide-react';
import {
  type AuditReport,
  WCAG_22_CATALOG,
  type WcagPrinciple,
} from '../shared/wcag.ts';

interface WcagMatrixViewProps {
  report: AuditReport | null;
}

const PRINCIPLES: ('All' | WcagPrinciple)[] = [
  'All',
  'Perceivable',
  'Operable',
  'Understandable',
  'Robust',
];

export function WcagMatrixView({ report }: WcagMatrixViewProps) {
  const [principleFilter, setPrincipleFilter] = useState<'All' | WcagPrinciple>('All');
  const [onlyNew22, setOnlyNew22] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const statusMap = useMemo(() => {
    const map = new Map<string, 'Passed' | 'Failed' | 'Needs Review'>();
    if (!report) return map;
    for (const p of report.passedCriteria) map.set(p.code, 'Passed');
    for (const f of report.findings) {
      if (f.status === 'Failed') {
        map.set(f.criterionCode, 'Failed');
      } else if (!map.has(f.criterionCode)) {
        map.set(f.criterionCode, 'Needs Review');
      }
    }
    return map;
  }, [report]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return WCAG_22_CATALOG.filter((c) => {
      if (principleFilter !== 'All' && c.principle !== principleFilter) return false;
      if (onlyNew22 && c.version !== '2.2') return false;
      if (
        q &&
        !c.code.includes(q) &&
        !c.name.toLowerCase().includes(q) &&
        !c.summary.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [principleFilter, onlyNew22, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            WCAG 2.2 Criteria Coverage Matrix
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            {report
              ? `Live status mapped from ${report.target} (Level ${report.targetLevel}).`
              : 'Run an audit in the Workbench to populate criterion pass/fail statuses.'}
          </p>
        </div>

        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyNew22}
            onChange={(e) => setOnlyNew22(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          <span>Show only new WCAG 2.2 criteria</span>
        </label>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {PRINCIPLES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrincipleFilter(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                principleFilter === p
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter criteria code or title..."
          aria-label="Filter WCAG criteria"
          className="w-full md:w-72 h-9 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400"
        />
      </div>

      {/* Data Grid */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th scope="col" className="py-3 px-4 w-24">Code</th>
                <th scope="col" className="py-3 px-4">Success Criterion</th>
                <th scope="col" className="py-3 px-4 w-32">Principle</th>
                <th scope="col" className="py-3 px-4 w-24">Level</th>
                <th scope="col" className="py-3 px-4 w-24">Version</th>
                <th scope="col" className="py-3 px-4 w-36 text-right">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filtered.map((criterion) => {
                const status = statusMap.get(criterion.code);
                return (
                  <tr key={criterion.code} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono tabular-nums font-medium text-slate-900 align-top">
                      {criterion.code}
                    </td>
                    <td className="py-3.5 px-4 align-top">
                      <div className="font-medium text-slate-900">{criterion.name}</div>
                      <p className="text-xs text-slate-600 mt-0.5 max-w-xl leading-relaxed">
                        {criterion.summary}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 align-top whitespace-nowrap">
                      {criterion.principle}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-700 align-top whitespace-nowrap">
                      Level {criterion.level}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-600 align-top whitespace-nowrap">
                      WCAG {criterion.version}
                    </td>
                    <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                      {status === 'Failed' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          Failed
                        </span>
                      )}
                      {status === 'Needs Review' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                          Review
                        </span>
                      )}
                      {status === 'Passed' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Passed
                        </span>
                      )}
                      {!status && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                          <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                          Not run
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
