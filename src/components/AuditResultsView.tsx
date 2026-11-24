import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Info,
  XCircle,
} from 'lucide-react';
import type {
  AuditFinding,
  AuditReport,
  AuditSeverity,
  WcagPrinciple,
} from '../shared/wcag.ts';

interface AuditResultsViewProps {
  report: AuditReport;
}

const SEVERITY_STYLES: Record<AuditSeverity, { text: string; icon: typeof XCircle }> = {
  Critical: { text: 'text-red-700', icon: XCircle },
  Serious: { text: 'text-red-600', icon: AlertCircle },
  Moderate: { text: 'text-amber-700', icon: AlertTriangle },
  Minor: { text: 'text-slate-600', icon: Info },
};

export function AuditResultsView({ report }: AuditResultsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'findings' | 'passed' | 'structure'>('findings');
  const [principleFilter, setPrincipleFilter] = useState<'All' | WcagPrinciple>('All');
  const [severityFilter, setSeverityFilter] = useState<'All' | AuditSeverity>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const first = report.findings[0]?.id;
    return first ? new Set([first]) : new Set();
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copySnippet = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked in restricted contexts
    }
  };

  const filteredFindings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return report.findings.filter((f) => {
      if (principleFilter !== 'All' && f.principle !== principleFilter) return false;
      if (severityFilter !== 'All' && f.severity !== severityFilter) return false;
      if (
        q &&
        !f.title.toLowerCase().includes(q) &&
        !f.criterionCode.includes(q) &&
        !f.criterionName.toLowerCase().includes(q) &&
        !f.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [report.findings, principleFilter, severityFilter, searchQuery]);

  const totalSeverityIssues =
    report.severityCounts.Critical +
    report.severityCounts.Serious +
    report.severityCounts.Moderate +
    report.severityCounts.Minor;

  return (
    <div className="space-y-6">
      {/* Executive Conformance Summary Strip */}
      <section aria-label="Audit metrics summary" className="bg-white border border-slate-200 rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {report.documentProfile.title}
            </h2>
            <p className="text-xs text-slate-500 font-mono truncate mt-0.5">
              {report.target} · Evaluated {new Date(report.auditedAt).toLocaleTimeString()} ·{' '}
              {report.documentProfile.fetchDurationMs}ms
            </p>
          </div>
          <div className="text-xs font-medium text-slate-600 whitespace-nowrap shrink-0">
            Target: WCAG 2.2 Level {report.targetLevel}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          <div className="p-6">
            <div className="text-xs font-medium text-slate-500">Automated Conformance</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold font-mono tabular-nums text-slate-900">
                {report.conformanceRate}%
              </span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {report.passedCriteriaCount}/{report.totalChecksRun} criteria
              </span>
            </div>
          </div>

          <div className="p-6">
            <div className="text-xs font-medium text-slate-500">Detected Issues</div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-3xl font-semibold font-mono tabular-nums text-slate-900">
                {totalSeverityIssues}
              </span>
              <span className="text-xs text-slate-600 tabular-nums">
                {report.severityCounts.Critical} critical · {report.severityCounts.Serious} serious
              </span>
            </div>
          </div>

          <div className="p-6">
            <div className="text-xs font-medium text-slate-500">DOM Footprint</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold font-mono tabular-nums text-slate-900">
                {report.documentProfile.totalElements.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">
                nodes · {(report.documentProfile.htmlBytes / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>

          <div className="p-6">
            <div className="text-xs font-medium text-slate-500">Interactive Controls</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold font-mono tabular-nums text-slate-900">
                {report.documentProfile.linksCount +
                  report.documentProfile.buttonsCount +
                  report.documentProfile.inputsCount}
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                {report.documentProfile.linksCount} links · {report.documentProfile.inputsCount} inputs
              </span>
            </div>
          </div>
        </div>

        {/* POUR Principle Progress Bars */}
        <div className="px-6 py-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 bg-slate-50/60">
          {report.principleBreakdown.map((item) => {
            const total = item.passed + item.failed + item.needsReview;
            const pct = total > 0 ? Math.round((item.passed / total) * 100) : 100;
            return (
              <div key={item.principle}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-800">{item.principle}</span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {item.passed}/{total} passed
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.failed > 0 ? 'bg-blue-600' : 'bg-emerald-600'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setActiveSubTab('findings')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              activeSubTab === 'findings'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Findings ({report.findings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('passed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              activeSubTab === 'passed'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Passed Criteria ({report.passedCriteria.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('structure')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeSubTab === 'structure'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            DOM &amp; Landmarks
          </button>
        </div>

        {activeSubTab === 'findings' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by POUR principle"
              value={principleFilter}
              onChange={(e) => setPrincipleFilter(e.target.value as 'All' | WcagPrinciple)}
              className="h-9 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700"
            >
              <option value="All">All Principles</option>
              <option value="Perceivable">Perceivable</option>
              <option value="Operable">Operable</option>
              <option value="Understandable">Understandable</option>
              <option value="Robust">Robust</option>
            </select>

            <select
              aria-label="Filter by severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as 'All' | AuditSeverity)}
              className="h-9 px-2.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700"
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="Serious">Serious</option>
              <option value="Moderate">Moderate</option>
              <option value="Minor">Minor</option>
            </select>

            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search findings..."
              aria-label="Search findings"
              className="h-9 w-48 px-3 text-xs bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      {/* Findings List */}
      {activeSubTab === 'findings' && (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
          {filteredFindings.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-slate-900">
                {report.findings.length === 0
                  ? `No automated WCAG 2.2 Level ${report.targetLevel} violations detected`
                  : 'No findings match the active filters'}
              </h3>
              <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
                {report.findings.length === 0
                  ? 'All evaluated DOM, contrast, semantic landmark, and WCAG 2.2 rules passed automated inspection. Perform manual keyboard and screen-reader testing to confirm full conformance.'
                  : 'Clear or adjust your principle, severity, or search filters to view all detected issues.'}
              </p>
            </div>
          ) : (
            filteredFindings.map((finding: AuditFinding) => {
              const isOpen = expandedIds.has(finding.id);
              const sev = SEVERITY_STYLES[finding.severity];
              const SevIcon = sev.icon;

              return (
                <article key={finding.id} className="transition-colors">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleExpand(finding.id)}
                    className="w-full text-left px-6 py-4 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className={`inline-flex items-center gap-1 font-semibold ${sev.text}`}>
                          <SevIcon className="w-3.5 h-3.5" aria-hidden="true" />
                          {finding.severity}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-slate-700">
                          WCAG {finding.criterionCode} {finding.criterionName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Level {finding.level}</span>
                        <span aria-hidden="true">·</span>
                        <span>{finding.principle}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {finding.instances.length}{' '}
                          {finding.instances.length === 1 ? 'instance' : 'instances'}
                        </span>
                        {finding.status === 'Needs Review' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-amber-700">Needs Manual Review</span>
                          </>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-slate-900">{finding.title}</h3>
                      <p className="text-sm text-slate-600">{finding.description}</p>
                    </div>

                    <span className="mt-1 text-slate-400 shrink-0" aria-hidden="true">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                          <div className="text-xs font-semibold text-slate-700 mb-1">User Impact</div>
                          <p className="text-slate-600 leading-relaxed">{finding.impact}</p>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-700 mb-1">
                            Recommended Remediation
                          </div>
                          <p className="text-slate-600 leading-relaxed">{finding.remediation}</p>
                        </div>
                      </div>

                      {/* Code Remediation Comparison */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
                          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 text-xs font-medium text-red-700">
                            Non-compliant pattern
                          </div>
                          <pre className="p-3 text-xs font-mono text-slate-800 overflow-x-auto leading-relaxed">
                            <code>{finding.codeBefore}</code>
                          </pre>
                        </div>

                        <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
                          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <span className="text-xs font-medium text-emerald-700">
                              Accessible WCAG 2.2 fix
                            </span>
                            <button
                              type="button"
                              onClick={() => copySnippet(finding.id, finding.codeAfter)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
                            >
                              {copiedId === finding.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                                  Copy fix
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="p-3 text-xs font-mono text-slate-800 overflow-x-auto leading-relaxed">
                            <code>{finding.codeAfter}</code>
                          </pre>
                        </div>
                      </div>

                      {/* Affected DOM Nodes */}
                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          Affected DOM Elements ({finding.instances.length})
                        </div>
                        <div className="border border-slate-200 rounded-md bg-white divide-y divide-slate-200">
                          {finding.instances.map((inst, idx) => (
                            <div key={`${finding.id}-inst-${idx}`} className="p-3 space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <code className="font-mono font-medium text-blue-700">
                                  {inst.selector}
                                </code>
                                <span className="text-slate-600">{inst.detail}</span>
                              </div>
                              <pre className="text-xs font-mono text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded overflow-x-auto">
                                <code>{inst.snippet}</code>
                              </pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Passed Criteria Table */}
      {activeSubTab === 'passed' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th scope="col" className="py-3 px-4 w-24">Criterion</th>
                <th scope="col" className="py-3 px-4">Title &amp; Scope</th>
                <th scope="col" className="py-3 px-4 w-32">Principle</th>
                <th scope="col" className="py-3 px-4 w-24">Level</th>
                <th scope="col" className="py-3 px-4 w-28 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {report.passedCriteria.map((c) => (
                <tr key={c.code} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono tabular-nums font-medium text-slate-900">
                    {c.code}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{c.summary}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">{c.principle}</td>
                  <td className="py-3 px-4 text-xs font-mono text-slate-700">Level {c.level}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Passed
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DOM & Heading Structure */}
      {activeSubTab === 'structure' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Heading Outline Hierarchy</h3>
            {report.documentProfile.headingsOutline.length === 0 ? (
              <p className="text-sm text-slate-500">No heading elements (&lt;h1&gt;–&lt;h6&gt;) detected.</p>
            ) : (
              <ul className="space-y-2">
                {report.documentProfile.headingsOutline.map((h, i) => (
                  <li
                    key={`${h.level}-${i}`}
                    className="flex items-baseline gap-3 text-sm border-b border-slate-100 pb-1.5"
                    style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
                  >
                    <span className="font-mono text-xs font-semibold text-blue-700 shrink-0">
                      H{h.level}
                    </span>
                    <span className="text-slate-800 truncate">{h.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Document Landmarks &amp; Metadata</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Programmatic regions detected for assistive navigation.
              </p>
            </div>

            <dl className="divide-y divide-slate-200 text-sm">
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Document Language</dt>
                <dd className="font-mono text-slate-900">
                  {report.documentProfile.lang ?? 'Missing'}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Detected Landmarks</dt>
                <dd className="font-mono text-slate-900 text-right">
                  {report.documentProfile.landmarks.length > 0
                    ? report.documentProfile.landmarks.join(', ')
                    : 'None detected'}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Images</dt>
                <dd className="font-mono tabular-nums text-slate-900">
                  {report.documentProfile.imagesCount}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Forms / Inputs</dt>
                <dd className="font-mono tabular-nums text-slate-900">
                  {report.documentProfile.formsCount} forms · {report.documentProfile.inputsCount} fields
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Stylesheets &amp; Inline Blocks</dt>
                <dd className="font-mono tabular-nums text-slate-900">
                  {report.documentProfile.stylesheetsCount}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
