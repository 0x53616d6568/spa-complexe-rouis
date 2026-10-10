# Complexe Rouis SEO, UX, and content to-do list

Based on the review in [Complexe Rouis SEO, AI discovery, UX and content improvement plan](./Complexe%20Rouis_%20SEO,%20AI%20discovery,%20UX%20and%20content%20improvement%20plan.md).

This file tracks code/content work in the local development workspace. Live deployment checks for your colleague are in [Live site SEO handoff](./live-site-seo-handoff.md).

## Implemented in this pass

- [x] Add a valid XML sitemap and publish the homepage and service catalogue URLs; keep policy pages out of the sitemap until their placeholder content is replaced.
- [x] Add the sitemap URL to `robots.txt`.
- [x] Update route metadata in the browser for titles, descriptions, Open Graph, Twitter cards, and canonical URLs.
- [x] Keep Open Graph URLs and locale aligned with the current route and selected display language after client navigation.
- [x] Set French as the initial document language and add static homepage title, description, canonical URL, and Open Graph URL.
- [x] Add no-JavaScript homepage copy and links to the base document.
- [x] Link the footer to the exact Google Maps listing supplied by the owner.
- [x] Permit OAI-SearchBot and disallow GPTBot in `robots.txt`; these crawler rules are independent.
- [x] Mark booking, account, manager, admin, sign-in/up, and unknown routes `noindex` after client navigation; valid public routes remain indexable and links remain followable.
- [x] Keep placeholder privacy and visit-policy pages `noindex` until approved content is supplied.
- [x] Move Hammam out of the hair-removal category in the locally maintained service catalogue.
- [x] Add descriptive alt text and lazy loading for catalogue images; prioritize the service-detail image.
- [x] Add a fill-in business facts sheet for owner-approved location, hours, currency, services, and policies.

## P0 — Required before promoting the site

- [x] Confirm the official business name, address, map pin, city/region/country, phone, opening hours and timezone, and social profiles from the owner-supplied listing (10 Oct 2026).
- [ ] Confirm the public email, booking method, primary languages, and currency before publishing or reconciling production settings.
- [ ] Replace placeholder business/contact details throughout the site and booking system with owner-confirmed values.
- [ ] Reconcile catalogue data before seeding production: the supplied price list is in Tunisian dinars, while the demo seed contains generic Nigerian naira services; listed service durations also need owner confirmation.
- [ ] Approve real booking, cancellation, privacy, data-retention, and cookie disclosures; replace demo/template policy text.
- [ ] Apply the confirmed 09:00–19:00 daily schedule to the live database and verify booking availability uses `Africa/Tunis`. The Rouis seed is updated; the currently running local DB still reports generic 09:00–18:00 demo settings.
- [ ] Render public page content and route-specific metadata into the initial HTML; the site is still a client-rendered React app. The `<noscript>` fallback only helps visitors and parsers that do not run JavaScript; it is not SSR or prerendering.
- [ ] Return real 404 responses for unknown service URLs; Netlify currently rewrites SPA routes to `index.html` with status 200.
- [ ] Confirm the production website domain in the business facts sheet; the repository's default domain is only a deployment setting. See the [live site handoff](./live-site-seo-handoff.md).
- [ ] Add real active service URLs to the sitemap after deployed service slugs are confirmed. The static price-list IDs and demo seed database slugs differ; guessed detail URLs were removed.
- [ ] Check the deployed site with crawler inspection tools and ensure sitemap responses use XML content type; see the [live site handoff](./live-site-seo-handoff.md).

## P1 — Local discovery and service content

- [ ] Verify the Google Business Profile and add confirmed business details, services, hours, booking link, and consented original photos.
- [ ] Verify the site in Google Search Console and Bing Webmaster Tools.
- [ ] Create useful category and service pages using confirmed location and service information; avoid duplicate/thin pages.
- [ ] Improve each service detail page with confirmed inclusions, duration, price, preparation/aftercare, booking notes, and accurate FAQs.
- [ ] Add LocalBusiness/DaySpa structured data only after the marked-up business facts are confirmed and match visible content.
- [ ] Add category links, breadcrumbs, descriptive image text, and optimized original photos.
- [ ] Verify Googlebot, Bingbot, and OAI-SearchBot access through the deployed host/CDN; `robots.txt` allows the public pages but cannot confirm CDN/firewall access.

## P2 — Booking experience and trust

- [ ] Update the hero with the confirmed location and business language; add directions/contact actions after verifying them.
- [ ] Standardize service names, language, taxonomy, category assignments, prices, and currency.
- [ ] Review mobile service-card actions and simplify booking choices where appropriate.
- [ ] Clarify selected service, price, duration, account requirements, cancellation rules, and confirmation steps through booking.
- [ ] Complete French, English, and Arabic translations and review RTL, keyboard navigation, contrast, labels, and mobile layouts.
- [ ] Remove remaining demo/setup notices and confirm cookie/storage copy matches actual behavior.

## Ongoing

- [ ] Track search impressions, qualified visits, bookings, contact/directions clicks, crawl/index status, and referral sources.
- [ ] Review business profile details, service content, and crawlability monthly.

## Waiting on owner-provided facts

The plan explicitly says not to infer or publish missing business facts. Use the [business facts confirmation sheet](./business-facts-confirmation-sheet.md) to collect approved details before completing the placeholder, policy, location, hours, currency, and structured-data tasks.
