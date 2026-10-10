# Complexe Rouis: SEO, AI discovery, UX and content improvement plan

**Prepared:** 7 October 2026  
**Site reviewed:** [spa-complexe-rouis.netlify.app](https://spa-complexe-rouis.netlify.app/)

## Executive summary

The site has a strong starting point: a clear spa/beauty concept, a substantial service catalogue, dedicated service URLs, and prominent booking calls to action. But it does **not yet look ready to send customers to**. The public pages contain explicit demo/setup copy, contact details are placeholders, business hours conflict, and the catalogue mixes French and English plus **DT and NGN** prices. Search visibility also has a critical technical risk: the homepage's raw HTML is an empty JavaScript app shell, and `/sitemap.xml` currently returns that shell as HTML rather than an XML sitemap.

**Recommended order:** make the business information true and consistent; make every important page crawlable and indexable; establish the business in local search; improve service pages and booking UX; then measure and refine. There is no guaranteed way to make a site appear for a search or AI answer, but these steps improve eligibility and the clarity of the information systems can discover.

## What I observed

- `robots.txt` returns `User-agent: *` and `Allow: /`, but no sitemap URL is listed.
- `/sitemap.xml` responds with the app's HTML shell, not an XML sitemap.
- The fetched raw homepage HTML has no H1 or rendered page copy—only a React root—while the rendered page shows meaningful content. This can make discovery and indexing less dependable for crawlers and previews.
- The same general site title/description appear in the shell rather than specific metadata for each service URL.
- The homepage and policies page say hours are 09:00–19:00, while the policies page's day-by-day schedule says 09:00–18:00.
- The address, city, region, phone and email are placeholders. The privacy and cancellation pages explicitly say their content is a template/demo.
- Service listings mix French and English, use both `dt` and `NGN`, and include English-only services alongside French services. Several service families appear miscategorized; for example, Hammam is listed under Épilation.
- Service detail pages provide a title, short description, price and duration, but little decision-making information. The footer contains an unexplained “ok” string.

## Prioritized plan

### P0 — Resolve launch blockers before promoting the site

1. **Confirm the business facts with the owner.** Collect the official name, exact address and map pin, city/region/country, local phone and email, real opening schedule and timezone, booking method, and social profiles. Decide the primary site language(s) and the correct local currency/ISO currency code. Do not infer or publish missing details.
2. **Replace demo content everywhere.** Rewrite the Policies and Privacy pages with the actual approved information, including booking/cancellation rules, accessibility/contact route, data collected, booking-provider handling, retention/contact details, cookie/analytics behavior, and effective date as applicable. Have the business's appropriate adviser review legal/privacy language for the actual jurisdiction. Remove every “Update…”, `example.com`, “Demo/setup notice”, “template”, “not legal advice”, and unfinished footer label before real bookings are accepted.
3. **Make public content available to crawlers without relying on browser JavaScript.** Pre-render or server-render the homepage, service catalogue, each service detail, contact/location and policies pages. Verify that an ordinary no-JavaScript request gets the real page copy and route-specific title/description—not an empty app shell. Keep unknown service URLs as real 404 responses rather than soft-404 pages.
4. **Repair the sitemap and route metadata.** Serve a valid `application/xml` `/sitemap.xml` listing only canonical, public, useful URLs; exclude cart, sign-in, admin, and other private or utility pages. Add the sitemap URL to `robots.txt`. Give each public route a unique title, meta description, canonical URL and social-share preview. Verify in Search Console and crawler inspection tools.
5. **Reconcile business facts across the site and booking system.** Display one approved hours schedule in the header, policies, booking availability and structured data. Ensure the timezone and currency used at checkout match the visible service prices.

### P1 — Become findable for local service searches

1. **Establish the real business entity.** Claim/verify the Google Business Profile and populate its category, name, address/service area, phone, hours, booking link, services and genuine photos. Verify the website in Google Search Console; add the property to Bing Webmaster Tools. Keep name/address/phone/hours consistent on the site and legitimate local directories.
2. **Build service-and-location landing pages.** Create useful indexable pages for major real categories—such as facials, hair, nails, brows/lashes, hammam, massage and hair removal—plus individual high-demand services. Use the actual city/neighbourhood only after it is confirmed. Avoid thin pages that merely repeat a keyword or copy the same paragraph across many services.
3. **Improve service detail pages.** For each service, clearly state what it is, who it suits, what is included, duration, confirmed price, preparation/aftercare, booking/cancellation notes, and a direct booking action. Add FAQs only when the business can answer them accurately. For procedures such as microneedling, keep claims factual and have safety/contraindication guidance reviewed by a qualified professional; do not promise medical outcomes.
4. **Add accurate structured data.** Consider `DaySpa`/the most appropriate `LocalBusiness` subtype with confirmed name, address, phone, URL, hours, coordinates and official images, plus `Organization` and breadcrumbs where useful. Any markup must match visible page content. Test it; do not promise that markup guarantees a rich result or an AI citation.
5. **Improve internal links and images.** Link category pages to individual services and back with descriptive anchors and breadcrumbs. Use original, compressed salon/spa photos, descriptive filenames and useful alt text; do not use image text as the only source of service or price information.

**Example title pattern:** `Soin Hydrafacial à [Ville] | Complexe Rouis`  
**Example description pattern:** `Découvrez le soin Hydrafacial chez Complexe Rouis à [Ville] : [bénéfice vérifié], 60 min, [prix confirmé]. Consultez les disponibilités et réservez.`

### P1 — Improve reach in ChatGPT and other AI-assisted search

Treat this as **search eligibility and clear source information**, not a separate trick called “AI SEO.” Google's published guidance says its AI search features use the normal search eligibility/fundamentals; there is no special AI markup or file that guarantees inclusion. Bing likewise ties Copilot/grounding discovery to crawlability, indexation, clear content and authority. OpenAI says `OAI-SearchBot` is used to surface websites in ChatGPT search and recommends allowing it; allowing it does not guarantee a citation or placement.

- Keep Googlebot, Bingbot and (if the business wants to be eligible in ChatGPT Search) `OAI-SearchBot` able to fetch the public pages. `robots.txt` currently allows all user agents, which is a good baseline, but check Netlify/CDN/firewall rules too. Keep private admin, booking data and customer information protected; never make private routes public for SEO.
- Publish a real sitemap, crawlable internal links, unique service pages and clean canonical URLs. On Bing, consider IndexNow for changed URLs after the site and sitemap are correct.
- Make the business easy to identify in plain text: official name, city/neighbourhood, address, service area, hours, phone, services, prices, durations, booking URL and access/parking details. Keep these facts consistent on authoritative profiles as well as the site.
- Write concise, self-contained answers to common customer questions (e.g., duration, what is included, price, preparation, location and how to book), with headings and visible text. Use natural language and the real language(s) customers use; do not add unsupported facts, mass-produce near-duplicate pages, or create an `llms.txt`/AI schema expecting special ranking treatment.
- Track ChatGPT referrals where analytics permits and periodically test representative local queries in Google, Bing/Copilot and ChatGPT. Record whether the business appears and whether cited details are correct; search experiences vary by query, location and time.

### P2 — Make choosing and booking easier

1. **Clarify the homepage hero.** State what the business offers and where it is, in the selected primary language. Keep two distinct actions: **Book an appointment** and **View services**. Add a directions/contact action once verified. Replace generic stock-like imagery with real, consented interior/team/work photos.
2. **Simplify catalogue navigation.** Group services into a consistent taxonomy, correct category assignments, use one language per localized page, and provide search plus mobile-friendly category filters. Add filters for price/duration only if the data is reliable. Put prices in the same currency and format throughout.
3. **Strengthen service cards.** Show the service name, short benefit, duration and price clearly, with one primary “Book” action. Make card layouts easy to scan on phones; avoid competing “Add to cart” and “Book” actions unless cart purchase is genuinely a different, clear workflow.
4. **Improve the booking flow.** Show available times and the selected service/price/duration clearly before confirmation. Explain whether an account is needed, the cancellation rules and what happens after booking. Make the flow keyboard accessible, quick on mobile, and clear when no times are available.
5. **Build trust with real details.** Add a map/directions link, real contact channel, arrival/parking information, payment methods if confirmed, genuine reviews/testimonials with permission, and real staff/process photography. Use a visible route to ask questions.
6. **Review multilingual and accessibility details.** If French, Arabic and English are supported, translate all navigation, categories, policies, errors, booking messages and page metadata—not just the selector. Use correct `lang`/RTL behavior for Arabic, keyboard focus states, sufficient contrast, descriptive control labels and image alt text.
7. **Tidy visual consistency.** Use one consistent brand name, a restrained color/type system, consistent heading scales, spacing and buttons. Remove the stray footer “ok”; check the cookie banner's copy and behavior against the actual storage/consent setup and applicable local requirements.

## Placeholder replacement checklist

- [ ] Confirm the official brand spelling and logo.
- [ ] Replace address, city, region, country, map pin, phone and email across header/footer/policies/booking/schema.
- [ ] Confirm opening hours for each day, holidays, timezone and appointment availability.
- [ ] Confirm all service names, categories, descriptions, prices, currency and duration; remove the unrelated NGN entries if not applicable.
- [ ] Replace booking/cancellation policy with approved terms and ensure the booking flow enforces the same terms.
- [ ] Replace privacy template with real data-practice disclosures and verified contact/rights route.
- [ ] Verify cookie/storage behavior and consent choices against actual implementation and jurisdiction.
- [ ] Remove all demo/setup notices, `Update ...` labels, `hello@example.com`, “ok”, and unverified claims before accepting bookings.
- [ ] Test every language version, service URL, contact link, booking action and mobile layout.

## Suggested 30-day rollout and success measures

| Timing | Work | Evidence of completion |
| --- | --- | --- |
| Days 1–3 | Owner confirms facts, language, currency, approved policies and priority services | Signed-off source-of-truth sheet; no placeholder visible on public routes |
| Days 4–10 | Replace placeholder content; unify catalogue data and hours; fix footer and cookie UX | Manual page-by-page and booking checks; no conflicting facts |
| Days 7–14 | Pre-render/SSR key routes; valid sitemap/robots; route metadata, canonical tags, 404s | Raw HTML has real content; sitemap parses as XML; representative URLs tested in Search Console/Bing tools |
| Days 10–21 | Google Business Profile, Bing Webmaster Tools, LocalBusiness data, category/service landing pages | Verified profiles and markup passes validation with facts matching page copy |
| Days 15–30 | Homepage/service UX and mobile booking refinements; original photo set; analytics | Booking completion and contact clicks measured; mobile QA passed |
| Monthly | Query/referral review, profile/photo updates, content corrections and crawl checks | Track impressions/clicks by local service query, booking conversion, calls/directions, crawl/index status, and AI referrals/citations where observable |

**Interpret metrics realistically:** local rankings and AI citations are not guaranteed and may take time. Treat indexation, correct business facts, qualified visits and completed bookings as the measurable outcomes—not a promise of a particular ranking.

## Official guidance

- [Google Search Essentials](https://developers.google.com/search/docs/essentials)
- [Google AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google Local Business structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [Establish your business details with Google](https://developers.google.com/search/docs/appearance/establish-business-details)
- [OpenAI crawler overview](https://developers.openai.com/api/docs/bots)
- [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)
