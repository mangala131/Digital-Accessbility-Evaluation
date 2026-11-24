import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import {
  type AffectedInstance,
  type AuditFinding,
  type AuditReport,
  type AuditSeverity,
  type AuditStatus,
  contrastRatio,
  type DocumentProfile,
  parseColorString,
  type PrincipleSummary,
  WCAG_22_CATALOG,
  type WcagCriterionMeta,
  type WcagLevel,
  type WcagPrinciple,
} from '../src/shared/wcag.ts';

function buildSelector($: cheerio.CheerioAPI, el: Element): string {
  const tag = el.tagName?.toLowerCase() ?? 'node';
  const id = $(el).attr('id');
  if (id) return `${tag}#${id}`;
  const cls = $(el).attr('class')?.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (cls && cls.length > 0) return `${tag}.${cls.join('.')}`;
  const name = $(el).attr('name');
  if (name) return `${tag}[name="${name}"]`;
  const type = $(el).attr('type');
  if (type) return `${tag}[type="${type}"]`;
  return tag;
}

function getSnippet($: cheerio.CheerioAPI, el: Element): string {
  const raw = $.html(el).replace(/\s+/g, ' ').trim();
  return raw.length > 170 ? `${raw.slice(0, 167)}...` : raw;
}

function parseInlineStyle(styleAttr?: string): Record<string, string> {
  if (!styleAttr) return {};
  const map: Record<string, string> = {};
  for (const decl of styleAttr.split(';')) {
    const idx = decl.indexOf(':');
    if (idx > 0) {
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const val = decl.slice(idx + 1).trim();
      if (prop && val) map[prop] = val;
    }
  }
  return map;
}

function parseCssSizePx(raw?: string): number | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : null;
}

function getAccessibleName($: cheerio.CheerioAPI, el: Element): string {
  const $el = $(el);
  const ariaLabel = $el.attr('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = $el.attr('aria-labelledby')?.trim();
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .map((id) => $(`#${id}`).text().trim())
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  const title = $el.attr('title')?.trim();
  const text = $el.text().replace(/\s+/g, ' ').trim();
  if (text) return text;

  const imgAlt = $el.find('img[alt]').first().attr('alt')?.trim();
  if (imgAlt) return imgAlt;

  const svgTitle = $el.find('svg title').first().text().trim();
  if (svgTitle) return svgTitle;

  if (el.tagName === 'input') {
    const val = $el.attr('value')?.trim();
    if (val) return val;
  }

  return title ?? '';
}

function hasProgrammaticLabel($: cheerio.CheerioAPI, el: Element): boolean {
  const $el = $(el);
  if ($el.attr('aria-label')?.trim()) return true;
  if ($el.attr('aria-labelledby')?.trim()) return true;
  if ($el.attr('title')?.trim()) return true;
  if ($el.closest('label').length > 0) return true;
  const id = $el.attr('id')?.trim();
  if (id && $(`label[for="${id.replace(/"/g, '\\"')}"]`).length > 0) return true;
  return false;
}

interface FindingBuilderInput {
  criterionCode: string;
  severity: AuditSeverity;
  status?: AuditStatus;
  title: string;
  description: string;
  impact: string;
  remediation: string;
  codeBefore: string;
  codeAfter: string;
  instances: AffectedInstance[];
}

export function runWcag22Audit(params: {
  html: string;
  target: string;
  targetType: 'url' | 'html';
  targetLevel: WcagLevel;
  fetchDurationMs: number;
}): AuditReport {
  const { html, target, targetType, targetLevel, fetchDurationMs } = params;
  const $ = cheerio.load(html);

  const criteriaByCode = new Map<string, WcagCriterionMeta>(
    WCAG_22_CATALOG.map((c) => [c.code, c])
  );

  const findings: AuditFinding[] = [];
  const addFinding = (input: FindingBuilderInput) => {
    const meta = criteriaByCode.get(input.criterionCode);
    if (!meta) return;
    findings.push({
      id: `${meta.code}-${findings.length + 1}`,
      criterionCode: meta.code,
      criterionName: meta.name,
      level: meta.level,
      version: meta.version,
      principle: meta.principle,
      severity: input.severity,
      status: input.status ?? 'Failed',
      title: input.title,
      description: input.description,
      impact: input.impact,
      remediation: input.remediation,
      codeBefore: input.codeBefore,
      codeAfter: input.codeAfter,
      instances: input.instances.slice(0, 15),
    });
  };

  // Extract inline <style> CSS text for static heuristics
  const embeddedCss = $('style')
    .map((_, s) => $(s).html() ?? '')
    .get()
    .join('\n');

  // 1.1.1 Non-text Content — Images missing alt
  const missingAltImages: AffectedInstance[] = [];
  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    const role = $(el).attr('role');
    if (alt === undefined && role !== 'presentation' && role !== 'none') {
      missingAltImages.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: 'Missing alt attribute on <img> element.',
      });
    }
  });
  if (missingAltImages.length > 0) {
    addFinding({
      criterionCode: '1.1.1',
      severity: 'Critical',
      title: 'Images missing alternative text',
      description: `${missingAltImages.length} image element(s) lack an alt attribute or decorative role.`,
      impact: 'Screen reader users cannot perceive visual information or hear file names read aloud instead of meaningful descriptions.',
      remediation: 'Add a concise, descriptive alt attribute to informative images, or set alt="" for purely decorative graphics.',
      codeBefore: '<img src="/hero-chart.png">',
      codeAfter: '<img src="/hero-chart.png" alt="Quarterly accessibility pass rate rising from 64% to 94%">',
      instances: missingAltImages,
    });
  }

  // 1.1.1 Interactive SVGs / icon buttons missing accessible name
  const unlabeledSvgs: AffectedInstance[] = [];
  $('svg').each((_, el) => {
    const $svg = $(el);
    if ($svg.attr('aria-hidden') === 'true') return;
    const inButtonOrLink = $svg.closest('a, button').length > 0;
    const hasTitle = $svg.find('title').text().trim().length > 0;
    const hasLabel = Boolean($svg.attr('aria-label')?.trim() || $svg.attr('aria-labelledby')?.trim());
    if (!inButtonOrLink && !hasTitle && !hasLabel && $svg.attr('role') === 'img') {
      unlabeledSvgs.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: 'SVG with role="img" lacks <title> or aria-label.',
      });
    }
  });
  if (unlabeledSvgs.length > 0) {
    addFinding({
      criterionCode: '1.1.1',
      severity: 'Serious',
      title: 'Meaningful SVG graphics lack text alternatives',
      description: `${unlabeledSvgs.length} SVG graphic(s) declared as images have no <title> or aria-label.`,
      impact: 'Assistive technologies announce an unlabeled graphic without conveying its meaning.',
      remediation: 'Add <title> inside the <svg> or an aria-label attribute; if decorative, set aria-hidden="true".',
      codeBefore: '<svg role="img" viewBox="0 0 24 24"><path d="..." /></svg>',
      codeAfter: '<svg role="img" aria-label="Compliance verified" viewBox="0 0 24 24"><path d="..." /></svg>',
      instances: unlabeledSvgs,
    });
  }

  // 1.2.2 Video without captions track
  const uncaptionedMedia: AffectedInstance[] = [];
  $('video').each((_, el) => {
    const hasCaptions = $(el).find('track[kind="captions"], track[kind="subtitles"]').length > 0;
    if (!hasCaptions) {
      uncaptionedMedia.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: '<video> element has no <track kind="captions"> child.',
      });
    }
  });
  if (uncaptionedMedia.length > 0) {
    addFinding({
      criterionCode: '1.2.2',
      severity: 'Critical',
      title: 'Video content missing synchronized captions',
      description: `${uncaptionedMedia.length} video element(s) do not provide a <track kind="captions"> resource.`,
      impact: 'Deaf and hard-of-hearing users cannot access spoken dialogue or audio cues.',
      remediation: 'Include a WebVTT captions track inside every <video> element.',
      codeBefore: '<video controls src="/demo.mp4"></video>',
      codeAfter: '<video controls src="/demo.mp4"><track kind="captions" src="/demo.vtt" srclang="en" label="English" default></video>',
      instances: uncaptionedMedia,
    });
  }

  // 1.3.1 Form controls missing programmatic labels
  const unlabeledInputs: AffectedInstance[] = [];
  $('input, select, textarea').each((_, el) => {
    const type = ($(el).attr('type') ?? 'text').toLowerCase();
    if (['hidden', 'submit', 'reset', 'button', 'image'].includes(type)) return;
    if (!hasProgrammaticLabel($, el)) {
      unlabeledInputs.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: `Form ${el.tagName} (${type}) has no associated <label>, aria-label, or aria-labelledby.`,
      });
    }
  });
  if (unlabeledInputs.length > 0) {
    addFinding({
      criterionCode: '1.3.1',
      severity: 'Critical',
      title: 'Form controls missing programmatic labels',
      description: `${unlabeledInputs.length} form field(s) rely on visual context or placeholders instead of programmatic labels.`,
      impact: 'Screen reader users hear only "edit text" without knowing what data the input expects.',
      remediation: 'Associate every form control with a <label for="..."> or provide aria-label / aria-labelledby.',
      codeBefore: '<input type="email" placeholder="Work email">',
      codeAfter: '<label for="work-email">Work email</label>\n<input id="work-email" type="email" autocomplete="email">',
      instances: unlabeledInputs,
    });
  }

  // 1.3.1 Heading hierarchy & H1 presence
  const headingsOutline: { level: number; text: string }[] = [];
  const skippedHeadings: AffectedInstance[] = [];
  const emptyHeadings: AffectedInstance[] = [];
  let prevLevel = 0;

  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const level = Number(el.tagName.slice(1));
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    headingsOutline.push({ level, text: text || '(empty heading)' });

    if (!text) {
      emptyHeadings.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: `Empty <h${level}> element found.`,
      });
    }
    if (prevLevel > 0 && level - prevLevel > 1) {
      skippedHeadings.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: `Heading jumps from <h${prevLevel}> directly to <h${level}>.`,
      });
    }
    prevLevel = level;
  });

  const h1Count = $('h1').length;
  if (h1Count === 0 && $('body').children().length > 0) {
    addFinding({
      criterionCode: '1.3.1',
      severity: 'Moderate',
      title: 'Document lacks a top-level <h1> heading',
      description: 'No <h1> element was detected to establish the primary topic of the page.',
      impact: 'Screen reader users who navigate by headings cannot quickly jump to the main page title.',
      remediation: 'Include one descriptive <h1> heading at the start of the <main> landmark.',
      codeBefore: '<div class="page-title">Account Settings</div>',
      codeAfter: '<h1>Account Settings</h1>',
      instances: [
        {
          selector: 'body',
          snippet: '<body>... (no <h1> found)</body>',
          detail: '0 <h1> elements found across document.',
        },
      ],
    });
  }

  if (skippedHeadings.length > 0) {
    addFinding({
      criterionCode: '1.3.1',
      severity: 'Moderate',
      title: 'Heading levels skip sequential order',
      description: `${skippedHeadings.length} heading(s) skip intermediate rank levels (e.g., h1 to h3).`,
      impact: 'Disrupts document outline navigation for assistive technology users.',
      remediation: 'Maintain sequential heading ranks (h1 -> h2 -> h3) and use CSS classes for visual sizing.',
      codeBefore: '<h1>Dashboard</h1>\n<h3>Recent Invoices</h3>',
      codeAfter: '<h1>Dashboard</h1>\n<h2 class="text-base font-semibold">Recent Invoices</h2>',
      instances: skippedHeadings,
    });
  }

  if (emptyHeadings.length > 0) {
    addFinding({
      criterionCode: '2.4.6',
      severity: 'Moderate',
      title: 'Empty heading elements in DOM',
      description: `${emptyHeadings.length} heading element(s) contain no visible or accessible text.`,
      impact: 'Screen readers announce blank headings, confusing section structure.',
      remediation: 'Remove empty heading tags or supply descriptive heading text.',
      codeBefore: '<h2></h2>',
      codeAfter: '<h2>Billing Summary</h2>',
      instances: emptyHeadings,
    });
  }

  // 1.3.1 Tables without <th>
  const badTables: AffectedInstance[] = [];
  $('table').each((_, el) => {
    const role = $(el).attr('role');
    if (role === 'presentation' || role === 'none') return;
    if ($(el).find('th').length === 0 && $(el).find('tr').length > 1) {
      badTables.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: 'Data table lacks <th> header cells.',
      });
    }
  });
  if (badTables.length > 0) {
    addFinding({
      criterionCode: '1.3.1',
      severity: 'Serious',
      title: 'Data tables lack programmatic header cells (<th>)',
      description: `${badTables.length} table(s) use <td> cells without <th> column or row headers.`,
      impact: 'Screen reader users cannot determine which column or row header corresponds to each data cell.',
      remediation: 'Use <th scope="col"> for column headers and <th scope="row"> for row headers.',
      codeBefore: '<table><tr><td>Metric</td><td>Score</td></tr></table>',
      codeAfter: '<table><thead><tr><th scope="col">Metric</th><th scope="col">Score</th></tr></thead></table>',
      instances: badTables,
    });
  }

  // 1.3.5 Identify Input Purpose (AA)
  const missingAutocomplete: AffectedInstance[] = [];
  $('input').each((_, el) => {
    const type = ($(el).attr('type') ?? 'text').toLowerCase();
    const name = ($(el).attr('name') ?? '').toLowerCase();
    const id = ($(el).attr('id') ?? '').toLowerCase();
    const isPersonal =
      type === 'email' ||
      type === 'tel' ||
      /(email|phone|tel|fname|lname|first.?name|last.?name|full.?name|address|postal|zip|city|country)/.test(
        `${name} ${id}`
      );
    if (isPersonal && !$(el).attr('autocomplete')) {
      missingAutocomplete.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: 'Personal input lacks an explicit autocomplete token.',
      });
    }
  });
  if (missingAutocomplete.length > 0) {
    addFinding({
      criterionCode: '1.3.5',
      severity: 'Moderate',
      title: 'Personal data inputs missing autocomplete attributes',
      description: `${missingAutocomplete.length} user-identity input(s) lack standard HTML autocomplete tokens.`,
      impact: 'Users with cognitive or motor disabilities cannot rely on browser autofill or assistive purpose icons.',
      remediation: 'Add standard autocomplete tokens (e.g. autocomplete="email", "given-name", "postal-code").',
      codeBefore: '<input id="email" name="email" type="email">',
      codeAfter: '<input id="email" name="email" type="email" autocomplete="email">',
      instances: missingAutocomplete,
    });
  }

  // 1.4.2 Autoplay audio/video without muted
  const autoplayMedia: AffectedInstance[] = [];
  $('audio[autoplay], video[autoplay]').each((_, el) => {
    if ($(el).attr('muted') === undefined) {
      autoplayMedia.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: 'Media plays automatically with sound enabled.',
      });
    }
  });
  if (autoplayMedia.length > 0) {
    addFinding({
      criterionCode: '1.4.2',
      severity: 'Critical',
      title: 'Auto-playing audio interferes with screen readers',
      description: `${autoplayMedia.length} media element(s) use autoplay without the muted attribute.`,
      impact: 'Unexpected audio drowns out screen reader speech output and startles users.',
      remediation: 'Remove autoplay or add the muted attribute along with visible pause/volume controls.',
      codeBefore: '<video autoplay loop src="/intro.mp4"></video>',
      codeAfter: '<video autoplay muted controls loop src="/intro.mp4"></video>',
      instances: autoplayMedia,
    });
  }

  // 1.4.3 Contrast (Minimum) — Inline styles & embedded CSS color pairs
  const lowContrastInstances: AffectedInstance[] = [];
  $('[style]').each((_, el) => {
    const styles = parseInlineStyle($(el).attr('style'));
    if (styles.color && (styles['background-color'] || styles.background)) {
      const fg = parseColorString(styles.color);
      const bg = parseColorString(styles['background-color'] ?? styles.background);
      if (fg && bg) {
        const ratio = contrastRatio(fg, bg);
        const fontSizePx = parseCssSizePx(styles['font-size']) ?? 16;
        const isBold = styles['font-weight'] === 'bold' || Number(styles['font-weight']) >= 700;
        const isLarge = fontSizePx >= 24 || (isBold && fontSizePx >= 18.66);
        const threshold = isLarge ? 3.0 : 4.5;
        if (ratio < threshold) {
          lowContrastInstances.push({
            selector: buildSelector($, el),
            snippet: getSnippet($, el),
            detail: `Contrast ratio ${ratio.toFixed(2)}:1 (${styles.color} on ${styles['background-color'] ?? styles.background}) is below ${threshold}:1 minimum.`,
          });
        }
      }
    }
  });

  // Also parse simple embedded CSS rule blocks for explicit color + background-color pairs
  const cssRuleRegex = /([^{}]+)\{([^{}]+)\}/g;
  let cssMatch: RegExpExecArray | null;
  while ((cssMatch = cssRuleRegex.exec(embeddedCss)) !== null) {
    const selectorText = cssMatch[1].trim();
    const block = parseInlineStyle(cssMatch[2]);
    if (block.color && (block['background-color'] || block.background)) {
      const fg = parseColorString(block.color);
      const bg = parseColorString(block['background-color'] ?? block.background);
      if (fg && bg) {
        const ratio = contrastRatio(fg, bg);
        const fontSizePx = parseCssSizePx(block['font-size']) ?? 16;
        const threshold = fontSizePx >= 24 ? 3.0 : 4.5;
        if (ratio < threshold) {
          lowContrastInstances.push({
            selector: selectorText.slice(0, 60),
            snippet: `${selectorText} { color: ${block.color}; background-color: ${block['background-color'] ?? block.background}; }`,
            detail: `CSS rule contrast ratio ${ratio.toFixed(2)}:1 is below ${threshold}:1 minimum.`,
          });
        }
      }
    }
  }

  if (lowContrastInstances.length > 0) {
    addFinding({
      criterionCode: '1.4.3',
      severity: 'Serious',
      title: 'Insufficient foreground-to-background color contrast',
      description: `${lowContrastInstances.length} element(s) or style rules fail WCAG 2.2 AA contrast thresholds.`,
      impact: 'Low-vision users and people viewing screens in bright glare cannot read low-contrast text.',
      remediation: 'Darken text or adjust background luminance to achieve at least 4.5:1 for normal text and 3:1 for large text.',
      codeBefore: '<button style="color: #94a3b8; background-color: #ffffff;">Submit</button>',
      codeAfter: '<button style="color: #334155; background-color: #ffffff;">Submit</button>',
      instances: lowContrastInstances,
    });
  }

  // 1.4.4 Resize Text — Viewport meta blocking zoom
  const viewportMeta = $('meta[name="viewport"]').attr('content') ?? '';
  if (/user-scalable\s*=\s*(no|0)/i.test(viewportMeta) || /maximum-scale\s*=\s*1(\.0)?(?=\s|,|$)/i.test(viewportMeta)) {
    addFinding({
      criterionCode: '1.4.4',
      severity: 'Critical',
      title: 'Viewport meta tag disables pinch-to-zoom',
      description: 'The viewport configuration prevents users from zooming in on mobile devices.',
      impact: 'Users with low vision cannot magnify text up to 200% using browser zoom.',
      remediation: 'Remove user-scalable=no and maximum-scale=1 restrictions from the viewport meta tag.',
      codeBefore: '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">',
      codeAfter: '<meta name="viewport" content="width=device-width, initial-scale=1">',
      instances: [
        {
          selector: 'meta[name="viewport"]',
          snippet: getSnippet($, $('meta[name="viewport"]').get(0)!),
          detail: `Detected restrictive viewport directive: "${viewportMeta}".`,
        },
      ],
    });
  }

  // 2.1.1 Keyboard — Non-interactive elements with onclick
  const nonKeyboardClickables: AffectedInstance[] = [];
  $('div[onclick], span[onclick], p[onclick], li[onclick], img[onclick]').each((_, el) => {
    const $el = $(el);
    const tabindex = $el.attr('tabindex');
    const role = $el.attr('role');
    if (tabindex === undefined || !role) {
      nonKeyboardClickables.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: `Non-semantic <${el.tagName}> has onclick without ${tabindex === undefined ? 'tabindex="0"' : 'semantic role'}.`,
      });
    }
  });
  if (nonKeyboardClickables.length > 0) {
    addFinding({
      criterionCode: '2.1.1',
      severity: 'Critical',
      title: 'Clickable non-semantic elements are unreachable via keyboard',
      description: `${nonKeyboardClickables.length} non-interactive element(s) attach click handlers without keyboard focusability or ARIA roles.`,
      impact: 'Keyboard-only and switch-device users cannot focus or activate these controls.',
      remediation: 'Replace clickable <div>/<span> elements with native <button> or <a> elements.',
      codeBefore: '<div class="card-action" onclick="openModal()">Edit Profile</div>',
      codeAfter: '<button type="button" class="card-action" onclick="openModal()">Edit Profile</button>',
      instances: nonKeyboardClickables,
    });
  }

  // 2.2.2 Pause, Stop, Hide — Deprecated marquee / blink or auto-refresh
  const movingContent: AffectedInstance[] = [];
  $('marquee, blink').each((_, el) => {
    movingContent.push({
      selector: buildSelector($, el),
      snippet: getSnippet($, el),
      detail: `Deprecated <${el.tagName}> forces continuous unpausable motion.`,
    });
  });
  $('meta[http-equiv="refresh"]').each((_, el) => {
    movingContent.push({
      selector: buildSelector($, el),
      snippet: getSnippet($, el),
      detail: 'Meta refresh triggers automatic page reload/redirect without user control.',
    });
  });
  if (movingContent.length > 0) {
    addFinding({
      criterionCode: '2.2.2',
      severity: 'Serious',
      title: 'Uncontrolled automatic refresh or scrolling elements',
      description: `${movingContent.length} element(s) trigger automatic page refreshes or continuous animation without user controls.`,
      impact: 'Users with reading disabilities or vestibular sensitivities lose reading position or experience discomfort.',
      remediation: 'Remove <meta http-equiv="refresh"> and <marquee>/<blink>; provide explicit pause/stop controls.',
      codeBefore: '<meta http-equiv="refresh" content="30">',
      codeAfter: '<!-- Provide an explicit "Refresh data" button instead of automatic reload -->',
      instances: movingContent,
    });
  }

  // 2.4.1 Bypass Blocks — Skip link & Main landmark
  const landmarks: string[] = [];
  const landmarkTags = ['header', 'nav', 'main', 'aside', 'footer'];
  for (const tag of landmarkTags) {
    if ($(tag).length > 0) landmarks.push(`<${tag}>`);
  }
  $('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]').each((_, el) => {
    const r = $(el).attr('role');
    if (r && !landmarks.includes(`[role="${r}"]`)) landmarks.push(`[role="${r}"]`);
  });

  const hasMain = $('main, [role="main"]').length > 0;
  const firstLinks = $('a[href^="#"]').slice(0, 4).toArray();
  const hasSkipLink = firstLinks.some((a) => /skip|main|content|jump/i.test($(a).text()));

  if (!hasMain || !hasSkipLink) {
    const instances: AffectedInstance[] = [];
    if (!hasMain) {
      instances.push({
        selector: 'body',
        snippet: '<body>... (missing <main> landmark)</body>',
        detail: 'No <main> element or role="main" landmark found.',
      });
    }
    if (!hasSkipLink) {
      instances.push({
        selector: 'body > :first-child',
        snippet: 'No skip navigation link detected among initial anchor links.',
        detail: 'Missing "Skip to main content" link pointing to #main.',
      });
    }
    addFinding({
      criterionCode: '2.4.1',
      severity: 'Moderate',
      title: 'Missing bypass block mechanism or <main> landmark',
      description: 'Users cannot easily skip repeated header/navigation blocks directly to primary content.',
      impact: 'Keyboard users must tab through every navigation item on every page load.',
      remediation: 'Add a visually hidden (focus-revealed) "Skip to main content" link at the top of <body> and wrap primary content in <main id="main">.',
      codeBefore: '<header><nav>...</nav></header>\n<div class="content">...</div>',
      codeAfter: '<a href="#main" class="skip-link">Skip to main content</a>\n<header><nav>...</nav></header>\n<main id="main">...</main>',
      instances,
    });
  }

  // 2.4.2 Page Titled
  const pageTitle = $('title').first().text().replace(/\s+/g, ' ').trim();
  if (!pageTitle || /^(untitled|document|home|index|page)$/i.test(pageTitle)) {
    addFinding({
      criterionCode: '2.4.2',
      severity: 'Serious',
      title: pageTitle ? 'Generic or non-descriptive page <title>' : 'Document missing <title> element',
      description: pageTitle
        ? `Page title "${pageTitle}" does not describe the page's specific topic or purpose.`
        : 'The document <head> contains no <title> element.',
      impact: 'Screen reader users and people with multiple browser tabs cannot identify the page.',
      remediation: 'Provide a unique, descriptive <title> identifying both page purpose and site name.',
      codeBefore: '<head><title>Document</title></head>',
      codeAfter: '<head><title>Checkout Shipping — Acme Store</title></head>',
      instances: [
        {
          selector: 'head > title',
          snippet: $('title').length > 0 ? getSnippet($, $('title').get(0)!) : '<head> (no <title>) </head>',
          detail: pageTitle ? `Title "${pageTitle}" is overly generic.` : 'Missing <title> tag.',
        },
      ],
    });
  }

  // 2.4.3 Focus Order — Positive tabindex > 0
  const positiveTabindex: AffectedInstance[] = [];
  $('[tabindex]').each((_, el) => {
    const val = Number($(el).attr('tabindex'));
    if (!Number.isNaN(val) && val > 0) {
      positiveTabindex.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: `tabindex="${val}" overrides natural DOM focus order.`,
      });
    }
  });
  if (positiveTabindex.length > 0) {
    addFinding({
      criterionCode: '2.4.3',
      severity: 'Serious',
      title: 'Positive tabindex values disrupt natural focus order',
      description: `${positiveTabindex.length} element(s) specify tabindex > 0, forcing artificial tab sequences.`,
      impact: 'Keyboard users experience erratic focus jumps out of visual reading order.',
      remediation: 'Arrange interactive elements in logical DOM order and use tabindex="0" or "-1" only when needed.',
      codeBefore: '<button tabindex="3">Continue</button>',
      codeAfter: '<button type="button">Continue</button>',
      instances: positiveTabindex,
    });
  }

  // 2.4.4 Link Purpose (In Context)
  const vagueOrEmptyLinks: AffectedInstance[] = [];
  $('a').each((_, el) => {
    const name = getAccessibleName($, el);
    const hasHref = $(el).attr('href') !== undefined;
    if (!name) {
      vagueOrEmptyLinks.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: 'Anchor element has no accessible link text or image alt text.',
      });
    } else if (/^(click here|here|read more|learn more|more|link|details)$/i.test(name)) {
      vagueOrEmptyLinks.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: `Generic link text "${name}" lacks standalone context.`,
      });
    } else if (!hasHref && !$(el).attr('role')) {
      vagueOrEmptyLinks.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: '<a> element lacks href attribute and interactive role.',
      });
    }
  });
  if (vagueOrEmptyLinks.length > 0) {
    addFinding({
      criterionCode: '2.4.4',
      severity: 'Serious',
      title: 'Links have empty or ambiguous accessible text',
      description: `${vagueOrEmptyLinks.length} link(s) lack descriptive text (e.g., empty icon links or "Read more").`,
      impact: 'Screen reader users navigating link lists hear "link, click here" without knowing the destination.',
      remediation: 'Write self-describing link text or add descriptive aria-label context.',
      codeBefore: '<a href="/pricing">Learn more</a>',
      codeAfter: '<a href="/pricing">Compare enterprise accessibility plans</a>',
      instances: vagueOrEmptyLinks,
    });
  }

  // 2.4.7 Focus Visible — CSS suppressing outline without replacement
  const outlineSuppressed = /(:focus|button|a|input)[^{]*\{[^}]*outline\s*:\s*(none|0)\b/i.test(embeddedCss);
  const hasFocusVisibleReplacement = /:focus-visible\s*\{[^}]*(outline|box-shadow|border)/i.test(embeddedCss);
  if (outlineSuppressed && !hasFocusVisibleReplacement) {
    addFinding({
      criterionCode: '2.4.7',
      severity: 'Critical',
      title: 'Focus outline suppressed without visible replacement',
      description: 'Embedded stylesheet removes browser focus outlines (outline: none/0) without defining a :focus-visible ring.',
      impact: 'Keyboard users lose track of where focus currently sits on the page.',
      remediation: 'Never remove outlines without providing a high-contrast :focus-visible indicator (>= 3:1 contrast).',
      codeBefore: 'button:focus { outline: none; }',
      codeAfter: 'button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }',
      instances: [
        {
          selector: 'style',
          snippet: 'outline: none / 0 detected without :focus-visible fallback',
          detail: 'Embedded CSS clears focus outline.',
        },
      ],
    });
  }

  // 2.4.11 Focus Not Obscured (Minimum) — WCAG 2.2 AA
  const stickyHeaderDetected =
    /position\s*:\s*(fixed|sticky)/i.test(embeddedCss) ||
    $('[style*="position: fixed"], [style*="position:fixed"], [style*="position: sticky"], [style*="position:sticky"], header.sticky, header.fixed').length > 0;
  const hasScrollPadding = /scroll-padding-top/i.test(embeddedCss);
  if (stickyHeaderDetected && !hasScrollPadding) {
    addFinding({
      criterionCode: '2.4.11',
      severity: 'Moderate',
      status: 'Needs Review',
      title: 'Sticky or fixed container without scroll-padding-top offset',
      description: 'Fixed/sticky positioning detected without scroll-padding-top, risking obscured keyboard focus on anchor or tab scroll.',
      impact: 'When users tab backward or jump to anchors, sticky headers can cover focused controls under WCAG 2.2.',
      remediation: 'Set scroll-padding-top on html equal to or greater than the sticky header height.',
      codeBefore: 'header { position: sticky; top: 0; height: 64px; }',
      codeAfter: 'html { scroll-padding-top: 72px; }\nheader { position: sticky; top: 0; height: 64px; }',
      instances: [
        {
          selector: 'header / sticky element',
          snippet: 'Sticky/fixed layout element detected without scroll-padding-top.',
          detail: 'Verify focused elements remain visible beneath sticky overlays.',
        },
      ],
    });
  }

  // 2.5.3 Label in Name
  const labelMismatchInstances: AffectedInstance[] = [];
  $('a, button, [role="button"], [role="link"]').each((_, el) => {
    const visibleText = $(el).text().replace(/\s+/g, ' ').trim().toLowerCase();
    const ariaLabel = $(el).attr('aria-label')?.replace(/\s+/g, ' ').trim().toLowerCase();
    if (visibleText && ariaLabel && !ariaLabel.includes(visibleText)) {
      labelMismatchInstances.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: `Visible label "${visibleText}" is not contained in aria-label "${ariaLabel}".`,
      });
    }
  });
  if (labelMismatchInstances.length > 0) {
    addFinding({
      criterionCode: '2.5.3',
      severity: 'Serious',
      title: 'Accessible name (aria-label) contradicts visible label text',
      description: `${labelMismatchInstances.length} control(s) have an aria-label that omits the visible label text.`,
      impact: 'Voice-control users saying "Click Save" cannot activate a button whose aria-label is "Submit form".',
      remediation: 'Ensure aria-label begins with or contains the exact visible label string.',
      codeBefore: '<button aria-label="Submit invoice changes">Save</button>',
      codeAfter: '<button aria-label="Save invoice changes">Save</button>',
      instances: labelMismatchInstances,
    });
  }

  // 2.5.7 Dragging Movements — WCAG 2.2 AA
  const dragOnlyInstances: AffectedInstance[] = [];
  $('[draggable="true"], [ondragstart], [ondrag]').each((_, el) => {
    const hasButtonSibling = $(el).find('button').length > 0;
    if (!hasButtonSibling) {
      dragOnlyInstances.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: 'Draggable element lacks an embedded single-pointer button alternative.',
      });
    }
  });
  if (dragOnlyInstances.length > 0) {
    addFinding({
      criterionCode: '2.5.7',
      severity: 'Serious',
      title: 'Draggable controls lack single-pointer alternatives',
      description: `${dragOnlyInstances.length} draggable interface element(s) appear to require drag-and-drop gestures.`,
      impact: 'Users with tremors, trackballs, or switch devices cannot execute dragging movements accurately.',
      remediation: 'Provide single-click "Move Up / Move Down" or "Select" buttons alongside drag-and-drop.',
      codeBefore: '<li draggable="true" ondragstart="drag(event)">Priority Item</li>',
      codeAfter: '<li draggable="true">Priority Item <button type="button" aria-label="Move Priority Item up">Move up</button></li>',
      instances: dragOnlyInstances,
    });
  }

  // 2.5.8 Target Size (Minimum) — WCAG 2.2 AA (>= 24x24 CSS px)
  const undersizedTargets: AffectedInstance[] = [];
  $('button, input:not([type="hidden"]), [role="button"], a[style]').each((_, el) => {
    const styles = parseInlineStyle($(el).attr('style'));
    const w = parseCssSizePx(styles.width);
    const h = parseCssSizePx(styles.height);
    if ((w !== null && w < 24) || (h !== null && h < 24)) {
      undersizedTargets.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: `Explicit pointer target dimensions (${w ?? 'auto'}px × ${h ?? 'auto'}px) fall below 24×24px minimum.`,
      });
    }
  });
  if (undersizedTargets.length > 0) {
    addFinding({
      criterionCode: '2.5.8',
      severity: 'Serious',
      title: 'Interactive target size smaller than 24×24 CSS pixels',
      description: `${undersizedTargets.length} interactive control(s) specify width or height under 24px.`,
      impact: 'Users with limited fine motor precision or touch screens frequently miss or hit adjacent controls.',
      remediation: 'Ensure interactive controls meet at least 24×24 CSS px (44×44px recommended for touch).',
      codeBefore: '<button style="width: 18px; height: 18px;" aria-label="Close">×</button>',
      codeAfter: '<button style="min-width: 24px; min-height: 24px; padding: 6px;" aria-label="Close">×</button>',
      instances: undersizedTargets,
    });
  }

  // 3.1.1 Language of Page
  const htmlLang = $('html').attr('lang')?.trim() ?? null;
  if (!htmlLang || !/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(htmlLang)) {
    addFinding({
      criterionCode: '3.1.1',
      severity: 'Critical',
      title: htmlLang ? 'Invalid HTML lang attribute' : 'Missing lang attribute on <html> element',
      description: htmlLang
        ? `The <html lang="${htmlLang}"> value is not a valid BCP 47 language subtag.`
        : 'The root <html> element does not declare a primary human language.',
      impact: 'Screen readers may pronounce page content using the wrong language phonetic rules.',
      remediation: 'Add a valid BCP 47 language code to the root <html> element (e.g., lang="en").',
      codeBefore: '<html>',
      codeAfter: '<html lang="en">',
      instances: [
        {
          selector: 'html',
          snippet: `<html${htmlLang ? ` lang="${htmlLang}"` : ''}>`,
          detail: htmlLang ? `Invalid lang="${htmlLang}".` : 'No lang attribute on <html>.',
        },
      ],
    });
  }

  // 3.2.2 On Input — Auto-submitting form controls
  const autoContextChanges: AffectedInstance[] = [];
  $('select[onchange], input[onchange]').each((_, el) => {
    const handler = $(el).attr('onchange') ?? '';
    if (/submit\s*\(|location\.|window\.open/i.test(handler)) {
      autoContextChanges.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: `onchange="${handler.slice(0, 60)}" triggers navigation or form submission automatically.`,
      });
    }
  });
  if (autoContextChanges.length > 0) {
    addFinding({
      criterionCode: '3.2.2',
      severity: 'Serious',
      title: 'Form controls trigger unexpected context changes on input',
      description: `${autoContextChanges.length} control(s) submit forms or navigate immediately on value change.`,
      impact: 'Keyboard users arrowing through a <select> dropdown are unexpectedly navigated away before choosing.',
      remediation: 'Let users confirm selections via an explicit submit button rather than auto-submitting on change.',
      codeBefore: '<select onchange="this.form.submit()"><option>USD</option><option>EUR</option></select>',
      codeAfter: '<select name="currency"><option>USD</option><option>EUR</option></select>\n<button type="submit">Apply currency</button>',
      instances: autoContextChanges,
    });
  }

  // 3.2.6 Consistent Help — WCAG 2.2 A
  const hasHelpLink = $('a, button')
    .toArray()
    .some((el) => /help|support|contact|accessibility|faq|chat/i.test(getAccessibleName($, el)));
  if (!hasHelpLink && $('header, nav, footer').length > 0) {
    addFinding({
      criterionCode: '3.2.6',
      severity: 'Minor',
      status: 'Needs Review',
      title: 'No identifiable help or support mechanism detected',
      description: 'No contact, support, FAQ, or accessibility help link was detected in navigation or footer landmarks.',
      impact: 'WCAG 2.2 requires help mechanisms (if offered across a site) to appear in consistent relative order.',
      remediation: 'Ensure support, contact, or accessibility help links appear consistently in the same relative header/footer slot across all pages.',
      codeBefore: '<footer><a href="/terms">Terms</a></footer>',
      codeAfter: '<footer><a href="/help">Help & Support</a> <a href="/terms">Terms</a></footer>',
      instances: [
        {
          selector: 'footer / nav',
          snippet: 'No help/support/contact link found in global navigation landmarks.',
          detail: 'Verify consistent help placement across site templates.',
        },
      ],
    });
  }

  // 3.3.2 Labels or Instructions — Required fields without instruction/aria-required
  const requiredWithoutCue: AffectedInstance[] = [];
  $('input[required], select[required], textarea[required]').each((_, el) => {
    const hasDescribedBy = Boolean($(el).attr('aria-describedby'));
    const hasPattern = Boolean($(el).attr('pattern'));
    const hasTitle = Boolean($(el).attr('title'));
    if (hasPattern && !hasDescribedBy && !hasTitle) {
      requiredWithoutCue.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: 'Required input enforces a regex pattern without aria-describedby format instructions.',
      });
    }
  });
  if (requiredWithoutCue.length > 0) {
    addFinding({
      criterionCode: '3.3.2',
      severity: 'Moderate',
      title: 'Pattern-constrained required inputs lack format instructions',
      description: `${requiredWithoutCue.length} input(s) enforce a validation pattern without programmatic instructions.`,
      impact: 'Users do not know the required format before submitting and triggering validation errors.',
      remediation: 'Connect visible format instructions via aria-describedby.',
      codeBefore: '<input type="text" required pattern="[A-Z]{3}-\\d{4}">',
      codeAfter: '<input type="text" required pattern="[A-Z]{3}-\\d{4}" aria-describedby="code-hint">\n<span id="code-hint">Format: ABC-1234</span>',
      instances: requiredWithoutCue,
    });
  }

  // 3.3.8 Accessible Authentication (Minimum) — WCAG 2.2 AA
  const authBarriers: AffectedInstance[] = [];
  $('input[type="password"]').each((_, el) => {
    const onpaste = $(el).attr('onpaste') ?? '';
    const autocomplete = ($(el).attr('autocomplete') ?? '').toLowerCase();
    if (/return\s+false|preventDefault/i.test(onpaste) || autocomplete === 'off') {
      authBarriers.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: /return\s+false|preventDefault/i.test(onpaste)
          ? 'Password field blocks pasting via onpaste handler.'
          : 'Password field disables password managers with autocomplete="off".',
      });
    }
  });
  if (authBarriers.length > 0) {
    addFinding({
      criterionCode: '3.3.8',
      severity: 'Critical',
      title: 'Authentication barrier blocks password managers or paste',
      description: `${authBarriers.length} password field(s) prevent pasting or disable browser autocomplete.`,
      impact: 'Fails WCAG 2.2 Accessible Authentication by forcing users with memory/cognitive disabilities to transcribe complex passwords manually.',
      remediation: 'Allow paste events on password inputs and use autocomplete="current-password" or "new-password".',
      codeBefore: '<input type="password" onpaste="return false" autocomplete="off">',
      codeAfter: '<input type="password" autocomplete="current-password">',
      instances: authBarriers,
    });
  }

  // 4.1.2 Name, Role, Value — Empty buttons, iframes without title, duplicate IDs, aria-hidden focusables
  const emptyButtons: AffectedInstance[] = [];
  $('button, [role="button"]').each((_, el) => {
    if (!getAccessibleName($, el)) {
      emptyButtons.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: 'Button has no text content, aria-label, or labelledby target.',
      });
    }
  });
  if (emptyButtons.length > 0) {
    addFinding({
      criterionCode: '4.1.2',
      severity: 'Critical',
      title: 'Buttons have no accessible name',
      description: `${emptyButtons.length} button control(s) contain only icons or empty markup without an accessible label.`,
      impact: 'Screen readers announce only "button", leaving users unable to know what activating it will do.',
      remediation: 'Add an aria-label attribute or visually hidden span text inside icon-only buttons.',
      codeBefore: '<button type="button"><svg>...</svg></button>',
      codeAfter: '<button type="button" aria-label="Delete selected audit"><svg aria-hidden="true">...</svg></button>',
      instances: emptyButtons,
    });
  }

  const untitledIframes: AffectedInstance[] = [];
  $('iframe').each((_, el) => {
    if ($(el).attr('aria-hidden') === 'true' || $(el).attr('tabindex') === '-1') return;
    if (!$(el).attr('title')?.trim() && !$(el).attr('aria-label')?.trim()) {
      untitledIframes.push({
        selector: buildSelector($, el),
        snippet: getSnippet($, el),
        detail: '<iframe> lacks a descriptive title attribute.',
      });
    }
  });
  if (untitledIframes.length > 0) {
    addFinding({
      criterionCode: '4.1.2',
      severity: 'Serious',
      title: 'Embedded <iframe> elements missing title attribute',
      description: `${untitledIframes.length} iframe(s) have no title or aria-label describing the embedded frame.`,
      impact: 'Screen reader users encounter unlabeled frame regions without context.',
      remediation: 'Add a concise title attribute to every visible <iframe>.',
      codeBefore: '<iframe src="https://example.com/embed"></iframe>',
      codeAfter: '<iframe src="https://example.com/embed" title="Interactive payment form"></iframe>',
      instances: untitledIframes,
    });
  }

  // Duplicate IDs breaking ARIA / label associations
  const idCounts = new Map<string, Element[]>();
  $('[id]').each((_, el) => {
    const id = $(el).attr('id')?.trim();
    if (!id) return;
    const list = idCounts.get(id) ?? [];
    list.push(el);
    idCounts.set(id, list);
  });
  const duplicateIdInstances: AffectedInstance[] = [];
  for (const [id, els] of idCounts.entries()) {
    if (els.length > 1) {
      duplicateIdInstances.push({
        selector: `#${id}`,
        snippet: getSnippet($, els[0]),
        detail: `ID "${id}" appears ${els.length} times in the DOM, breaking label/ARIA references.`,
      });
    }
  }
  if (duplicateIdInstances.length > 0) {
    addFinding({
      criterionCode: '4.1.2',
      severity: 'Serious',
      title: 'Duplicate DOM id attributes break ARIA and label wiring',
      description: `${duplicateIdInstances.length} identifier(s) are duplicated across multiple DOM nodes.`,
      impact: '<label for="..."> and aria-labelledby always resolve to the first match, mislabeling subsequent controls.',
      remediation: 'Ensure every id attribute in the document is strictly unique.',
      codeBefore: '<input id="qty" ...> ... <input id="qty" ...>',
      codeAfter: '<input id="qty-row-1" ...> ... <input id="qty-row-2" ...>',
      instances: duplicateIdInstances,
    });
  }

  // Filter findings and catalog based on requested conformance level
  const levelRank: Record<WcagLevel, number> = { A: 1, AA: 2, AAA: 3 };
  const activeRank = levelRank[targetLevel];

  const scopedFindings = findings.filter((f) => levelRank[f.level] <= activeRank);
  const scopedCatalog = WCAG_22_CATALOG.filter((c) => levelRank[c.level] <= activeRank);

  const failedCodes = new Set(scopedFindings.filter((f) => f.status === 'Failed').map((f) => f.criterionCode));
  const reviewCodes = new Set(
    scopedFindings.filter((f) => f.status === 'Needs Review' && !failedCodes.has(f.criterionCode)).map((f) => f.criterionCode)
  );

  const passedCriteria = scopedCatalog.filter(
    (c) => !failedCodes.has(c.code) && !reviewCodes.has(c.code)
  );

  const severityCounts: Record<AuditSeverity, number> = {
    Critical: 0,
    Serious: 0,
    Moderate: 0,
    Minor: 0,
  };
  for (const f of scopedFindings) {
    severityCounts[f.severity] += 1;
  }

  const principles: WcagPrinciple[] = ['Perceivable', 'Operable', 'Understandable', 'Robust'];
  const principleBreakdown: PrincipleSummary[] = principles.map((p) => {
    const critForP = scopedCatalog.filter((c) => c.principle === p);
    const failedCount = critForP.filter((c) => failedCodes.has(c.code)).length;
    const reviewCount = critForP.filter((c) => reviewCodes.has(c.code)).length;
    const passedCount = critForP.length - failedCount - reviewCount;
    return {
      principle: p,
      passed: passedCount,
      failed: failedCount,
      needsReview: reviewCount,
    };
  });

  const totalCriteriaEvaluated = scopedCatalog.length;
  const conformanceRate =
    totalCriteriaEvaluated > 0
      ? Math.round((passedCriteria.length / totalCriteriaEvaluated) * 100)
      : 100;

  const documentProfile: DocumentProfile = {
    title: pageTitle || 'Untitled Document',
    lang: htmlLang,
    totalElements: $('*').length,
    imagesCount: $('img').length,
    linksCount: $('a').length,
    formsCount: $('form').length,
    inputsCount: $('input, select, textarea').length,
    buttonsCount: $('button, [role="button"]').length,
    headingsCount: headingsOutline.length,
    landmarks,
    headingsOutline: headingsOutline.slice(0, 30),
    stylesheetsCount: $('link[rel="stylesheet"], style').length,
    fetchDurationMs,
    htmlBytes: Buffer.byteLength(html, 'utf8'),
  };

  return {
    id: `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    target,
    targetType,
    auditedAt: new Date().toISOString(),
    targetLevel,
    conformanceRate,
    passedCriteriaCount: passedCriteria.length,
    failedCriteriaCount: failedCodes.size,
    reviewCriteriaCount: reviewCodes.size,
    totalChecksRun: totalCriteriaEvaluated,
    severityCounts,
    principleBreakdown,
    documentProfile,
    findings: scopedFindings,
    passedCriteria,
  };
}
