Current PDF delivery acceptance is DONE for its defined shared patterns and consumers.
Independent review04 retained both lifecycle fixes; its remaining documentation-only
finding was corrected without new tests. This is not product-wide CI/device certification.
The two media lifecycle defects from review03 have genuine RED and same GREEN
records; scoped TDD is 6 existing files / 13 planned scenarios, with only two
new regression cases for observed defects and no persistent new test file.

# Atlas Components documentation

Static Astro documentation, React islands and real Ant Design 6.6.6 examples.
The single-file atlas remains maintained in its original CSS/DOM sources and
Downloads output; the documentation is a separate application. Pixel equality
with the existing HTML is not claimed.

## UX standards and reference coverage

[UX-STANDARDS.md](UX-STANDARDS.md) is the complete recommendation-to-Atlas
crosswalk for the supplied Refactoring UI reference: all 49 main topics plus its
concluding practice section. It defines the Atlas adaptations, current source
counterparts and remaining work. The 15 October 2026 UX completion delivery added
six component pages registered through `src/data/catalog-ux-patterns.ts`: media
(MediaFrame and an original-size recorded Screenshot), content patterns
(IconList, Quote, AvatarGroup), carousel, local-only upload, rich menu and
multi-series chart. A follow-up adoption closed the five remaining partial rows
(icon calibration, action hierarchy, one elevation scale, screenshot and favicon,
image inner edge) without new routes. Written coverage is complete; all 23 former
gap/partial rows are implemented for their identified consumers and none remain
partial.
Product-wide runtime verification is not claimed. The human
clarified on 15 October 2026 that authorized implementation continues with
only the minimum mandatory tests inside the requested TDD scope; a later test is
allowed only as the minimum check for newly requested behavior or a confirmed
defect, with no fixed numerical correction-round limits.
Written standards do not establish acceptance of outstanding implementation.

## Documentation typography

The user's 2026-10-14 documentation decision uses Ant Design's native CSS pixel
measurements, without automatic rem conversion. Readable text is at least 14px;
the body baseline is 14px with a 22px line height. The default and recommended
font is [Outfit](https://fonts.google.com/specimen/Outfit?preview.script=Latn),
with default weight 400 and minimum 300, including headings and labels.
Code keeps its monospace family. See the
[Ant Design font specification](https://ant.design/docs/spec/font/).

Keep the browser's root font size and zoom preferences intact. This documentation
exception preserves 48/56/64px Buttons, handles of at least 32px and coarse-input
targets. The approved/non-documentation and Storybook profiles retain their
existing 16px/rem behavior; historical reports and global policies are unchanged.

## Source boundaries

| Source                                | Responsibility                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/data/catalog.ts`                 | English technical guidance, API reference and typechecked TSX examples               |
| `src/data/atlas.json`                 | Data generated from the existing model by `docs:data`; do not edit manually          |
| `src/styles/atlas-shadows.css`        | Tokens generated from the existing shadow recipes                                    |
| `src/react/AtlasProvider.tsx`         | Scoped native-pixel documentation theme, locale, stable CSS variable key and portals |
| `src/react/*Demo.tsx`                 | React islands loaded only by their component page                                    |
| `src/react/*Examples.tsx`             | Accordion, Form and Drawer application examples                                      |
| `src/react/keyboard.ts`               | Scoped Space support for AntD 6.6.6 Collapse headings                                |
| `src/i18n.ts`, `src/react/useI18n.ts` | Shared locale store, translation, formatting and search normalization                |
| `src/locales/tr/`                     | Lazy-loaded Turkish dictionaries for docs, React and legacy content                  |
| `src/ssr/styles.ts`                   | Per-page cache and SSR style extraction during build                                 |
| `src/styles/`                         | Semantic tokens, responsive documentation shell and shared component styles          |
| `src/pages/`                          | Static Astro routes with content, live examples, code and API tables                 |
| `tests/`                              | Behavior and generated page/asset contracts                                          |

Do not introduce class/DI/MVC layers. Local state belongs to React components,
content to the model and shared appearance to providers/tokens. Form submissions
perform local validation only. They do not represent a server, actual loading,
persistence or AI operations.

## Language

The **Data workspace** navigation group contains four experimental component
pages: `/components/data-table/`, `/components/collection-views/`,
`/components/record-details/` and `/components/record-forms/`. They adapt reference
data arrangements to the existing Atlas identity. Mobile and desktop examples
share fictional records and persistent draft ownership. These examples do not
approve a component decision, add Storybook stories or implement a production
ERP/backend/AI service. The legacy standalone HTML remains a separate application.

English is the canonical source, default UI and initial HTML language. The EN/TR
controls switch documentation and live components together. Turkish is secondary;
its dictionaries and Ant Design locale are loaded only after selection or restoration
of an explicit saved preference. The `atlas-locale` preference survives document
navigation. Storage failure leaves language changes usable.

Static text uses English phrase keys on leaf `data-i18n` markers. Attributes use
`data-i18n-aria-label`, `data-i18n-placeholder` and the matching shared attribute
markers. React content uses the shared hook. Code blocks keep English source when the
surrounding documentation changes language. Translate validation, accessible names,
status feedback and library controls alongside visible copy. Keep machine identifiers,
API properties, option values and stable story IDs unchanged. Use context-specific
English messages where translations differ. Locale changes update the existing tree
and preserve values, selection, open panels and focus. Component search normalizes
stable English names/slugs and translated visible names.

## Commands

Run from the project root:

```sh
npm run docs:dev
npm run docs:check
npm run docs:test
npm run docs:build
npm run docs:test:site
npm run docs:verify
npm run docs:browser:check
npm run docs:browser
npm run docs:preview
npm run verify
```

`docs:verify` runs docs gates in order. Site tests run after build and do not
create or approve visual references. `npm run verify` is the independent legacy
atlas regression gate.

`docs:browser:check` checks Playwright types and test discovery without launching
a browser. `docs:browser` is the separate Chromium/Firefox/WebKit desktop and
touch test command. Discovery is not execution. Failure screenshots are candidates,
not automatically approved visual references.

Astro 7 supports background preview in the agent environment. The script runs inside
`docs/` so a relative `--root docs` is not resolved twice in a fork. The terminal
shows the preview address. Local preview does not deploy production or create public
access.

## Design contract

Smooth entry and exit are mandatory for normal visual changes. The shared source is
`src/data/motion.json`; `docs:data` generates CSS tokens and the AntD provider
consumes the same source. New components use `.atlas-control` and semantic duration
tokens. Linear/steps/one-way easing, transition-free or zero-duration normal changes
and inline motion overrides fail the source acceptance guard in `docs:verify`.
It applies equally to human and AI contributions. Reduced motion, input, ARIA and
immediate keyboard focus remain intact. See the [contribution contract](../CONTRIBUTING.md).

Only explicit user approval changes the decision list. Preserve Outfit (default weight 400, minimum 300), minimum 14px documentation text, natural 0 px letter spacing, approved radii/sizes/borders, 0.9→1 hover
and the fixed body with 4 px bottom/2 px top layers. No gradients or moving button
bodies are allowed. Public sizes are sm/md/lg 48/56/64px. Default, Hover, Pressed,
Disabled and one Processing state remain; Processing blocks repeated activation.
Solid, outline, pastel-filled, text and link surfaces use the common master. The 24
color families inherit the Color system. Documentation primary is #0099ff, tactile
feedback116.667ms and transient click feedback400ms, all with shared Cubic motion.
Double/triple groups use one native single-selection wrapper. Storybook source
and configuration are excluded from this refresh; shared model consumers inherit
updated approved sizes/states.

Keyboard focus uses one visible indicator that does not surround the control:
text/edge marks on links, buttons and headings, a reserved single edge on fields
and an attached mark for icon actions. Select uses a branded AntD popup rather
than a native operating system menu.

Start at 320 CSS px. API tables scroll inside their container; headings do not break
midword. A single navigation and island preserve React form state across width
changes. Reduced motion disables unnecessary CSS animation. Coarse input can expand
a compact button hit area without changing its visible dimensions.

## Evidence and limits

Actual check results are recorded in `../evidence/docs-verification.json`, with
logs and browser evidence alongside them. Node/JSDOM interactions are not browser
tests; a static import graph does not prove actual transfer. A new screenshot is
neither an approved visual reference nor proof of pixel equality with the old HTML.
Report unexecuted Chromium/Firefox/WebKit, physical-device, CI and visual-diff checks
as `not_run`. Do not bypass the previous file:// policy denial through another
surface, renderer, server, URL or browser.

The Outfit OFL and icon MIT notices appear in full on `/licenses/`. This work does
not select a project license, change repository visibility or publish the application.

## Shared Storybook sources

Nine existing React demo exports are imported directly by Storybook 10.2.19 /
React-Vite. AtlasProvider, Outfit fonts, token sources and stylesheet order are shared.
Documentation's native-pixel typography is an explicit appearance scope; approved
Storybook typography retains its existing 16px/rem profile.
Do not duplicate demo render code or decision lists. Astro SSR extraction stays
inside Astro build. The integration does not redesign components or prove pixel equality.

`npm run storybook` binds only to `127.0.0.1:6007`.
`storybook:check` checks formatting and strict TypeScript; `storybook:build`
creates `storybook-static/`; `storybook:verify` adds the story index contract.
Actual browser smoke remains separate and follows the existing surface/time limits.
See [the Storybook guide](../storybook/README.md).

## Light and dark appearance

The header Dark theme switch updates documentation and Ant Design examples together.
Storybook has a switch for the same preference. `src/theme.ts` owns appearance
tokens and the `atlas-theme` preference. Initial appearance uses a saved preference
or the system setting. Theme changes preserve the React island and entered values
without adding a decision variant. The provider uses the official Ant Design
[darkAlgorithm contract](https://ant.design/docs/react/customize-theme/).

Build prepares global and component CSS variables for both themes and inserts normal,
theme-scoped CSS into the head. The bootstrap selects the theme before first paint.
Temporary light variables during hydration must not override dark appearance.
CSS-in-JS SSR styles and cache ownership are preserved; content stays visible during
hydration. `docs:test:site` checks both theme variable sets and verifies foundation
pages do not carry component CSS or React.

## Form field surfaces

Visible fields and copyable code use `filled`. Input, InputNumber, Select and Form
share that default without a surface selector. Normal, error and warning states
reserve identical border geometry: transparent normally, with only the color changing
for errors/warnings. Do not remove border space with `border: none`/`0` or hide
the element with `display: none`. DocsLayout alone imports `web.css`, which keeps
outer solid border widths and the existing bottom focus edge stable. Affix inputs
must not acquire a second border. SSR and client use the same demo tree.

Storybook continues using default exports and does not import web-only CSS. Web
experiments move to Storybook only with explicit user approval and instructions.
No new decision entry follows from a web experiment.

Search, password, numeric, multiline and status fields use the same filled surface.
Normal fields have no visible surrounding border in either theme. Shared `fieldBg`,
`fieldFilledBg` and `fieldHoverBg` tokens make light/dark gray fields darker than
page and panel backgrounds. Theme and locale changes must not reset text or selection
through keys or newly created component trees.

Preserve the existing measured flat/semi-flat shadow recipes. Web text/numeric inputs
may use the explicitly approved thin inset depth from `--input-inset-shadow`;
Select does not inherit it. Error/warning fields may retain full red/orange borders.
Semantic action colors and a visible non-surrounding keyboard indicator are preserved.
Color/depth references do not authorize gradients or a new visual style.

An open dropdown adds 1px background blur and slight dimming while its trigger and
popup remain sharp. Existing soft/flat shadows apply. Ant Design manages selection,
Escape and outside clicks. Mouse/touch selection must not leave a permanent white
underline; keyboard use shows one focus indicator. Astro and Storybook share the
applicable source behavior while preserving their scoped styling boundaries.

Reference review and preserved observations: [data workspace source record](../reports/data-workspace-reference-review-2026-10-13.md). Original user-source snapshots stay in the ignored local evidence archive; documentation builds do not publish them. The deepened report adds open proposals, not approved Storybook decisions. Workspace stylesheets are linked by route; copied examples explicitly import their shared and feature styles.

Documentation uses the full available width, including large desktop viewports. Sidebar and page contents retain their own tracks; prose keeps a readable measure and tables scroll inside their containers.
