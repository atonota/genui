# GenUX URL policy

## Ownership and permanent contract

The product is **GenUX**, with `genux` used in technical identifiers. The public root is `https://atonota.github.io/genux/`. `docs/src/data/url-policy.json` owns the origin, hosting base, stable document IDs, canonical paths and legacy aliases. `catalog.ts` owns component slugs. Menus, discovery feeds and the Pages adapter consume these records.

**MUST** keep readable lowercase English words, hyphen separators and a trailing slash for documents. Files keep their extensions. Slugs describe the document's purpose, without dates, implementation frameworks, campaign parameters or repeated brand names unless the content itself requires them. A route's physical folder is not its information architecture.

**MUST** preserve useful published addresses such as `/components/button/`, `/tokens/` and `/getting-started/`. Do not migrate a sound address merely to reflect a new navigation group. **SHOULD** choose short, stable task nouns over internal terminology. **MAY** add a deeper route when a real content relationship justifies it; update the explicit route admission rules at the same time.

## Information architecture

All paths below are logical, relative to the public root or localhost root.

| Address               | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `/`                   | Overview and selected starting points                                     |
| `/components/`        | Complete component directory grouped by purpose                           |
| `/components/<slug>/` | One component's usage, examples, accessibility, API and source references |
| `/guides/`            | Integration and AI interface guides                                       |
| `/foundations/`       | Tokens, interaction rules and adaptive behavior                           |
| `/tools/`             | Color system and Theme Builder                                            |
| `/project/`           | Decisions, documentation contract, URL policy and notices                 |
| `/ai-ui/`             | GenUX validated intent and registered component rendering guide           |
| `/url-policy/`        | Published human-readable version of this contract                         |

Section IDs remain shareable fragments. Existing `?tab=` and other presentation state may remain in shared URLs but do not create another canonical document. Canonical addresses omit query strings and fragments. Do not convert every tab/filter combination into a crawlable route.

## Search and AI discovery

**MUST** server-render meaningful content and ordinary anchor links. Each canonical document has a unique title, description, absolute self-canonical address, matching Open Graph URL and truthful page structured data. Breadcrumb structured data uses linked visible ancestors and the current document. Localhost emits the same production canonical to avoid advertising an ephemeral address.

`/sitemap.xml` contains only canonical documentation routes. Do not add previews, aliases, source mirrors, code payloads or the 404 document. Do not invent update timestamps; omit `lastmod` until a meaningful source-controlled update date is available. `/url-manifest.json` exposes canonical documents and explicit logical aliases. `/llms.txt` is a non-standard convenience index pointing to the authoritative HTML; it is not an SEO requirement, a crawler access control or a ranking promise.

English is the server-rendered canonical language. The existing Turkish display toggle shares that URL. **MUST NOT** advertise Turkish hreflang/URLs pointing to untranslated duplicate HTML. Separate translated routes require real translated server output, self-canonicals, reciprocal language links and a deliberate locale mapping.

GitHub project Pages cannot set `https://atonota.github.io/robots.txt` from a file under `/genux/`. A project-level robots file would not govern this host, so none is emitted. The host-root request returned **404 on 2026-10-17**. This is observed status, not a promise about future crawler access. Host-root crawler policy and Search Console submission need the corresponding host/property ownership. This task does not modify a separate host repository or submit ownership claims. Search-crawler access and model-training permissions are independent decisions; do not silently change training permissions.

## Compatible migration

`/genux/` (the former logical guide path, published as `/genux/genux/`) now resolves directly to `/ai-ui/`. The public homepage remains `/genux/`. `/token-standards/` continues to resolve to `/tokens/`, with its existing section-specific mapping to `/standards/` preserved.

Static GitHub Pages aliases use replace navigation preserving the guide query/fragment, a no-script zero-delay refresh and a visible fallback. They are **not HTTP 301 responses**. Both aliases carry `noindex` and point their canonical to the destination. If hosting later supports server redirects, prefer a direct permanent HTTP redirect while preserving the same mapping. Never create redirect chains, loops or navigation links to retired routes.

The former repository's hosting base cannot be redirected by this repository alone. A redirect from a different repository requires deployment at that old location. Unknown routes use the recovery document with HTTP 404; never conceal missing content with a global homepage redirect.

## Extension and rejection gate

1. Add a useful document and its stable ID/path to `url-policy.json`, or a component to `catalog.ts`. Add its exact page-kind admission without widening unrelated route patterns.
2. Link it from the relevant directory. Provide a meaningful title/description and ordinary HTML content.
3. For a migration, retain the retired route, declare a direct canonical target, and preserve meaningful fragments. Keep old fragment contracts separately when a document splits.
4. Run `node --test docs/tests/url-policy.test.mjs docs/tests/documentation-presentation.test.mjs`, `npm run docs:lint`, `npm run docs:check` and `npm run docs:build` from the repository root. For a hosting/route change also run `GENUX_DOCS_PAGES=1 npm run docs:build`.
5. The `docs-url-policy.mjs` integration validates the **final artifact**, after the Pages adapter: canonical metadata, unique titles, registry coverage, crawlable navigation, sitemap parity, direct aliases and noindex 404. The existing presentation and asset gates remain intact. Inspect one narrow and one desktop browser flow for directory navigation, redirects and visible keyboard focus.

A local build does not prove publication or indexing. Report the exact deployed commit and verify live responses before calling a release current. Search rankings, AI citations, real devices and unrun browsers remain outside these checks.

## Official references

- [Google: URL structure](https://developers.google.com/search/docs/crawling-indexing/url-structure)
- [Google: canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google: sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Google: AI features](https://developers.google.com/search/docs/appearance/ai-features)
- [Google: localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [OpenAI: crawler controls](https://developers.openai.com/api/docs/bots)
- [Astro: static routing and redirects](https://docs.astro.build/en/guides/routing/#redirects)
