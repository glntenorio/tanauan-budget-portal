import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import portal from './portal.config';
import { DEFAULT_API, shortNameOf } from './src/config';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The portal's name and description in the HTML itself, for link previews and search engines. */
/** GA4 snippet, only when the build sets an id. Page views are sent by the app on each route change. */
function analyticsSnippet(id: string | undefined): string {
  if (!id || !/^G-[A-Z0-9]+$/.test(id)) return '';
  return `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${id}', { send_page_view: false });
    </script>`;
}

function portalHtml(api: string, ga4?: string): Plugin {
  const short = shortNameOf(portal);
  // The home page's head. Other pages set their own at runtime (src/lib/use-title.ts).
  const title = `${portal.name} 2027 Budget: Every Project, NEP vs House Bill`;
  const description = `Every 2027 national budget project for ${portal.name}: the NEP against the House bill, what was added or dropped, and the source page for each.`;
  const base = portal.siteUrl?.replace(/\/+$/, '');
  const home = base ? `${base}/` : '';
  const url = base
    ? `<link rel="canonical" href="${escape(home)}" data-base="${escape(base)}" />\n    <meta property="og:url" content="${escape(home)}" />`
    : '';
  // Structured data: the page, the dataset it shows, and the person behind it
  // (the same @id glentenorio.com's own pages use).
  const ld = base
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebPage',
            '@id': `${home}#webpage`,
            url: home,
            name: title,
            description,
            inLanguage: 'en',
            isPartOf: { '@id': 'https://glentenorio.com/#website' },
            author: { '@id': 'https://glentenorio.com/#person' },
            about: { '@id': `${home}#dataset` },
            breadcrumb: { '@id': `${home}#breadcrumb` },
            primaryImageOfPage: `${home}og.jpg`,
          },
          {
            '@type': 'BreadcrumbList',
            '@id': `${home}#breadcrumb`,
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://glentenorio.com/' },
              { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://glentenorio.com/tools/' },
              { '@type': 'ListItem', position: 3, name: `${portal.name} Budget Portal`, item: home },
            ],
          },
          {
            '@type': 'Dataset',
            '@id': `${home}#dataset`,
            name: `${portal.name} 2027 national budget projects`,
            description: `Every project for ${portal.name} in the FY 2027 National Expenditure Program (NEP) and House Bill 10858, compared line by line, with the enacted budgets (GAA) for 2020 to 2026. Amounts are appropriations as published, not spending.`,
            url: home,
            creator: { '@id': 'https://glentenorio.com/#person' },
            isBasedOn: 'https://budget.bettergov.ph/hgab/2027/overview',
            isAccessibleForFree: true,
            inLanguage: 'en',
            spatialCoverage: { '@type': 'Place', name: `${portal.name}, Batangas, Philippines` },
            temporalCoverage: '2020/2027',
            keywords: [`${short} budget`, '2027 national budget', 'NEP', 'House Bill 10858', 'GAA', 'DPWH', 'budget transparency', 'Philippines'],
          },
          {
            '@type': 'Person',
            '@id': 'https://glentenorio.com/#person',
            name: 'Glen Tenorio',
            url: 'https://glentenorio.com/',
          },
        ],
      }).replace(/</g, '\\u003c')
    : '';
  // public/og.jpg (1200×630, rendered from the hero), hash-busted so previews refresh.
  const og = portal.siteUrl && existsSync('public/og.jpg')
    ? (() => {
        const v = createHash('sha1').update(readFileSync('public/og.jpg')).digest('hex').slice(0, 8);
        const src = escape(`${portal.siteUrl.replace(/\/+$/, '')}/og.jpg?v=${v}`);
        return `\n    <meta property="og:image" content="${src}" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n    <meta name="twitter:image" content="${src}" />`;
      })()
    : '';
  return {
    name: 'portal-html',
    transformIndexHtml: (html) =>
      html
        .replaceAll('%PORTAL_TITLE%', escape(title))
        .replaceAll('%PORTAL_NAME%', escape(portal.name))
        .replaceAll('%PORTAL_DESCRIPTION%', escape(description))
        .replaceAll('%PORTAL_API%', escape(api))
        .replaceAll('%PORTAL_URL_META%', url + og + (ld ? `\n    <script type="application/ld+json">${ld}</script>` : '') + analyticsSnippet(ga4))
        .replace('<meta name="twitter:card" content="summary" />', og ? '<meta name="twitter:card" content="summary_large_image" />' : '<meta name="twitter:card" content="summary" />'),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const api = (env.VITE_API_BASE || portal.api || DEFAULT_API).replace(/\/+$/, '');
  return {
    // PORTAL_BASE=/tools/tanauan-budget-portal/ builds for a sub-path of another site.
    base: process.env.PORTAL_BASE || '/',
    plugins: [react(), portalHtml(api, env.VITE_GA4_ID)],
    server: {
      host: '0.0.0.0',
      // Reserved in ~/projects/ports.md (transparency-portal). strictPort so a
      // collision fails loudly instead of moving the URL.
      port: 5132,
      strictPort: true,
      allowedHosts: ['dev.neonplayground.com'],
    },
    preview: { host: '0.0.0.0', port: 5132, strictPort: true },
  };
});
