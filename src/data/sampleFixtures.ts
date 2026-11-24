import type { AuditReport } from '../shared/wcag.ts';

export interface HtmlSampleFixture {
  id: string;
  label: string;
  description: string;
  html: string;
}

export const SAMPLE_HTML_FIXTURES: HtmlSampleFixture[] = [
  {
    id: 'checkout-regressions',
    label: 'Retail Checkout (WCAG 2.2 Regressions)',
    description: 'Contains missing labels, low contrast, 18px target sizes, paste-blocked password, and skipped headings.',
    html: `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Document</title>
  <style>
    header { position: sticky; top: 0; height: 64px; background: #ffffff; }
    button:focus { outline: none; }
    .muted-note { color: #94a3b8; background-color: #ffffff; font-size: 14px; }
  </style>
</head>
<body>
  <header>
    <img src="/logo.png">
    <nav>
      <a href="/catalog">Catalog</a>
      <a href="/cart" aria-label="Shopping Bag">Cart</a>
    </nav>
  </header>
  <div class="checkout-shell">
    <h1>Express Checkout</h1>
    <h3>Billing Information</h3>
    <form>
      <input type="email" placeholder="Email address" name="email">
      <input type="password" placeholder="Account password" onpaste="return false" autocomplete="off">
      <input type="text" required pattern="[A-Z]{2}\\d{5}" placeholder="Promo code">
      <select onchange="this.form.submit()">
        <option>Standard Shipping</option>
        <option>Next-Day Air</option>
      </select>
      <div class="summary-row" draggable="true" ondragstart="reorder(event)">
        <span>Order Item #1</span>
      </div>
      <div class="submit-box" onclick="submitOrder()">Place Order</div>
      <button type="button" style="width: 18px; height: 18px;"></button>
      <a href="/terms">Read more</a>
    </form>
  </div>
</body>
</html>`,
  },
  {
    id: 'media-portal',
    label: 'Media & Analytics Portal',
    description: 'Includes uncaptioned autoplay video, duplicate DOM IDs, untitled iframe, and unlabeled data table.',
    html: `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Analytics Overview — Pulse Media</title>
</head>
<body>
  <a href="#main-content">Skip to main content</a>
  <header>
    <nav>
      <a href="/overview">Overview</a>
      <a href="/support">Support</a>
    </nav>
  </header>
  <main id="main-content">
    <h1>Audience Telemetry</h1>
    <video autoplay controls src="/stream.mp4"></video>
    <iframe src="https://charts.example.com/embed"></iframe>
    <h2>Channel Breakdown</h2>
    <input id="filter-input" type="text" aria-label="Filter channel">
    <input id="filter-input" type="text" aria-label="Secondary filter">
    <table>
      <tr><td>Channel</td><td>Sessions</td></tr>
      <tr><td>Organic</td><td>14,200</td></tr>
    </table>
    <button type="button" aria-label="Confirm filters">Apply</button>
  </main>
</body>
</html>`,
  },
  {
    id: 'compliant-reference',
    label: 'Compliant Reference Page',
    description: 'Semantic landmarks, sequential headings, 44px focusable controls, accessible auth, and caption tracks.',
    html: `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Account Preferences — Northstar Bank</title>
  <style>
    html { scroll-padding-top: 72px; }
    header { position: sticky; top: 0; height: 64px; background: #ffffff; }
    button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
    .body-copy { color: #1e293b; background-color: #ffffff; font-size: 16px; }
  </style>
</head>
<body>
  <a href="#main">Skip to main content</a>
  <header>
    <img src="/brand.svg" alt="Northstar Bank">
    <nav aria-label="Primary">
      <a href="/accounts">Accounts</a>
      <a href="/help">Help & Support</a>
    </nav>
  </header>
  <main id="main">
    <h1>Account Preferences</h1>
    <p class="body-copy">Manage your contact details and security preferences.</p>
    <h2>Security Settings</h2>
    <form>
      <label for="user-email">Primary Email</label>
      <input id="user-email" name="email" type="email" autocomplete="email" required aria-describedby="email-hint">
      <span id="email-hint">Used for account recovery alerts.</span>

      <label for="user-pass">Password</label>
      <input id="user-pass" type="password" autocomplete="current-password">

      <button type="submit" style="min-width: 44px; min-height: 44px;">Save preferences</button>
    </form>
  </main>
  <footer>
    <a href="/accessibility">Accessibility Statement</a>
  </footer>
</body>
</html>`,
  },
];

export function downloadAuditJson(report: AuditReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wcag22-audit-${report.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAuditMarkdown(report: AuditReport): void {
  const lines: string[] = [
    `# WCAG 2.2 Accessibility Evaluation Report`,
    ``,
    `- **Target**: ${report.target}`,
    `- **Target Level**: WCAG 2.2 Level ${report.targetLevel}`,
    `- **Evaluated At**: ${new Date(report.auditedAt).toLocaleString()}`,
    `- **Conformance Rate**: ${report.conformanceRate}% (${report.passedCriteriaCount} passed, ${report.failedCriteriaCount} failed, ${report.reviewCriteriaCount} needs review)`,
    ``,
    `## Findings (${report.findings.length})`,
    ``,
  ];

  if (report.findings.length === 0) {
    lines.push('No automated WCAG 2.2 violations detected for the selected level.');
  } else {
    for (const f of report.findings) {
      lines.push(`### ${f.criterionCode} ${f.criterionName} (Level ${f.level}) — ${f.severity}`);
      lines.push(`**${f.title}**`);
      lines.push(``);
      lines.push(f.description);
      lines.push(``);
      lines.push(`- **Impact**: ${f.impact}`);
      lines.push(`- **Remediation**: ${f.remediation}`);
      lines.push(`- **Affected Instances (${f.instances.length})**:`);
      for (const inst of f.instances) {
        lines.push(`  - \`${inst.selector}\`: ${inst.detail}`);
      }
      lines.push(``);
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wcag22-report-${report.id}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
