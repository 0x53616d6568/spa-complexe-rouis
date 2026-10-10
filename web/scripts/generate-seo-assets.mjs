import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webDirectory = path.resolve(scriptDirectory, '..');
const index = await readFile(path.join(webDirectory, 'index.html'), 'utf8');
const siteUrl = index.match(/<link rel="canonical" href="([^"]+)"\s*\/?\s*>/i)?.[1]?.replace(/\/$/, '');

if (!siteUrl || !/^https:\/\//i.test(siteUrl)) {
  throw new Error('Set the verified production site URL in web/index.html before generating sitemap routes.');
}

const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const routes = ['/', '/services'];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${escapeXml(`${siteUrl}${route}`)}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(path.join(webDirectory, 'public/sitemap.xml'), sitemap, 'utf8');
