import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ClipboardCheck,
  Code2,
  Download,
  FileText,
  Globe,
  History,
  Layers,
  Menu,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import { AuditHistoryView } from './components/AuditHistoryView.tsx';
import { AuditResultsView } from './components/AuditResultsView.tsx';
import { ContrastTargetLab } from './components/ContrastTargetLab.tsx';
import { WcagMatrixView } from './components/WcagMatrixView.tsx';
import {
  downloadAuditJson,
  downloadAuditMarkdown,
  SAMPLE_HTML_FIXTURES,
} from './data/sampleFixtures.ts';
import type { AuditReport, WcagLevel } from './shared/wcag.ts';

type WorkspaceSection = 'workbench' | 'matrix' | 'contrast' | 'history';

const STORAGE_KEY = 'veritas_a11y_history_v1';

export default function App() {
  const [section, setSection] = useState<WorkspaceSection>('workbench');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [inputMode, setInputMode] = useState<'url' | 'html'>('url');
  const [targetUrl, setTargetUrl] = useState('https://example.com');
  const [rawHtml, setRawHtml] = useState(SAMPLE_HTML_FIXTURES[0].html);
  const [targetLevel, setTargetLevel] = useState<WcagLevel>('AA');

  const [isAuditing, setIsAuditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<AuditReport | null>(null);

  const [history, setHistory] = useState<AuditReport[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as AuditReport[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 25)));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  const executeAudit = async (override?: {
    mode: 'url' | 'html';
    url?: string;
    html?: string;
    level?: WcagLevel;
  }) => {
    const mode = override?.mode ?? inputMode;
    const level = override?.level ?? targetLevel;
    const urlToAudit = override?.url ?? targetUrl;
    const htmlToAudit = override?.html ?? rawHtml;

    setIsAuditing(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          url: urlToAudit,
          html: htmlToAudit,
          level,
        }),
      });

      const payload = (await res.json()) as AuditReport & { error?: string };
      if (!res.ok) {
        setErrorMessage(payload.error ?? 'Failed to evaluate the requested target.');
        setIsAuditing(false);
        return;
      }

      setActiveReport(payload);
      setHistory((prev) => [payload, ...prev.filter((item) => item.id !== payload.id)].slice(0, 25));
      setSection('workbench');
    } catch {
      setErrorMessage('Network error communicating with the audit service. Please retry.');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void executeAudit();
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setInputMode('html');
    setRawHtml(content);
    void executeAudit({ mode: 'html', html: content });
  };

  const loadSampleFixture = (fixtureId: string) => {
    const found = SAMPLE_HTML_FIXTURES.find((f) => f.id === fixtureId);
    if (!found) return;
    setInputMode('html');
    setRawHtml(found.html);
    void executeAudit({ mode: 'html', html: found.html });
  };

  const navItems: { id: WorkspaceSection; label: string; icon: typeof ClipboardCheck }[] = [
    { id: 'workbench', label: 'Audit Workbench', icon: ClipboardCheck },
    { id: 'matrix', label: 'WCAG 2.2 Matrix', icon: Layers },
    { id: 'contrast', label: 'Contrast & Targets', icon: SlidersHorizontal },
    { id: 'history', label: 'Audit History', icon: History },
  ];

  const sectionLabel = navItems.find((n) => n.id === section)?.label ?? 'Audit Workbench';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setSection('workbench');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            Veritas A11y
          </a>
        </div>

        <nav aria-label="Workspace Navigation" className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <div className="font-medium text-slate-700">Standard Reference</div>
          <div>W3C WCAG 2.2 · Levels A, AA, AAA</div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-50 w-64 max-w-full bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold font-display text-slate-900">Veritas A11y</span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile Navigation" className="p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="h-14 lg:h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">Evaluation</span>
              <span className="text-slate-400 hidden sm:inline" aria-hidden="true">/</span>
              <span className="font-medium text-slate-900 truncate">{sectionLabel}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeReport && (
              <>
                <button
                  type="button"
                  onClick={() => downloadAuditMarkdown(activeReport)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  Export Markdown
                </button>
                <button
                  type="button"
                  onClick={() => downloadAuditJson(activeReport)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Export JSON
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main id="main-content" className="flex-1 px-4 sm:px-8 py-8 max-w-7xl w-full mx-auto">
          {section === 'workbench' && (
            <div className="space-y-8">
              <div className="border-b border-slate-200 pb-5">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 text-balance">
                  Automated WCAG 2.2 Accessibility Evaluation
                </h1>
                <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
                  Audit live web pages or raw HTML markup for Perceivable, Operable, Understandable, and Robust compliance violations—including WCAG 2.2 target size, accessible authentication, dragging alternatives, and focus visibility rules.
                </p>
              </div>

              {/* Scanner Form Panel */}
              <section
                aria-label="Audit target configuration"
                className="bg-white border border-slate-200 rounded-lg p-6 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                    <button
                      type="button"
                      onClick={() => setInputMode('url')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        inputMode === 'url'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                      Live Page URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('html')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        inputMode === 'html'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                      HTML Source
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                      Conformance Level:
                    </span>
                    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      {(['A', 'AA', 'AAA'] as WcagLevel[]).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setTargetLevel(lvl)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                            targetLevel === lvl
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Level {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {inputMode === 'url' ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <label htmlFor="audit-url-input" className="sr-only">
                          Web page URL to evaluate
                        </label>
                        <input
                          id="audit-url-input"
                          type="text"
                          value={targetUrl}
                          onChange={(e) => setTargetUrl(e.target.value)}
                          placeholder="https://example.com"
                          className="w-full h-11 px-3.5 text-sm bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isAuditing}
                        className="h-11 px-5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        {isAuditing ? 'Auditing Page...' : 'Run Audit'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label
                          htmlFor="audit-html-input"
                          className="text-xs font-medium text-slate-700"
                        >
                          Paste rendered HTML document or snippet
                        </label>
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Upload .html file</span>
                          <input
                            type="file"
                            accept=".html,.htm,text/html"
                            onChange={handleFileUpload}
                            className="sr-only"
                          />
                        </label>
                      </div>
                      <textarea
                        id="audit-html-input"
                        rows={8}
                        value={rawHtml}
                        onChange={(e) => setRawHtml(e.target.value)}
                        className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md text-slate-900 leading-relaxed"
                        placeholder="<!doctype html><html lang='en'>..."
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isAuditing}
                          className="h-10 px-5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0"
                        >
                          {isAuditing ? 'Auditing HTML...' : 'Audit HTML Source'}
                        </button>
                      </div>
                    </div>
                  )}
                </form>

                {/* Benchmark Presets */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">Quick Benchmarks:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('url');
                      setTargetUrl('https://example.com');
                      void executeAudit({ mode: 'url', url: 'https://example.com' });
                    }}
                    className="px-2.5 py-1 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors whitespace-nowrap"
                  >
                    example.com (Live URL)
                  </button>
                  {SAMPLE_HTML_FIXTURES.map((fixture) => (
                    <button
                      key={fixture.id}
                      type="button"
                      onClick={() => loadSampleFixture(fixture.id)}
                      className="px-2.5 py-1 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors whitespace-nowrap"
                    >
                      {fixture.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Error Alert */}
              {errorMessage && (
                <div
                  role="alert"
                  className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="font-semibold">Audit could not complete</div>
                    <p className="mt-0.5 text-red-700">{errorMessage}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss error"
                    onClick={() => setErrorMessage(null)}
                    className="p-1 text-red-600 hover:text-red-900"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* Loading Skeleton */}
              {isAuditing && (
                <div aria-live="polite" className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 animate-pulse">
                    <div className="h-5 w-64 bg-slate-200 rounded" />
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="h-16 bg-slate-100 rounded" />
                      <div className="h-16 bg-slate-100 rounded" />
                      <div className="h-16 bg-slate-100 rounded" />
                      <div className="h-16 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3 animate-pulse">
                    <div className="h-4 w-48 bg-slate-200 rounded" />
                    <div className="h-12 bg-slate-100 rounded" />
                    <div className="h-12 bg-slate-100 rounded" />
                  </div>
                </div>
              )}

              {/* Empty Initial State or Active Audit Report */}
              {!isAuditing && activeReport && <AuditResultsView report={activeReport} />}

              {!isAuditing && !activeReport && (
                <section className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-3">
                  <h2 className="text-base font-semibold text-slate-900">
                    Ready to inspect a web page for WCAG 2.2 compliance
                  </h2>
                  <p className="text-sm text-slate-600 max-w-xl mx-auto">
                    Enter any public URL above, upload an HTML file, or launch one of the quick benchmark fixtures to generate an actionable POUR conformance breakdown with DOM selectors and code fixes.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => loadSampleFixture('checkout-regressions')}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap"
                    >
                      Run Sample Checkout Audit
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}

          {section === 'matrix' && <WcagMatrixView report={activeReport} />}
          {section === 'contrast' && <ContrastTargetLab />}
          {section === 'history' && (
            <AuditHistoryView
              history={history}
              onSelectReport={(rep) => {
                setActiveReport(rep);
                setSection('workbench');
              }}
              onDeleteReport={(id) => {
                setHistory((prev) => prev.filter((r) => r.id !== id));
              }}
              onClearAll={() => setHistory([])}
              onStartNew={() => setSection('workbench')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
