# Live site SEO handoff

This guide is for the colleague who deploys and manages the live site. The workspace and `.env` in this repository are for local development; no local setting here proves what is configured on the live host. Do not copy local credentials into the host or commit secrets.

## Before deploying a frontend change

1. Pull the reviewed code and run the production frontend build.
2. Confirm the live canonical domain with the business owner. Use one HTTPS hostname consistently; redirect alternate hostnames to it.
3. Update the canonical and social URLs in `web/index.html`, plus the sitemap URL in `web/public/robots.txt` and every sitemap entry in `web/public/sitemap.xml`, if the live hostname differs from the repository default.
4. Deploy the frontend and open `/`, `/services`, `/sitemap.xml`, and `/robots.txt` on the live hostname.

## Check routes and sitemap

- `/sitemap.xml` should return `200`, an XML content type such as `application/xml` or `text/xml`, and well-formed XML.
- Include `/` and `/services`. Add `/services/{slug}` only when that slug is returned by the live `GET /api/services` endpoint and its page displays that real service.
- Keep utility and unfinished policy pages out of the sitemap. Privacy and visit-policy pages currently contain setup copy and are marked `noindex`; publish them after the business approves final content.
- Open a valid service URL directly in a new browser session. It should load the service page and its metadata. Open a made-up slug too; the current SPA fallback can return `index.html` with status `200`, so a platform function or server route is needed for a true `404` without breaking valid deep links.
- Inspect “view source” (not only the browser’s live DOM). The app is client-rendered, so the source currently has a small `<noscript>` fallback rather than the complete page. Search and social crawlers may not all render it the same way. Server rendering or route prerendering is a separate deployment change.

## Crawler and search checks

- `robots.txt` allows general crawling and explicitly allows OAI-SearchBot. It disallows GPTBot. Make sure the host/CDN firewall does not block the permitted crawlers.
- Verify the canonical domain in Google Search Console and Bing Webmaster Tools, submit `/sitemap.xml`, then use their URL inspection tools on the homepage, service catalogue, and a real service page.
- Check the sitemap and routes again after deployment. Do not rely on local Vite responses to establish live status codes, headers, redirects, or crawler access.

## API and database

The frontend’s Netlify `_redirects` currently forwards `/api/*` to the Render API. Confirm that the live API URL, CORS/session settings, and production database environment are correct in the host dashboards. Keep credentials in host-managed environment variables. Do not run seed or schema-changing commands against production as part of a frontend deployment unless the database owner has explicitly planned that change.

## Current content blockers

- The verified local price list is in Tunisian dinars, while the included demo seed data uses generic Nigerian-naira services. Confirm and import the real catalogue, categories, durations, and currency before relying on live service details.
- The business facts sheet still needs the owner-approved address, hours, contact details, timezone, policies, and canonical domain.
- Do not add LocalBusiness structured data until those facts are confirmed and visible on the site.
