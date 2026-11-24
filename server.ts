import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { runWcag22Audit } from './server/wcagAuditor.ts';
import type { WcagLevel } from './src/shared/wcag.ts';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/audit', async (req, res) => {
    try {
      const { mode, url, html, level } = req.body as {
        mode?: 'url' | 'html';
        url?: string;
        html?: string;
        level?: WcagLevel;
      };

      const targetLevel: WcagLevel = level === 'A' || level === 'AAA' ? level : 'AA';

      if (mode === 'html') {
        if (!html || typeof html !== 'string' || !html.trim()) {
          res.status(400).json({ error: 'Provide non-empty HTML markup to audit.' });
          return;
        }
        const started = performance.now();
        const report = runWcag22Audit({
          html,
          target: 'Submitted HTML Document',
          targetType: 'html',
          targetLevel,
          fetchDurationMs: Math.round(performance.now() - started),
        });
        res.json(report);
        return;
      }

      if (!url || typeof url !== 'string' || !url.trim()) {
        res.status(400).json({ error: 'Enter a valid http:// or https:// URL to evaluate.' });
        return;
      }

      let normalizedUrl = url.trim();
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(normalizedUrl);
      } catch {
        res.status(400).json({ error: 'The provided URL is malformed.' });
        return;
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        res.status(400).json({ error: 'Only HTTP and HTTPS protocols are supported.' });
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const fetchStart = performance.now();

      let response: Response;
      try {
        response = await fetch(parsedUrl.toString(), {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; VeritasA11y/1.0; +https://www.w3.org/TR/WCAG22/)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
      } catch (err) {
        clearTimeout(timeoutId);
        const message =
          err instanceof Error && err.name === 'AbortError'
            ? 'Target server timed out after 12 seconds.'
            : `Unable to reach ${parsedUrl.hostname}. Some websites block automated fetches—try pasting the page HTML source in HTML Source mode.`;
        res.status(502).json({ error: message });
        return;
      }
      clearTimeout(timeoutId);

      const fetchDurationMs = Math.round(performance.now() - fetchStart);

      if (!response.ok) {
        res.status(502).json({
          error: `Target URL returned HTTP ${response.status} ${response.statusText}. If the site blocks bots, paste its rendered HTML in HTML Source mode.`,
        });
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType && !contentType.includes('html') && !contentType.includes('xml') && !contentType.includes('text')) {
        res.status(400).json({
          error: `Target returned unsupported content-type "${contentType}". Expected an HTML document.`,
        });
        return;
      }

      const fetchedHtml = await response.text();
      if (!fetchedHtml.trim()) {
        res.status(422).json({ error: 'Target returned an empty HTML response.' });
        return;
      }

      const report = runWcag22Audit({
        html: fetchedHtml,
        target: response.url || parsedUrl.toString(),
        targetType: 'url',
        targetLevel,
        fetchDurationMs,
      });

      res.json(report);
    } catch (error) {
      console.error('Audit route failure:', error);
      res.status(500).json({
        error: 'Unexpected error while analyzing the document.',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Veritas A11y server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
