import { useMemo, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, XCircle } from 'lucide-react';
import { contrastRatio, parseColorString } from '../shared/wcag.ts';

const PRESET_PAIRS = [
  { label: 'Slate Ink on White', fg: '#0f172a', bg: '#ffffff' },
  { label: 'Cobalt Action on White', fg: '#2563eb', bg: '#ffffff' },
  { label: 'Muted Slate Fail', fg: '#94a3b8', bg: '#ffffff' },
  { label: 'White on Emerald', fg: '#ffffff', bg: '#15803d' },
];

export function ContrastTargetLab() {
  const [fgHex, setFgHex] = useState('#1e293b');
  const [bgHex, setBgHex] = useState('#ffffff');
  const [sampleSize, setSampleSize] = useState<'normal' | 'large'>('normal');

  const [targetWidth, setTargetWidth] = useState(24);
  const [targetHeight, setTargetHeight] = useState(24);

  const ratio = useMemo(() => {
    const fg = parseColorString(fgHex);
    const bg = parseColorString(bgHex);
    if (!fg || !bg) return null;
    return contrastRatio(fg, bg);
  }, [fgHex, bgHex]);

  const aaPass = ratio !== null && (sampleSize === 'large' ? ratio >= 3.0 : ratio >= 4.5);
  const aaaPass = ratio !== null && (sampleSize === 'large' ? ratio >= 4.5 : ratio >= 7.0);
  const uiComponentPass = ratio !== null && ratio >= 3.0;

  const targetMeets22AA = targetWidth >= 24 && targetHeight >= 24;
  const targetMeets22AAA = targetWidth >= 44 && targetHeight >= 44;

  const swapColors = () => {
    setFgHex(bgHex);
    setBgHex(fgHex);
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Contrast &amp; Target Size Lab
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
          Verify foreground-to-background luminance ratios under WCAG 1.4.3 / 1.4.6 and validate pointer dimensions against WCAG 2.2 Success Criterion 2.5.8.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contrast Ratio Evaluator */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Color Contrast Calculator
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                WCAG 1.4.3 Contrast (Minimum) · 1.4.6 Contrast (Enhanced) · 1.4.11 Non-text
              </p>
            </div>
            <button
              type="button"
              onClick={swapColors}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
              Swap colors
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fg-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                Foreground color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick foreground color"
                  value={/^#[0-9a-f]{6}$/i.test(fgHex) ? fgHex : '#000000'}
                  onChange={(e) => setFgHex(e.target.value)}
                  className="h-10 w-11 rounded border border-slate-300 bg-white cursor-pointer p-0.5 shrink-0"
                />
                <input
                  id="fg-input"
                  type="text"
                  value={fgHex}
                  onChange={(e) => setFgHex(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono border border-slate-300 rounded-md text-slate-900 bg-white"
                  placeholder="#1e293b"
                />
              </div>
            </div>

            <div>
              <label htmlFor="bg-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                Background color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick background color"
                  value={/^#[0-9a-f]{6}$/i.test(bgHex) ? bgHex : '#ffffff'}
                  onChange={(e) => setBgHex(e.target.value)}
                  className="h-10 w-11 rounded border border-slate-300 bg-white cursor-pointer p-0.5 shrink-0"
                />
                <input
                  id="bg-input"
                  type="text"
                  value={bgHex}
                  onChange={(e) => setBgHex(e.target.value)}
                  className="w-full h-10 px-3 text-sm font-mono border border-slate-300 rounded-md text-slate-900 bg-white"
                  placeholder="#ffffff"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PRESET_PAIRS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setFgHex(preset.fg);
                  setBgHex(preset.bg);
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Live Preview */}
          <div
            className="rounded-lg border border-slate-200 p-5 transition-colors"
            style={{ backgroundColor: bgHex, color: fgHex }}
          >
            <div className="flex items-center justify-between gap-4 mb-3">
              <span className="text-xs font-mono opacity-80">Live Contrast Preview</span>
              <div className="inline-flex items-center gap-1 p-0.5 bg-black/10 rounded-md">
                <button
                  type="button"
                  onClick={() => setSampleSize('normal')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    sampleSize === 'normal' ? 'bg-white text-slate-900 shadow-sm' : 'text-current opacity-80'
                  }`}
                >
                  Normal (16px)
                </button>
                <button
                  type="button"
                  onClick={() => setSampleSize('large')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    sampleSize === 'large' ? 'bg-white text-slate-900 shadow-sm' : 'text-current opacity-80'
                  }`}
                >
                  Large (24px)
                </button>
              </div>
            </div>
            <p className={sampleSize === 'large' ? 'text-2xl font-semibold' : 'text-base'}>
              Accessible interfaces ensure every user can read labels, states, and primary controls clearly.
            </p>
          </div>

          {/* Contrast Readout */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
            <div>
              <div className="text-xs text-slate-500">Contrast Ratio</div>
              <div className="mt-1 text-xl font-semibold font-mono tabular-nums text-slate-900">
                {ratio !== null ? `${ratio.toFixed(2)}:1` : 'Invalid'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">WCAG AA Text</div>
              <div className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium ${aaPass ? 'text-emerald-700' : 'text-red-700'}`}>
                {aaPass ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
                <span>{aaPass ? 'Pass' : 'Fail'}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">WCAG AAA Text</div>
              <div className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium ${aaaPass ? 'text-emerald-700' : 'text-red-700'}`}>
                {aaaPass ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
                <span>{aaaPass ? 'Pass' : 'Fail'}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">UI / Focus (3:1)</div>
              <div className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium ${uiComponentPass ? 'text-emerald-700' : 'text-red-700'}`}>
                {uiComponentPass ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
                <span>{uiComponentPass ? 'Pass' : 'Fail'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* WCAG 2.2 Target Size (Minimum) Lab */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Pointer Target Size Verifier
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              WCAG 2.2 SC 2.5.8 Target Size (Minimum: 24×24 CSS px) · SC 2.5.5 (Enhanced: 44×44 CSS px)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label htmlFor="target-w" className="font-medium text-slate-700">Width (CSS px)</label>
                <span className="font-mono tabular-nums text-slate-900">{targetWidth}px</span>
              </div>
              <input
                id="target-w"
                type="range"
                min={12}
                max={64}
                value={targetWidth}
                onChange={(e) => setTargetWidth(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label htmlFor="target-h" className="font-medium text-slate-700">Height (CSS px)</label>
                <span className="font-mono tabular-nums text-slate-900">{targetHeight}px</span>
              </div>
              <input
                id="target-h"
                type="range"
                min={12}
                max={64}
                value={targetHeight}
                onChange={(e) => setTargetHeight(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: '16×16 (Legacy Icon)', w: 16, h: 16 },
              { label: '24×24 (WCAG 2.2 AA)', w: 24, h: 24 },
              { label: '40×40 (Desktop Button)', w: 40, h: 40 },
              { label: '44×44 (WCAG AAA Touch)', w: 44, h: 44 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setTargetWidth(preset.w);
                  setTargetHeight(preset.h);
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="h-44 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center relative">
            <div
              className="relative flex items-center justify-center border border-blue-600 bg-blue-600 text-white text-xs font-mono rounded transition-all"
              style={{ width: `${targetWidth}px`, height: `${targetHeight}px` }}
            >
              {targetWidth >= 32 && targetHeight >= 24 ? `${targetWidth}×${targetHeight}` : '+'}
            </div>
            <span className="absolute bottom-2.5 right-3 text-xs font-mono tabular-nums text-slate-500">
              Rendered box: {targetWidth}px × {targetHeight}px
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <div className="text-xs text-slate-500">WCAG 2.2 AA (≥ 24×24px)</div>
              <div className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium ${targetMeets22AA ? 'text-emerald-700' : 'text-red-700'}`}>
                {targetMeets22AA ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
                <span>{targetMeets22AA ? 'Compliant' : 'Too small'}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">WCAG 2.2 AAA (≥ 44×44px)</div>
              <div className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium ${targetMeets22AAA ? 'text-emerald-700' : 'text-amber-700'}`}>
                {targetMeets22AAA ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
                <span>{targetMeets22AAA ? 'Compliant' : 'Below AAA touch'}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
