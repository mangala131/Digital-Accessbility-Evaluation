export type WcagPrinciple = 'Perceivable' | 'Operable' | 'Understandable' | 'Robust';
export type WcagLevel = 'A' | 'AA' | 'AAA';
export type AuditSeverity = 'Critical' | 'Serious' | 'Moderate' | 'Minor';
export type AuditStatus = 'Failed' | 'Passed' | 'Needs Review';

export interface WcagCriterionMeta {
  code: string;
  name: string;
  level: WcagLevel;
  version: '2.0' | '2.1' | '2.2';
  principle: WcagPrinciple;
  summary: string;
}

export interface AffectedInstance {
  selector: string;
  snippet: string;
  detail: string;
}

export interface AuditFinding {
  id: string;
  criterionCode: string;
  criterionName: string;
  level: WcagLevel;
  version: '2.0' | '2.1' | '2.2';
  principle: WcagPrinciple;
  severity: AuditSeverity;
  status: AuditStatus;
  title: string;
  description: string;
  impact: string;
  remediation: string;
  codeBefore: string;
  codeAfter: string;
  instances: AffectedInstance[];
}

export interface DocumentProfile {
  title: string;
  lang: string | null;
  totalElements: number;
  imagesCount: number;
  linksCount: number;
  formsCount: number;
  inputsCount: number;
  buttonsCount: number;
  headingsCount: number;
  landmarks: string[];
  headingsOutline: { level: number; text: string }[];
  stylesheetsCount: number;
  fetchDurationMs: number;
  htmlBytes: number;
}

export interface PrincipleSummary {
  principle: WcagPrinciple;
  passed: number;
  failed: number;
  needsReview: number;
}

export interface AuditReport {
  id: string;
  target: string;
  targetType: 'url' | 'html';
  auditedAt: string;
  targetLevel: WcagLevel;
  conformanceRate: number;
  passedCriteriaCount: number;
  failedCriteriaCount: number;
  reviewCriteriaCount: number;
  totalChecksRun: number;
  severityCounts: Record<AuditSeverity, number>;
  principleBreakdown: PrincipleSummary[];
  documentProfile: DocumentProfile;
  findings: AuditFinding[];
  passedCriteria: WcagCriterionMeta[];
}

export const WCAG_22_CATALOG: WcagCriterionMeta[] = [
  {
    code: '1.1.1',
    name: 'Non-text Content',
    level: 'A',
    version: '2.0',
    principle: 'Perceivable',
    summary: 'All non-text content presented to the user has a text alternative that serves the equivalent purpose.',
  },
  {
    code: '1.2.2',
    name: 'Captions (Prerecorded)',
    level: 'A',
    version: '2.0',
    principle: 'Perceivable',
    summary: 'Captions are provided for all prerecorded audio content in synchronized media.',
  },
  {
    code: '1.3.1',
    name: 'Info and Relationships',
    level: 'A',
    version: '2.0',
    principle: 'Perceivable',
    summary: 'Information, structure, and relationships conveyed through presentation can be programmatically determined.',
  },
  {
    code: '1.3.5',
    name: 'Identify Input Purpose',
    level: 'AA',
    version: '2.1',
    principle: 'Perceivable',
    summary: 'The purpose of each input field collecting information about the user can be programmatically determined.',
  },
  {
    code: '1.4.2',
    name: 'Audio Control',
    level: 'A',
    version: '2.0',
    principle: 'Perceivable',
    summary: 'If audio plays automatically for more than 3 seconds, a mechanism is available to pause or stop it.',
  },
  {
    code: '1.4.3',
    name: 'Contrast (Minimum)',
    level: 'AA',
    version: '2.0',
    principle: 'Perceivable',
    summary: 'Visual presentation of text has a contrast ratio of at least 4.5:1 (3:1 for large text).',
  },
  {
    code: '1.4.4',
    name: 'Resize Text',
    level: 'AA',
    version: '2.0',
    principle: 'Perceivable',
    summary: 'Text can be resized without assistive technology up to 200 percent without loss of content or functionality.',
  },
  {
    code: '2.1.1',
    name: 'Keyboard',
    level: 'A',
    version: '2.0',
    principle: 'Operable',
    summary: 'All functionality of the content is operable through a keyboard interface.',
  },
  {
    code: '2.2.2',
    name: 'Pause, Stop, Hide',
    level: 'A',
    version: '2.0',
    principle: 'Operable',
    summary: 'For moving, blinking, scrolling, or auto-updating information, users can pause, stop, or hide it.',
  },
  {
    code: '2.4.1',
    name: 'Bypass Blocks',
    level: 'A',
    version: '2.0',
    principle: 'Operable',
    summary: 'A mechanism is available to bypass blocks of content that are repeated on multiple web pages.',
  },
  {
    code: '2.4.2',
    name: 'Page Titled',
    level: 'A',
    version: '2.0',
    principle: 'Operable',
    summary: 'Web pages have titles that describe topic or purpose.',
  },
  {
    code: '2.4.3',
    name: 'Focus Order',
    level: 'A',
    version: '2.0',
    principle: 'Operable',
    summary: 'Focusable components receive focus in an order that preserves meaning and operability.',
  },
  {
    code: '2.4.4',
    name: 'Link Purpose (In Context)',
    level: 'A',
    version: '2.0',
    principle: 'Operable',
    summary: 'The purpose of each link can be determined from the link text alone or its programmatic context.',
  },
  {
    code: '2.4.6',
    name: 'Headings and Labels',
    level: 'AA',
    version: '2.0',
    principle: 'Operable',
    summary: 'Headings and labels describe topic or purpose clearly and uniquely.',
  },
  {
    code: '2.4.7',
    name: 'Focus Visible',
    level: 'AA',
    version: '2.0',
    principle: 'Operable',
    summary: 'Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible.',
  },
  {
    code: '2.4.11',
    name: 'Focus Not Obscured (Minimum)',
    level: 'AA',
    version: '2.2',
    principle: 'Operable',
    summary: 'When a UI component receives keyboard focus, the component is not entirely hidden due to author-created content.',
  },
  {
    code: '2.5.3',
    name: 'Label in Name',
    level: 'A',
    version: '2.1',
    principle: 'Operable',
    summary: 'For components with labels that include text, the accessible name contains the visually presented text.',
  },
  {
    code: '2.5.7',
    name: 'Dragging Movements',
    level: 'AA',
    version: '2.2',
    principle: 'Operable',
    summary: 'All functionality that uses a dragging movement for operation can be achieved by a single pointer without dragging.',
  },
  {
    code: '2.5.8',
    name: 'Target Size (Minimum)',
    level: 'AA',
    version: '2.2',
    principle: 'Operable',
    summary: 'The size of the target for pointer inputs is at least 24 by 24 CSS pixels unless an exception applies.',
  },
  {
    code: '3.1.1',
    name: 'Language of Page',
    level: 'A',
    version: '2.0',
    principle: 'Understandable',
    summary: 'The default human language of each web page can be programmatically determined.',
  },
  {
    code: '3.2.2',
    name: 'On Input',
    level: 'A',
    version: '2.0',
    principle: 'Understandable',
    summary: 'Changing the setting of any user interface component does not automatically cause a change of context.',
  },
  {
    code: '3.2.6',
    name: 'Consistent Help',
    level: 'A',
    version: '2.2',
    principle: 'Understandable',
    summary: 'If a web page contains help mechanisms (human contact, self-help, automated help), they occur in the same relative order.',
  },
  {
    code: '3.3.2',
    name: 'Labels or Instructions',
    level: 'A',
    version: '2.0',
    principle: 'Understandable',
    summary: 'Labels or instructions are provided when content requires user input.',
  },
  {
    code: '3.3.8',
    name: 'Accessible Authentication (Minimum)',
    level: 'AA',
    version: '2.2',
    principle: 'Understandable',
    summary: 'A cognitive function test is not required for any step in an authentication process unless an accessible alternative is provided.',
  },
  {
    code: '4.1.2',
    name: 'Name, Role, Value',
    level: 'A',
    version: '2.0',
    principle: 'Robust',
    summary: 'For all user interface components, the name and role can be programmatically determined and states/values can be set.',
  },
];

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3',
  darkgray: '#a9a9a9',
  darkgrey: '#a9a9a9',
  navy: '#000080',
  teal: '#008080',
  orange: '#ffa500',
  purple: '#800080',
  maroon: '#800000',
  olive: '#808000',
  lime: '#00ff00',
  aqua: '#00ffff',
  cyan: '#00ffff',
  fuchsia: '#ff00ff',
  magenta: '#ff00ff',
  slategray: '#708090',
  slategrey: '#708090',
};

export function parseColorString(raw: string): RgbColor | null {
  const input = raw.trim().toLowerCase();
  const mapped = NAMED_COLORS[input] ?? input;

  if (mapped.startsWith('#')) {
    const hex = mapped.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : { r, g, b };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : { r, g, b };
    }
    return null;
  }

  const rgbMatch = mapped.match(/^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/);
  if (rgbMatch) {
    return {
      r: Math.min(255, Math.max(0, Number(rgbMatch[1]))),
      g: Math.min(255, Math.max(0, Number(rgbMatch[2]))),
      b: Math.min(255, Math.max(0, Number(rgbMatch[3]))),
    };
  }

  return null;
}

export function relativeLuminance({ r, g, b }: RgbColor): number {
  const toLinear = (c: number) => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(fg: RgbColor, bg: RgbColor): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
