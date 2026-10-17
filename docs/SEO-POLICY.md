# GenUX SEO policy

## Purpose and scope

Help people find, understand and use the documented GenUX component system. Search and AI discovery consume the same factual public documentation. This contract covers the GenUX site, metadata, content structure, assets, canonical routes, discovery files, package identity and release admission. It builds on [URL-POLICY.md](URL-POLICY.md); it does not replace approved brand, screen surfaces, controls, focus, motion, accessibility or adaptive-delivery decisions.

`docs/src/data/seo-policy.json` owns machine-enforced site identity, social asset, schema profiles and measurement targets. `seo.ts` produces the shared head. The URL registry and component catalog continue to own addresses; do not copy another route registry into SEO configuration. `tools/docs-seo.mjs` validates completed HTML after the presentation gate and emits its report before Pages asset validation. The existing Pages adapter and final URL gate then verify the based artifact; absolute SEO metadata remains identical under both hosting bases. These are contracts, not an SEO score or a ranking guarantee.

## People-first content — MUST

Each canonical document must serve one real task, with a clear heading, a useful opening summary and navigable named sections. Component references must retain their existing usage, live examples, accessibility, API and source references. Useful content and ordinary links must be server-rendered; essential information cannot depend on a model call, tracking consent or client hydration.

Explain purpose, when to use, limitations, inputs, outcomes and available evidence. Distinguish recorded demonstrations from live AI/server behavior, and shipped code from plans. Support technical claims with actual code and authoritative references. Maintain the approved readable typography, user zoom, 320 CSS px flow, keyboard access and semantic structure. Do not trade these for keyword density or a performance score.

Editors MUST review correctness and usefulness before publication. The static gate checks structure and metadata, **not** the truth or usefulness of prose. Never fabricate an author, review date, citation, customer, review, price, statistic or benchmark. Do not publish doorway pages, keyword-stuffed copies, hidden search-only text or mass-produced pages with no distinct purpose. SHOULD answer the reader's question directly before expanding detail; MAY add a comparison or FAQ only when useful and supported by real content.

## Identity, metadata and structured data — MUST

Use the approved `GenUX` / `Gen UX` / `genux` identity and actual public repository. Each canonical page has one unique descriptive title and summary, one absolute canonical URL, consistent Open Graph/social metadata, a meaningful social-image alternative, explicit indexing/snippet directives and an accurate source language. Do not impose arbitrary title/description character counts as ranking rules; describe the page clearly without repetition.

Use WebPage for general pages, CollectionPage for real directories and TechArticle for technical references. The shared graph identifies the website and actual SoftwareSourceCode project, with repository and existing license references. Breadcrumbs describe linked, visible ancestors. A schema type is not evidence of a Google rich-result feature. Never invent Review, Product offers, SearchAction, author, rating or freshness fields. A new schema profile requires real corresponding content and an explicit admission update.

The shared PNG social card is a clearly branded fallback, not a fabricated screenshot or a claim that every page has a unique image. Editorial images SHOULD be specific, compressed, descriptively named and relevant; MUST have an explicit alternative (empty for decorative images) and intrinsic dimensions. Interactive component previews keep their separately owned image contracts. Regenerate the fallback only with the installed browser using `node tools/docs-social-image.mjs`; it is not a production build dependency.

## Crawl, index and language ownership — MUST

Follow the URL policy for stable paths, query/fragment state, sitemap, aliases and real 404 responses. Canonical references remain indexable and snippet-eligible. Preview HTML, retired aliases and the 404 page remain noindex. Keep CSS, JS and font resources available; do not block duplicates in robots before crawlers can read their noindex/canonical instructions. Source/code mirrors and machine reports remain auxiliary and outside the sitemap; exclusion alone is not a noindex guarantee.

English is the server-rendered language. The existing Turkish display toggle does not create a separately published translation. Add locale URLs/hreflang only with actual translated HTML, self-canonicals and reciprocal mappings. Do not silently redirect by guessed language/device or serve different factual content to crawlers.

GitHub project Pages controls `/genux/`, not host-root `robots.txt`, server response headers or other repositories. Do not pretend a project-path robots file or static Response header configures the host. Host-root policy, permanent HTTP redirects, Search Console ownership/submission and crawl/index reports require their actual host/property control. Record their state honestly rather than provisioning another project/account or changing unrelated infrastructure.

## AI search and reuse — MUST

Make definitions, instructions, examples, limitations and source references extractable from the same semantic HTML people read. Maintain clear project identity and unambiguous component names. Keep JSON-LD consistent with visible facts. The optional `llms.txt` and URL manifest point to canonical HTML; neither is required for Google AI inclusion nor establishes a right to training or a guarantee of citation.

Search crawling, interactive user retrieval and model training are separate policy concerns. OAI-SearchBot and GPTBot have different purposes; Google Search and Google-Extended also have distinct roles. This delivery preserves existing training permissions. Do not infer training consent from an AI-SEO request. Do not add bot-specific content, hidden prompt instructions, artificial authority claims or paid AI mention tracking without a specific need and authorization.

## Experience and evidence — MUST / SHOULD

Keep the existing conditional delivery and resource-ownership gates, self-hosted Outfit with swap, component state continuity and approved preview UI. Avoid adding client JavaScript for static SEO, third-party trackers or unnecessary dependencies. Use intrinsic image dimensions and relevant loading priority; do not blanket lazy-load a primary image or preload every resource.

SHOULD meet Core Web Vitals targets at the 75th percentile, measured separately for mobile/desktop: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1. These are real-user experience targets; HTML bytes, a build, a local screenshot or a single laboratory run does not prove them. Preserve existing project-specific byte budgets rather than inventing a new universal size ceiling. Add RUM/analytics only through a separate explicit data/consent decision.

## Admission and lifecycle

MUST run the focused SEO/URL/presentation tests, docs lint/type checks and the existing build. The build rejects missing/conflicting metadata, duplicate descriptions, unsupported graph claims, absent primary content, unsuitable editorial image markup and an invalid social asset; preview indexing protection stays in the presentation gate. It writes `seo-report.json` with static scope and unverified browser/indexing/AI-citation/Core Web Vitals fields. The report is not itself an indexable content page or a certification.

For route/head/hosting changes, verify both root and `/genux/` artifacts. Use one 320 CSS px and one desktop browser smoke, including no-JS content and visible keyboard focus. Seek independent read-only review for shared SEO contracts. Do not create a new broad test matrix or silently approve screenshots. Existing required CI remains in force. Do not install schedulers/cron, tracking or paid tools as a side effect.

Record local, commit, CI, deployment and actual live response proof separately. After release, inspect status, canonical/robots/social/schema and real resource responses. Search Console, indexing, field performance and AI citation evidence remain `not_run` / `not_proven` until actually observed. Review content and external references when a relevant dependency or product fact changes; use source history and human review rather than fake automatic “updated today” dates.

## Actual commands

From the repository root:

- `node --test docs/tests/seo-policy.test.mjs docs/tests/url-policy.test.mjs docs/tests/documentation-presentation.test.mjs` (the built-artifact SEO case needs a current local build).
- `npm run docs:lint` and `npm run docs:check`.
- `npm run docs:build`; hosting/head changes also `GENUX_DOCS_PAGES=1 npm run docs:build`.
- Existing bounded browser smoke and independent review; broader engines/devices are reported only when run.

## Authoritative references

- [Google: helpful, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google: title links](https://developers.google.com/search/docs/appearance/title-link), [snippets](https://developers.google.com/search/docs/appearance/snippet) and [structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google: AI features](https://developers.google.com/search/docs/appearance/ai-features)
- [OpenAI: crawler purposes and controls](https://developers.openai.com/api/docs/bots)
- [Web Vitals: field measurements and thresholds](https://web.dev/articles/vitals)
- [Open Graph protocol](https://ogp.me/)
