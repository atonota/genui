# Astro documentation maintenance contract

## Capability-first adaptive GenUI and explicit TV focus — human task 2026-10-16

Newest direct human task: all GenUI components follow `ADAPTIVE-PLAN.md`. The
source architecture is implemented; per-component verification and publication
are separate. Source authors run no check; conductor receipts under
`adaptive-20261016` and the actual GitHub status are authoritative, no blanket
DONE.

- 61 runtime components (49 native + 12 generic) and 40 documentation slugs
  are separate counts, mapped in `src/adaptive/component-coverage.ts` as
  `implemented-unverified`; metadata never marks one `verified`.
  `src/adaptive/policy.json` alone feeds `policy.ts`,
  `adaptiveBreakpointTokens` and the generated Sass map; no hand copies.
- Human answer 2026-10-16 (`hem tab, hem tv`): Tab/Shift+Tab everywhere; in an
  explicit `data-adaptive-surface=living-room` boundary a handled directional
  key may open the SAME ringless mode via `requestSpatialInputModality`
  (`src/input-modality.ts`, existing bridge event, single owner). Width never
  means TV; generic web arrows never open the mode.
- `src/genui/adaptive.ts` derives `arrowsMoveVisualFocus` from
  `allowsSpatialVisualFocus`; `src/react/genui/AtlasGenUISurface.tsx` emits
  `data-adaptive-*` on its existing root and native boundary only.
- Phone continuity: `AdaptiveProvider` retains a measured phone journey until
  its continuity reset or `useAdaptive().releaseJourney`; no height or pointer
  heuristic (768x300 is tablet, 1280x400 desktop). `AdaptiveShell` `options`
  take only `surface` and `lockedProfile`; business state stays in unkeyed
  context and slots.
- Delivery: six profiles load only via the literal `layoutLoaders` registry in
  `src/adaptive/delivery.ts`; SCSS ships as `?inline` compiled CSS installed
  only into the Shell root's owner document. Initial HTML is the baseline with
  no profile CSS; multi-owner or foreign adaptive assets are rejected. Network
  proof covers external requests plus initial HTML and installed CSS.
- SSR guard: only a trusted host awaits `loadServerAdaptive(hints)`
  (`src/adaptive/server.ts`) and passes `environment`, `options` and the
  serializable `initialLayout`; `AdaptiveShell` uses it only for the matching
  profile. Static Pages stays on the baseline; no request-time SSR hosting or
  npm package is claimed.
- Portal ownership: body portals register in the provider-owned registry and
  pooled spatial adapter; the TV bridge is guarded by the nearest surface
  boundary. Nested Shells skip `defaultPrevented` and repeated Back keys.
- Tests are node:test (no Vitest; the proposed `src/*.test.ts` files were
  rejected): `tests/adaptive-policy.test.mjs`, `tests/adaptive-input.test.mjs`,
  `tests/adaptive-delivery.test.mjs` (8 cases) and the implemented browser spec
  `browser/adaptive-ui.spec.ts` (3 cases x 3 engines, 14 widths). Use the root
  scripts `docs:check`, `docs:lint`, `docs:format`, `docs:build` and the
  explicit browser types command. Results are pass/fail/not_run/
  not_applicable; physical devices stay pending, not excluded.

## Preview profile runtime contract — permanent, human task 2026-10-16

Permanent runtime contract for the isolated example preview; later entries
change it only through an explicit human decision. Results are PENDING: this
entry claims no executed check, no live or CI pass and no human approval.

- Initial load: every live example has three explicit profile URLs (small,
  medium, large). Each profile document is server-rendered once at build time
  as static HTML that GitHub Pages serves; there is no request-time SSR and no
  request-time device detection.
- After hydration, a profile switch dynamically imports only the selected
  layout entry (`previewEntrySources` in `src/preview/registry.ts`) and its
  preset inside the SAME iframe and the SAME business React subtree, so demo
  state is kept. The profile URL is synced through the bridge with
  `history.replaceState`; no document replacement, iframe reload or DOM
  snapshot scraping.
- Local preview token recipes are memory-only and scoped to that example; they
  are never written to the global Theme Builder 30-day store. The actual global
  Theme Builder stays on its explicit route, unchanged.
- Code view usage comes from `previewDeliveryUsage` and contains only the
  accepted `id`, `slug`, `theme`, `orientation` and `grid` values, never form
  data or other private business state inside the example. Source payloads
  render as escaped text only.
- Mandatory verification before any DONE: the docs package's configured
  format, lint, type-check, unit and build commands, plus the existing targeted
  two-case browser spec for the preview profile switch. Copy exact script names
  and the spec path from `package.json` and the Playwright config; they were
  not available when this entry was written. None of them has been run.

## Component page tabs, full-width rails and install guidance — human task 2026-10-16

Newest human task for component pages; it supersedes the 80rem split and the
100rem rail threshold below. Colors, fonts and type tokens are unchanged.
Results are PENDING: no check was run and no test was added.

- From 80rem: sidebar 224-248px flush left, 240px rail flush right, one
  centered article column of at most 1120px; reference wrappers use
  `display: contents`.
- Four tabs (Examples default) group the eight unchanged sections by
  `data-doc-panel`; `src/components/docs-page.ts` hides inactive sections only
  after load, syncs `?tab=` and legacy hashes, roves arrow/Home/End keys and
  filters section/contents links. No-JS pages show every section.
- DocsPageTools, DocsInstall (package.json versions, GenUI not on npm) and the
  ApiReference one-property-per-row split are new; repository links render only
  with `PUBLIC_GENUI_REPOSITORY_URL`.
- PENDING: translations, inspector, tests, build gate and browser checks.

## Black dark documentation shell and canonical sidebar search — human task 2026-10-16

Newest human task; a precise, human-authorized exception to the color freeze in
the entries below, for the dark shell only. Older entries stay as history.
Results are PENDING; this entry claims no executed check and no DONE.

- Only `canvas.defaults.dark` in `src/theme-builder/definitions.json` moves
  from `#191302` to `#000000`; theme.ts aliases `--paper` to `--shell-bg`, so
  the dark header, sidebar, Drawer, contents rail and footer turn black. Light
  values, panels, fields, accent, approved/Storybook `themeColors.dark.paper`
  (#242424) and the definition count stay; no new token, CSS black override or
  `!important`. Saved Theme Builder recipes are not wiped or migrated.
- The static SSR native `#component-search` keeps its label, i18n,
  autocomplete, DocsLayout filter and Drawer move (no island, hydration or JS)
  inside a canonical `.atlas-input-frame[data-atlas-input=text][data-size=md]`
  rendered by DocsNav from `inputSurfaceAliasVariables`, `inputPaddingInline`
  and the md atlas size profile. `src/styles/atlas-input.css` is the single
  paint owner (native-child reset covers `input.atlas-input-native`);
  focus-fields.css owns the Tab-only bottom marker; forced colors use the
  frame rules. Sidebar well copies in nav.css and shell.css are removed and the
  legacy placeholder rules in docs-accessibility.css only reach unframed inputs.
- Correction to the initial quiet search choice: AtlasInputFrame takes an
  optional `variant` typed from AntD `InputProps['variant']` (default
  `filled`, emitted as `data-variant`), forwarded by the AtlasInput wrappers
  and AtlasInputNumber. Only `[data-variant=underlined]` in
  `src/styles/atlas-input.css` paints the rest bottom edge with
  `--atlas-input-border` (fallback `--field-border`) at the unchanged 1px
  width; fill, inset shadow, radius, height and type stay, and status,
  disabled and forced colors still override it. The `filled` master look is
  unchanged; DocsNav opts the search into `underlined` with no paint copy.
  Rest and focus are separate: the resting edge needs 3:1 against the
  unfocused fill, the Tab-only marker 3:1 against the focused fill.
- Test accounting (authorized scope, not results): existing cases only, 0 new
  cases; no test run by the author. Outfit, 14 CSS px minimum, central roles,
  Cubic motion and ringless keyboard focus stay.

## Normal-laptop component detail presentation, colors frozen — human task 2026-10-16

Newest human task; it rejects the previous detail composition and supersedes
the dated shell-only ownership and the 1600px split threshold below for this
presentation case only. The frozen 59-package backlog is not new scope. Results
are PENDING; this entry claims no executed check and no DONE.

- Geometry only: every existing paint declaration keeps its exact value,
  selector and media context, and role colors are unchanged. Geometry only and
  no new JS refer to the shared shell: layout and shared styles, the 875px
  sidebar/native Drawer threshold, docs-shell.ts and the shell header stay
  unchanged. The existing shared preview renderer alone receives icon markup,
  central bounded device geometry and caption presentation, with unchanged
  native behavior, theme, state and Code privacy. Outfit, frozen type tokens,
  the 14 CSS px minimum, central roles, Cubic motion and Tab-only ringless
  focus stay; no new JS package, framework, asset profile, service or
  scrollspy. Layout styles keep their old paint context; new decorative device
  hardware reuses the existing preview chrome, sensor, panel and ink colors
  with no new palette or alpha.
- Owned: `src/components/shell/layout.css` and `src/styles/documentation.css`
  for shell geometry, plus the existing shared preview renderer
  `src/react/ExamplePreview.tsx`, `src/styles/preview-workbench.css` and
  `src/data/preview-devices.ts` (this case only; it supersedes the earlier
  preview-workbench.css exclusion).
  Shell geometry variables only: sidebar 14rem (224px) from 875px with the 16px
  inset and 48px targets; shell and page grid gap 24px; global spacing tokens
  unchanged.
- `article[data-component-detail]` splits from 80rem (1280px): showcase left,
  API/resources one continuous non-sticky right stack, `minmax(0, 1.65fr)
minmax(20rem, 1fr)` with a 24px gap (showcase >= 560px, reference >= 320px
  at 1280 and 1920); narrower layouts stack, 320px without page overflow. The
  far contents rail (16px padding) appears from 100rem (1600px) in layout.css
  and documentation.css alike; below it the Contents disclosure and section
  links stay. Eight section ids, order and content are kept; API tables keep
  their own scroller (full cell interaction not certified); prose 65ch.
- Device previews are bounded illustrations, not device emulation or detection:
  390/820/1280px stay preferred reference maximums, and central display caps
  (iPhone 260, iPad 400, MacBook 384 CSS px screen) bound the frame within its
  column without scaling. Phones and tablets keep portrait and the MacBook
  landscape proportions; every screen shares a 200px minimum and grows with its
  content. The Device · Theme caption sits above the frame and the toolbar
  centres. Known inner titles that duplicate the external heading, including
  the button playground's, are visually hidden (screen-reader only) in their
  known wrappers; external headings and anchors stay untouched.
- Test accounting (authorized scope, not results): the two existing
  `browser/component-preview.spec.ts` cases and the existing contents-rail case
  are adapted, 0 new cases; browser spec files 28, source test files 80. One
  independent review; the root conductor records actual receipts.

## Shell and shared documentation geometry, colors frozen — human task 2026-10-16

Newest human task; it supersedes the dated docs-spacing count below only for
this case. The preview workbench entry (164/40 rows, native behavior) and the
frozen 59-package backlog stay unchanged. This entry claims no executed check.

- Geometry, spacing and type hierarchy only: every existing paint declaration
  (color, background, border color/width/style, shadow, opacity, filter, fill,
  stroke, custom paint) keeps its exact value, selector and media context. No
  new paint, decoration, cards, gradients, sticky header or JS. Outfit, the
  current font and type tokens (frozen, unchanged), central roles, Cubic motion
  and Tab-only ringless focus stay; readable shell and shared documentation
  text stays at least 14 CSS px, and no text or control shrinks.
- Owned: `src/components/shell/{shell,layout,nav}.css` and
  `src/styles/documentation.css`; `docs.css`, `preview-workbench.css`,
  definitions, theme, docs brand and application components are unchanged;
  test changes belong to the test author only as listed under test accounting.
- Header: DOM/Tab order preserved, <=192px at 320px with 48px targets, one band
  from 875px. Sidebar: one start edge for title, search label, group labels and
  links; <=24px after a group's last row; desktop sticky scroll contained;
  Drawer padding only inside the Drawer. Contents rail 240/256px, 16px padding,
  touching 48px rows. Shell sections share `--doc-section-gap`; live previews
  use one inset step.
- Test accounting (authorized scope, not results): `browser/docs-spacing.spec.ts`
  2 -> 3, the only new case (test author); browser spec files stay 28, source
  test files 80. The root conductor records actual receipts. No PASS claim.

## Component preview workbench and detail layout — human task 2026-10-16

Newest human task; it supersedes the dated Badge/radius counts and status text
below as current scope, which stay history. This entry claims no executed check.

- Every logical leaf example cluster on all 40 component pages is wrapped once by
  the default export of `src/react/ExamplePreview.tsx` (`{id,title,children}`)
  with a literal, globally unique kebab-case id prefixed by its route. No dynamic
  or loop ids, nested workbenches or route-level wrapper over several clusters;
  navigation/category wrappers are excluded. Listy's 16 patterns and Badge's 10
  groups are wrapped individually. Storybook/approved consumers pass through.
- Controls: Device preview iPhone/iPad/MacBook (default MacBook; container widths
  390/820/1280 fitted to the available width, never scaled, text never shrunk),
  Preview theme Light/Dark (the shared shell theme for every group) and Example
  view Preview/Code. Children never remount or re-key; Code hides the preview
  without unmounting it. APG radio keyboard and Tab-only ringless focus.
- Code lazily requests `/preview-code/<id>.json` only when chosen, generated at
  build time by `../tools/docs-preview-code.mjs` and
  `src/pages/preview-code/[id].json.ts` from authored JSX (Source excerpt with
  source path/link, privacy and home-prefix redaction). Duplicate/dynamic ids fail
  the build; a fetch failure shows an error with retry.
- Detail layout: `article[data-component-detail]` holds the header and section
  links, a `[data-component-showcase]` column (usage, examples, code, astro,
  accessibility, notes) and a `[data-component-reference]` column (api, resources
  as one continuous non-sticky stack). The contents rail stays outside the
  article. `componentSections` in `src/data/documentation-rules.json` is now
  usage → examples → code → astro → accessibility → notes → api → resources; the
  structural gate and `tests/documentation-presentation.test.mjs` follow it with
  no new cases. `src/components/shell/layout.css` splits the article from 100rem
  (1600px) viewports and stacks below; 320px keeps the Contents disclosure. The
  rail stays 15rem/16rem with the 16px container inset.
- `preview-workbench.css` is in every component route's `routeSheets`, so SSR
  links and copied Astro examples agree. Resources name the workbench adapter,
  stylesheet, code endpoint and extractor; no GenUI capability is implied.
- Test accounting (authorized scope, not results): browser specs 27 -> 28 with
  `browser/component-preview.spec.ts`, 2 cases; source test files 80 unchanged,
  the presentation test only updates its expected order. One final read-only
  independent review of the actual diff and screenshots. No DONE/GREEN claim.

## Current authoritative project decision — 16 October 2026

Current project decision; it supersedes older current prose, including the
61- and 64-definition counts below, while dated entries and receipts stay
history. Rules belong to `/standards/`, definition-generated values to
`/tokens/`, behavior to each component page. Do not copy CSS into policy text.

- Tokens: 65 definitions in `src/theme-builder/definitions.json` = prior 61 +
  3 Badge size heights + 1 `listy-surface`; all 65 editable from the Tweaker on
  every one of the 40 component pages. Saved 51/57/60/61/64 recipes gain only
  missing defaults; HEX uppercase canonicalization is unchanged. Native AntD
  6.6.6 and existing dependencies only; no new package.
- Sizes: Listy 16 actual patterns on shared `AtlasListyItem`; Listy and
  Cascader rows compact 32/40/48 px (superseding the earlier Cascader regular
  48 px statement). Standard Avatar/Button/Input 48/56/64 px; Select items stay
  regular; rich descriptions grow. Badge outer 20/26/32 px including border,
  text default 14 px / 400.
- Radius: choices 0px, 3px, 5px, 100%, factory 5px; one edit sets Input, slot
  and Button to the same general value in both modes. Valid legacy numeric
  0..32 values stay exact until a choice. Intentional circle Avatars and
  explicit legacy gallery corners are preserved. Pill, Card and Checkbox doc
  defaults inherit the general role; the Button corner control shows
  `Use general radius` instead of a misleading fixed 5.
- Tweaker: each page offers its own native props, no fake generic placeholder.
  Common Size and preview states stay in memory while closed; the shared
  theme/token recipe persists 30 days under the existing key until history is
  cleared or it expires. Not every business state is persisted.
- Typography (repeated direct human project exception; do not re-ask): minimum
  12 CSS px, default 14, ideal reading 16; weight default 400, minimum 300;
  Outfit. Global host instruction files are not edited. Listy text defaults to
  14 px; a custom token may lower it only to 12 px.
- Surfaces: the input root reuses canonical `inputSurfaces.innerShadow` via the
  existing resolver, removing the duplicate blue shadow; fields `#ececec` /
  `#1b1b1b`, panels `#ffffff` / `#2c2c2c`, warm shell unchanged. One functional
  outer boundary when outlined, decorative inset well edge, no nested field,
  native border or extra shadow. Native Listy host padding/divider cleared so
  the outer row owns compact height. Section gap >= 16 px via semantic main
  spacing; TOC targets a 256 px rail with 16 px padding.
- Raw reference HTML and 31 images are local reference only, not published or
  copied; no navy colors. Current neutral GenUI roles stay. No fake AI.
- Test accounting (frozen authorized scope, not results): source files 80 -> 80,
  existing `neutral-field-surfaces` 1 -> 2 for the actual blue-shadow
  regression (only the new case executes). Browser files 26 -> 27: new
  Badge/radius file 2 cases, docs-spacing 1 -> 2, Listy 1 -> 2, Tweaker 2 -> 3;
  exactly 5 added cases. The first old Tweaker case is adapted to the choice API
  and rerun for 30-day retention; other old cases are not rerun. The ignored
  local Pages control and HTTP alias checks are separate. No new matrix, review
  round, catalog scan or frozen59 backlog. Logs stay local; one final
  independent diff review pending. Not runtime, CI or Pages proof.
- Publication: public MIT GenUI `main` at `atonota/genui`, karacaismail author
  and committer guard preserved. New work UNCOMMITTED; supplied fresh Pages
  artifact control reported GREEN, actual Pages deployment NOT YET LIVE. Local
  http://127.0.0.1:4324/ and https://atonota.github.io/genui stay separate.
  Source API: Pages-only machine-prefix redaction plus credential fail guard;
  old intentional Avatar/Media error fixtures stay on an exact allowlist only
  under that guard. No publication-complete claim; the live-host
  endpoint/authentication decision stays pending.

## Latest direct human decisions — 2026-10-16

Latest requests supersede older current prose in these scopes, not earlier
receipts. Rules belong to `/standards/`, definition-generated values to
`/tokens/`, and native Badge behavior to `/components/badge/`. Preserve eight
component sections and frozen59. Badge is not a new registry entry.

- Native AntD 6.6.6 Badge count/dot/ribbon and Tag labels/icons/close support
  use existing semantic colors, focus and motion. Badge heights 20/26/32 px
  are distinct from compact Pill 32/40/48 px. Target 64 definitions (61 + 3
  badge-size heights); old recipes gain only missing defaults. Generate tables
  and rule values from definitions. Add the Badge sizes group label in EN/TR;
  do not edit the other owner's translation index or Badge documentation.
- Radius choices are 0px, 3px, 5px and 100%, default 5px. One radius edit
  updates Input, slot and Button general sm/md/lg in both modes; preserve
  legacy valid numeric 0..32 values exactly until edited and display retained
  current values. Preserve independent non-radius roles, including dark body
  20px. Percentage CSS stays percentage, native numeric fallback is fully round,
  and intentional circle Avatars remain circles. Badge/body default weight 400
  does not replace the global/project minimum weight 300; retain 12/14/16 px
  project typography and Outfit, with no font shrinking.
- Existing layout standard governs the source owner's TOC repair: reported
  192px rail/padding zero becomes token gutters >=16px and readable rail
  > =240px, natural labels, sticky overflow and mobile Details without page
  > overflow. Do not duplicate layout CSS here.
- Supplied local receipts report `/components` GET 404 -> 200, canonical slash
  and declared redirect source, plus a 51-page root build PASS. No checks were
  run in this proposal. Explicit Pages authorization is
  https://atonota.github.io/genui; retain http://127.0.0.1:4324/ locally.
  Another owner handles deployment source. Local build, remote commit and
  actual Pages deploy need separate receipts: committed main proves neither
  preview nor deployment. Checkpoint 852f882 is earlier; new patches are
  UNCOMMITTED and new Pages publication is unproven.
- Current Badge/radius scope is RED, two cases, with source writers running.
  Keep historical 80 source files/26 browser specs labelled history. Authorized
  accounting is browser 26 -> 27 with two Badge/radius cases, existing
  docs-spacing 1 -> 2 for TOC and one local ignored Pages control. This is not
  permission for an additional test wave, review, matrix, catalog scan or backlog.
- Hermes native documentation phase produces a read-only SOURCE proposal for
  master admission. Build metadata is generated after all source integration;
  do not report premature unknown-token server errors before that build.
  Preserve MIT/public GenUI, Atlas source APIs/storage keys and karacaismail
  author/committer guard. No new dependencies, fake AI, screenshot navy palette,
  DONE/GREEN acceptance or new live-publication claim.

## Bounded defect closure — latest human summary 2026-10-15

Use one necessary regression per recorded defect and at most one final review
of those fix diffs. No whole-catalog or third full-surface review. New confirmed
security/data-integrity findings must be corrected; other findings go to the
non-blocking defect record. Reuse a completed focused review when accepted
production hashes still match main; do not duplicate closed work or passing tests.
Adapter checks remain in the single conformance table. Bridge/query-neutral,
action and Hybrid checks keep their own files. Frozen59 and pending live-host
endpoint/authentication selection remain binding. Report states, defect records,
test-file counts and measured agent peak/mean without substituting capacity.

## UX standards page and project overrides — human instruction 2026-10-15

Rules: `/standards/` (`src/pages/standards.astro`, Turkish
`src/locales/tr/foundations-standards.json`) with sections surfaces, typography,
size-radius, interaction-states, focus, layers, motion, layout and accessibility.
Values: `/tokens/` (Design tokens) generated from `src/theme-builder/definitions.json`.
The standards page reads the values it names from definitions/models and links to
the token tables; it never copies the catalog. Legacy `/token-standards/` anchors:
catalog ids resolve on `/tokens/`; `measurement-scales`, `surface-states`,
`motion-focus`, `layers` and `overlay-standard` are aliases inside the matching
standards sections without duplicated rule text (`migrations/p1-d-standards.json`).
Current policy references say UX standards for rules and Design tokens for values;
historical log/evidence paths keep their old names as history.

- Typography for this project's GenUI rules (latest direct human decision):
  minimum 12 CSS px, standard 14, reading 16, weight >= 300, Outfit. It replaces the
  14 px minimum in the current GenUI rules below; the four global instruction files
  are not changed here.
- Radius: one shared general radius, default 5 px, for every size family; input
  and slot use exactly the same radius when edited, superseding the concentric
  subtraction for radius only. The nested content-box size formula stays.
- Standard controls and Avatar 48/56/64 px; compact selection, Pill, Slider, list
  and Cascader rows 32/40/48 px; descriptions grow.
- Focus, overlay (Tooltip in, Toast/Notification out), central Cubic motion, shell
  role colors, the eight component sections, the frozen 59 packages and the pending
  live-host decision are unchanged. The physical project is now GenUI at
  `/Users/w6x/Developer/genui`; new content does not hardcode the repository path.
  Not evidence of passing checks or rendering.

## Consolidated standards update — human instruction 2026-10-15

Status (current, 2026-10-15): the eight consolidated packages are acceptance
GREEN on their own receipts: P0-A 2, P0-B table 1, P1-A full Tab scan 1 plus
pointer final 1 plus mode 1, P1-B 3, P1-C 1, P2-A 1 and P2-B 1. P2-C (Hermes)
passed ONE actual native Temporal dry run and the same two security regressions
are GREEN; native usage reports provider `openai-codex`, model `gpt-6.1-sol`.
The earlier install block was a misdiagnosis, resolved by a private HOME tools
link and validated runtime permissions; no vendor install/update,
authentication, configuration or pool change. Hermes code writes stay read-only
proposals. Record: atlas-temporal's
`evidence/consolidated-20261015/delivery.json`; `hermes-runtime-block.json` is
historical. That evidence root and its one-time command records are local,
untracked and not HTTP served. Human visual approval is PENDING; new gallery
`http://127.0.0.1:4324/genui-update-review/`, existing consolidated 128 retained.
Final local gates: build 50 pages, Astro check 307 files 0 errors 0 warnings
3 hints, lint 287 modules 70 styles 0 findings, format pass, browser TypeScript
pass; root source admission only, not CI. Earlier passed
history and the eight documentation sections stay.

- New explicit user packages: information architecture 3 GREEN (enhanced first
  menu case, final `ia-GREEN-visible-nav`, 3 -> 3), spacing 1 GREEN, font 1 GREEN,
  radius 1 GREEN (`radius-GREEN-options-ready`) plus one confirmed data-integrity
  regression `radius-GREEN-cross-theme` GREEN (1 -> 2, same file), size one
  23-surface table GREEN (`sizes-GREEN-checkable-hit`) and List 1 GREEN. Other
  theme roles stay independent; only the general radius is global.
- Frozen backlog: the old 59 packages stay 58 integrated plus 1 pending live
  endpoint/authentication decision; no catalog rescan or new backlog.
- Tokens: 61 definitions (51 legacy + 6 overlay + 3 compact + 1 weight); stored
  51/57/60-token recipes stay valid. Defaults: general radius 5 px everywhere and
  the exact same slot value; compact 32/40/48 px, regular 48/56/64 px; font
  minimum 12, standard 14, reading 16 px, weight >= 300 for this project only.
  `Atlas*` source APIs stay backward compatible; storage keys are unchanged.
- Tests: `tests/` keeps 80 source files; one font case was added to its existing
  file (2 -> 3 cases). Browser specs went 21 -> 26 files with 8 cases (7 for
  explicit new requests plus 1 actual cross-theme radius defect regression); no
  other browser case or file. No CI, Firefox, WebKit, device or visual claim.
- One read-only independent review: 2 critical functional/data-integrity
  findings FIXED via RED/GREEN. Open MINOR, non-blocking: radius editor prose
  says independent/unordered but the validator is ordered; legacy
  `/tokens/#colors`, `#typography`, `#size-radius`, `#motion-focus`, `#overlay`
  bookmarks; simple List labels nowrap/ellipsis vs the wrapping catalog. No
  further review rounds.
- Open, non-blocking: the old slot-marker and well-shadow review finding is
  recorded, pending a future human decision. Dark-shell sidebar search measures
  fill contrast 1.07 and boundary 4.67; report only, not recolored.
- Physical project: `/Users/w6x/Developer/genui`, MIT, public `atonota/genui`,
  `main` initialized. Publication is proven only by Git remote ref verification
  recorded in the local delivery receipt; no future push is claimed.
- Color roles supersede the earlier pale `#fffefa` / `#ded9cc` and dark `#242424`
  statements below: shell `#e6e2d7` / `#191302`, entire main panel `#ffffff` /
  `#2c2c2c`, neutral grey fields `#ececec` / `#1b1b1b` darker than their panel.
  `src/theme-builder/definitions.json` is the single color source; `--shell-bg`,
  `--panel-bg` and `--field-bg` are isolated role aliases. Functional boundaries
  keep 3:1 and text 4.5:1; the quiet field well reference is preserved. The
  sidebar search on the dark shell is ambiguous: the root conductor measures and
  reports it; do not recolor it.
- One new DocsShell owns shell styles, navigation and layout; form
  fieldset/legend grouping and Card rules are unchanged.
- Input slot chain: control height is the total border-box height 48/56/64 px;
  control border, slot inset and slot size derive from the AtlasButton size
  model through the nested content-box formula. Radius is the one shared general
  radius: input and slot use exactly the same value (superseding the former
  concentric radius subtraction). Standalone Buttons are unchanged.
- Overlay: Tooltip is included while actually visible after hover or keyboard
  focus, with its existing delay; its popup and trigger stay sharp. Drawer/Modal
  blur the whole background including the trigger; Toast/Notification stay
  excluded. Closing retains clip, stacking and trigger cut-out until the fade
  ends; the controller is SSR-import safe with a single body pseudo-element.
  Preserve 57 definitions, 51-token legacy recipe compatibility, the six overlay
  tokens, motion aliases and instant reduced motion. Tooltip gains one row in the
  existing `browser/drawer-feedback.spec.ts` table, no new scenario; new overlay
  components join that same table.
- FOCUS01: ringless, type-specific focus through `--focus-bg`,
  `--focus-indicator-color` and `--focus-indicator-width` plus two field focus
  roles. Fields: one bottom marker only with keyboard modality and
  `:focus-visible`; list rows: 3 px start edge replacing the 2 px active marker;
  Buttons fill, links underline, choices fill or scale. No frame and no hidden
  focus in normal modes. Visible focus mode starts OFF; only plain Tab/Shift+Tab
  turns it ON; arrows, Escape, Enter/Space and typing never turn it on. While ON,
  APG arrow keys move focus in composite widgets and keep the mode, Enter/Space
  stay native, and programmatic/dialog focus return keeps the indicator.
  `pointerdown`/`touchstart` only hide the indicator, never `blur()`. One central
  `html[data-input-modality]` state plus `:focus-visible` drives every indicator;
  no storage key or new setting. Forced colors alone may draw
  `outline: 2px solid CanvasText`, and only with that central keyboard mode AND
  `:focus-visible`. The human directly authorized this exception; the four global
  instruction files were updated through breadcrumb-alignment-core-02.
- A local Stylelint plugin pinned to 17.16 (`atlas/focus-no-surround`,
  `../tools/stylelint-focus-plugin.mjs`) is implemented and runs in `docs:lint`;
  docs lint passed. It checks authored stylesheets, not rendered runtime focus.
- Light/dark palette switching is an atomic commit, not component state motion:
  static per-mode background, border and shadow paint exists before the first SSR
  frame, the Provider adds no inline wrong-mode paint and hydration shows no
  appearing transition. Normal state changes keep positive Cubic motion; reduced
  motion is instant. Documented in the Design tokens motion section, the UX
  standards `motion` section and `UX-STANDARDS.md`, without a new test.

## Frozen GenUI/Atlas backlog — human instruction 2026-10-15

The application backlog is exactly the 59 recorded packages; do not rescan the
catalog or invent speculative packages. Only a new human request or an observed
concrete defect in integrated code may extend it, with its evidence recorded.
All 49 registered native adapters share `tests/genui-native-conformance.test.mjs`:
one scenario, explicit rows, one specific-check function per row. The existing
Date/Cascader extensions remain in their original rows. The non-component
record-field schema bridge retains its existing infrastructure check, as do bridge
and query-neutral. Remove separate adapter tests only after their relocated
assertions pass. Report 59-package states and actual before/after file counts.

## Shared GenUI conformance — human instruction 2026-10-15

Use `tests/genui-native-conformance.test.mjs`: one scenario with 34 explicit adapter
rows for original packages 3–36. Each row checks serializable payloads, controlled
values or read-only rejection, invalid properties and default-denied host actions.
Do not retain 34 separate adapter test files: move their distinct DOM/defect
assertions into one extra function per row, without adding scenarios or weakening
coverage; remove the former files only after the combined check passes. Keep the
bridge and query-neutral tests unchanged; the newer freeze instruction above also
merges the later 15 native adapters. Preserve
existing targeted checks for packages 37–41. The genuine absence RED
is run against preserved pre-adapter sources, followed by the identical test on
main; label this retrospective evidence. Package 42 stays blocked on live endpoint
and authentication selection. CLI concurrency comes from real process intervals,
not worker capacity, scheduled jobs or workflow RUNNING labels.

## Frozen tests and continued implementation — latest human instruction 2026-10-15

Open packages retain their already planned test scope. No new test wave, test-revision,
test-review, browser-test/proposal workflow, scenario, fixture expansion or browser
matrix. Use genuine logged RED → implementation → the SAME logged GREEN. Do not
repeat historical passing tests. Only a newly requested behavior or an observed
concrete defect can justify one targeted regression; record the exception explicitly.
Coordinate the frozen counts across every actor. Continue implementation without a
numerical correction stop or permission/budget loop; never label unverified code DONE.
All AI jobs must run through Temporal workflow/activity on localhost:7233. No external
CLI dispatch loop, scheduled starts, cron, launchd or automations. The Atlas worker-pool
automation is confirmed PAUSED. Existing provider limits, source boundaries and gates
remain binding. See evidence/ux-completion-test-freeze.json in atlas-temporal for exact
counts, existing selected checks and the discrepancy between requested and actual UX
row counts. Report package/status/RED/GREEN/counts/workflow IDs at delivery.

## Test scope — latest human decision 2026-10-15

Only the minimum mandatory tests within the requested behavior's TDD scope are
allowed: necessary genuine RED → implementation → the same check GREEN. Do not
start tests outside that TDD scope afterward: no additional regression suite,
exploratory test wave, cross-browser matrix, fixtures or repeated successful checks.
A correction to the same requested behavior stays within its necessary TDD check;
do not use it to expand coverage. Existing mandatory CI/release gates remain
binding and must not be weakened or bypassed; their existence does not authorize
additional ad hoc test work. Keep actual FAIL/not_run evidence honest. This policy
limits testing, not authorized implementation, and imposes no fixed numerical
file/scenario/minute/correction-round cap. It supersedes older broader verification
instructions in these records. Do not ask for a test-budget increase.

## Complete UX reference standard — human request 2026-10-15

[UX-STANDARDS.md](UX-STANDARDS.md) maps all 49 main Refactoring UI topics and
the concluding practice section, their subrecommendations, the existing source,
explicit Atlas adaptations and missing shared components. Apply its MUST/SHOULD/MAY
distinctions without replacing approved font/weight/tracking/background/input/
focus/motion decisions. Source presence and written coverage do not prove runtime
or product-wide adoption. The latest human clarification (2026-10-15) requires
minimal meaningful TDD and continued authorized implementation, without fixed
test-file/scenario/time/correction limits. Older exhausted-budget or held-package
statements below are historical snapshots, not current stop rules. Preserve
actual failed gates and outstanding findings until resolved and verified.

Higher-level user and project instructions apply.

## Documentation typography and measurement

- Project override (2026-10-15, latest direct human GenUI decision): current
  GenUI rules use minimum 12, standard 14 and reading 16 CSS px with weight >= 300;
  see the UX standards entry above. Global baseline: the user's 2026-10-14 global
  decision removes the former 1rem minimum:
  all readable text must be at least 14 CSS px. Larger existing text and heading
  hierarchy remain valid. The native measurement profile below is documentation-specific. Use Ant Design's
  native CSS pixel measurements; do not automatically convert its output to rem.
  New documentation styles use CSS px. `tools/docs-pixel-styles.mjs` projects legacy
  shared rem styles to pixels only in Astro; Storybook reads their original units.
  Line-height uses Ant Design's unitless ratio (22/14), so shared table calculations
  remain dimensionally valid while producing the22px body line height.
- Readable documentation text is at least 14px. The body baseline is 14px with a
  22px line height, following the [Ant Design font specification](https://ant.design/docs/spec/font/).
  The default and recommended face is [Outfit](https://fonts.google.com/specimen/Outfit?preview.script=Latn),
  with default weight 400 and minimum 300, including headings, labels and documentation
  examples. Code keeps its monospace
  family. Shared typography tokens own these values.
- Keep the browser's root font size and zoom preferences intact. Pixel measurements
  are CSS pixels, not physical device pixels. Preserve the 320px flow and existing
  48/56/64px Button sizes, at least 32px handles and larger coarse-input targets.
- This native measurement profile is scoped to documentation. Approved/non-documentation and
  Storybook profiles retain their existing 16px/rem behavior unless explicitly
  opted into documentation appearance. Keep historical evidence unchanged;
  current global instructions also use the 14 CSS px minimum.

## Shared behavior and language

- Both documentation themes target **WCAG2.2 AA**, using the W3C Recommendation
  at https://www.w3.org/TR/WCAG22/. Require normal text contrast of at least 4.5:1 (including
  placeholders after opacity compositing) and necessary control/selection graphics
  contrast of at least 3:1 against their adjacent surfaces. `data/accessibility.ts` owns documentation
  functional boundary/status roles; `docs-accessibility.css` uses native docs
  variable classes so approved consumers retain their identity. Functional baseline
  edges are separate from the single non-surrounding keyboard focus marker.
- Keep 48/56/64px Buttons and 32px-or-larger handles; the WCAG2.2 AA 24px target criterion
  is not permission to shrink these project targets. Drag interactions need a
  non-drag alternative. Preserve keyboard access, visible unobscured focus, no
  traps outside dismissible dialogs, names matching visible labels, validation
  relationships and announced action results. Reflow/text spacing/zoom and actual
  hit regions require real rendering checks in both themes.
- Accessibility regression gates: `docs/tests/accessibility-*.test.mjs` through
  `docs:test`, and the source motion gate. Production naming/theme/bootstrap and
  route checks run through `docs:test:site` after `docs:build`. DOM/token/source
  checks are partial evidence; do not claim full WCAG conformance without permitted
  browser, keyboard, zoom/reflow, screen-reader and focus-occlusion verification.
- Palette changes are atomic readability updates: `beginThemePaint` in `theme.ts`
  guards documentation foreground/background/border paint through two animation
  frames. The shared theme controller and independent Color mode/seed commits use
  it, including restored/imported selections. Keep semantic state immediate and
  retain positive geometry, depth and opacity motion; do not interpolate between
  two readable palettes through an unreadable midpoint. The temporary paint rule
  is documentation-only. Enabled open single Select values remain opaque, with
  native typed-search hiding preserved. Color preview actions use opaque faces so
  their chosen text/face contrast is not weakened by alpha against the local panel.

- Card uses shared native `AtlasCard`, `EntityCard`, `MetricCard` and purpose
  composites. The route has five linked groups: foundations, catalog, interactions,
  data states and the optional GenUI lab. Purpose is independent of generation mode;
  23 purposes and 37 domain recipes share a serializable controlled model. Never nest
  Card inside Card; a Task surface composes Table/Chart/Form/Choice/Action blocks.
  Native Card supports small/medium: sm maps to small and md/lg to medium, with
  shared spacing. Card corners use one enclosing0/3/5px profile, borderless by
  default. Master CSS loads on its consumers; catalog CSS belongs only to Card.
  Keep owned fields, selection, task lanes and focus through presentation changes.

- Color live previews share one validated HWB composition. Six stable hue-offset
  families use the same effective white/black values; the selected hue drives all
  families. Native Ant Design theme namespaces remain distinct per family. All
  family variable keys come from `colorFamilyVariableKeys` and must be excluded
  from static SSR theme overrides while retaining native first-paint styles. Keep
  each preview's field, selection, action and slider state mounted across channel,
  theme, locale and size changes. Color controls and sample handles use AtlasSlider.
  Achromatic compositions truthfully converge to one neutral instead of inventing
  color differences. Preview changes stay local and do not replace saved settings.

- Fixed documentation default: every component uses the shared Tweaker, initially
  closed and opened by the button midway down the right edge. Put shared sm/md/lg
  sizing and all example presentation/property controls in `TweakerSettings`;
  do not add inline configuration grids. Keep real sample inputs, data filters,
  actions and results in the preview. Keep the panel and portal target mounted
  across closing, preserve settings/drafts, support Escape and return keyboard
  focus to the opener after releasing the native trap, without waiting for exit
  motion. An active example dialog retains its own focus on return. All example
  overlays use `AtlasOverlay`: their focus/Escape ownership suspends while Tweaker
  is open, and their header exposes the same settings action for keyboard users.
  Mount the panel lazily on first opening, then retain its portal target and
  controls. Its Escape handler owns the top visible layer before native window
  handlers, while Select and IME handling retain their own first response.
  Nested providers use Tweaker
  context ownership, not size inheritance, to avoid duplicates or omissions. Approved
  and Storybook consumers keep their existing inline controls. Local dropdowns
  must render above the Tweaker; 320px panels fit the viewport and scroll inside.
  Vertical component-size choices use the normal shared radius for their wrapper,
  items and moving thumb. The horizontal size selector retains its rounded profile;
  never stretch that pill radius around the complete vertical stack.

- The user's final selection/input styling decision: Tabs and Segmented choices
  have no selection or keyboard-focus underline, including Two choices, Color
  method/preview selectors and Tweaker sizing. Shared Segmented keyboard focus
  uses one vertical edge. Classic circle Radio keeps its checked-label underline.
  Documentation input bottom lines use50%alpha without dimming the control; keyboard
  focus additionally uses a solid single left edge. Input/textarea placeholders,
  including Tweaker and navigation search, use75%opacity at rest/focus and50%on
  hover. Native Select placeholder spans retain their separate styling.
  These exact user values supersede older input placeholder/underline choices;
  do not silently raise them to pass contrast tests. Retain4.5/3contrast criteria
  and report composited failures separately; these values are not an AA certificate.

- Apply work in the requested sequence: Color system/Color palette precedes the
  UI-kit gap implementation. Keep the original gap audit, register and reference
  review archives immutable; record implementation evidence in a dated companion.
- `/components/record-workspace/` owns the experimental controlled kit in
  `react/workspace/kit/`, `data/workspace-kit.ts` and `data/collection-kit.ts`.
  Orders and equipment reuse `FieldDefinition`, `FieldValue`, `FieldEditor` and
  `FieldFrame` across entry, listing, filtering and single-record display.
  Restricted/unavailable getters must never be evaluated. Zero is not missing;
  date-only values, offset-bearing instants, precision, currency and units retain
  their meaning. Supplied capability reasons explain blocked actions; they are
  not server authorization.
- Consumers own records, drafts, query, projection, group scope, checked targets,
  active inspection and prepared worksets independently. Commit/cancel are explicit
  callbacks. Schema/profile switches retain owned state. Form and grid drafts must
  not silently overwrite each other. Duplicate entity labels retain distinct IDs;
  repeating children and operation outcomes remain keyed by child ID.
- Typed attachment, event, diff, source comparison and conflict surfaces render
  supplied objects only. Non-readable SurfaceState kinds must gate their content
  and actions; partial/stale may retain the supplied snapshot with an explanation.
  Unknown operation outcomes block blind repeat submission.
- API tables distinguish actual Atlas exports from underlying AntD settings.
  Keep machine view IDs stable: the old `gantt` label is “Gantt · date spans” and
  `editable` is “Row editing”; the new EditableGrid implements actual cell drafts.
  Do not imply specialized Gantt/tree prerequisites, file parsing, AI extraction,
  server persistence or advanced pin/resize/range/paste support from a gallery.
- `docs:test` includes core, collection and record kit regressions. The production
  gate covers route-owned CSS and SSR provider ownership. `docs:browser:check`
  types/discovers contracts only; G21 remains open until permitted real browser
  acceptance, including 320px, focus, motion, input, scroll and network evidence.

- The Data table, Collection views, Record details and Record forms pages are
  experimental web components. The user explicitly excluded Storybook from this
  delivery. Do not promote them to stories or `COMPONENT_DECISIONS` without a
  separate user decision. The standalone Downloads atlas is also outside scope.
- Reference HTML/screenshots supply data organization and view alternatives,
  not visual identity or approval. Reuse existing Atlas components/tokens, with
  English default and Turkish secondary. The 32 open reference decision cards
  remain open; no new engine, AI/backend, permission or persistence claim follows.
- Workspace examples share the typed fixture and pure operations in
  `src/data/workspace.ts`; active record, checked targets, view settings and edit
  drafts remain independent. Null is distinct from zero and totals stay separated
  by currency. Bulk preview snapshots its targets and excludes read-only records.
- Mobile and desktop are explicit example profiles, with one active presentation
  and stable draft ownership. Calendar/Gantt map actual fixture dates and disclose
  unscheduled records. Narrow tables scroll within their container. New feature CSS
  is scoped and linked only by its owning documentation routes, preserving existing stories.
- `tests/workspace.test.mjs`, production route/SSR/import checks and the existing
  motion guard run through `npm run docs:verify`. JSDOM ignores CSS imports; it
  proves DOM/state behavior, not rendered layout or focus. Browser access remains
  subject to the existing policy boundary; no alternate route/renderer bypass.

- Smooth entry and exit are mandatory. Human and AI contributions use the same
  acceptance gates. `src/data/motion.json` is the single source; `docs:data`
  generates `src/styles/atlas-motion.css`, and AtlasProvider consumes the same
  JSON. Normal motion uses easeInOutCubic (.65,0,.35,1), positive semantic durations
  and zero initial delay. Linear/steps/one-way easing, none/zero duration and inline
  motion overrides are prohibited. New controls inherit `.atlas-control`;
  native AntD, portals and child elements use the shared curve. The `docs:test`
  source guard covers new authored styles and is mandatory in `docs:verify`.
  The body and hit area stay fixed when transitions start or reverse. Values,
  checked, ARIA, business state and focus update immediately; only presentation
  animates. Do not delay input with timers/debounce. Reduced motion, caret and
  visible focus remain immediate. See `../CONTRIBUTING.md` and the
  [shared motion policy](/Users/w6x/AGENT.md#ux-motion-policy).
- English is canonical and is the initial SSR/UI language. Turkish is secondary.
  `src/i18n.ts` owns the locale store, translation, formatting and normalization;
  React consumes it through `src/react/useI18n.ts`. English phrase keys are the
  source. Turkish dictionaries under `src/locales/tr/` load only after Turkish
  is selected or restored from an explicit `atlas-locale` preference. Do not add
  a React island to foundation pages for locale controls. Storage failure must not
  prevent language changes. Guard stale asynchronous language requests.
- Put `data-i18n` only on static leaf text, never on a parent containing controls,
  code blocks or other markup. Translate accessible attributes through matching
  `data-i18n-*` markers. Translate visible labels, validation, status, popup and
  library copy. Keep code examples English. Use complete messages with interpolation
  and context-specific phrase keys where meanings differ. Preserve public APIs,
  option values, slugs, story IDs and approved decisions. Theme and language changes
  preserve values, validation, selection, open panels and focus without remounts.
  Search uses `normalizeSearch` for the query and both stable English title/slug
  aliases and translated visible names. Component library navigation is permanently
  visible at every width, including first paint without JavaScript. Its title is a
  static heading; do not restore disclosure controls or breakpoint-driven closing.
  Preserve component search, links and the Skip to content path on narrow screens.
- Use public Astro 7.3.8/@astrojs-react 7.0.1, React 19.2.0, AntD 6.6.6 and
  cssinjs 2.1.2 APIs. Preserve `strict:true` and `skipLibCheck:false`.
- Canonical `COMPONENT_DECISIONS` changes only with explicit user approval.
  `docs:data` generates decisions, experiments, palettes, icons and shadow tokens
  from the existing source.

## Approved Button source and rendering

- Documentation opts in explicitly through `documentation` entry props and
  `AtlasProvider appearance='docs'`; its inherited appearance context defaults to
  `approved`. Shared `atlasTheme`, unopted Provider/Button calls, Storybook and
  explicit palette choices keep their approved identity. `src/data/docs-brand.ts`
  owns the exact documentation seed `#0099ff` and official Ant Design palette roles.
  The same opt-in is passed during both light/dark SSR extraction and hydration;
  `DocsLayout` loads the separate body-scoped brand tokens/styles before paint.
  Do not infer this context from `document` after hydration or aggregate every demo
  into a new client entry bundle. The Color system's nested seed preview owns its
  independent algorithm and CSS variable key.
- Color workspace defaults and Reset color use 15% whiteness and 15% blackness,
  from `DEFAULT_COLOR_SELECTION`. Explicit saved/imported settings and preset
  compositions retain their supplied values.
- Documentation primary is exactly `#0099ff` in both themes, with opaque black
  normal Button text. Readable links and non-text Slider tracks use generated
  contrast roles; semantic errors/warnings/success remain independent. The 24
  Color-system families use `button-palette.ts` and functional tone derivation.
  Chromatic families use HWB10/10; neutral families keep80% of their source
  composition plus10% white/10% black so their identities stay distinct.
- Public surfaces are solid, outline, pastel-filled, text and link, with Disabled
  as a state. Public sizes are sm/md/lg 48/56/64; old recipes normalize internally.
  Processing is the only busy state. Enabled documentation/preset paint stays
  opaque for exact-color/contrast; disabled appearance remains distinct.
- The docs-only tactile adapter uses 116.667 ms for both press and release, 30%
  faster than the previous 166.667 ms profile, below Switch selection320ms.
  Root/decorative layers share central tokens and reduced motion wins.
- `AtlasButtonGroup` wraps exactly2/3 equal native radio choices with one selected.
  It shares canonical radii/sizes, keyboard arrows and the selected white surface.
  Search/icon-only examples use the same master, without dashed/dotted surfaces.
- Drawer/Form actions use the shared `AtlasButton`. Documentation flat actions,
  including Quantity icon actions, use zero border width in every state: a
  transparent reserved border reveals the darker lower body as a surrounding edge.
  Explicit Outline actions retain their functional border. Field borders and the
  separately approved profile keep their existing width contracts.
  Hover/active must not change border geometry. Mouse focus after Drawer portal
  transitions must not underline text. Document modality shows one left mark for
  keyboard focus, or one bottom mark for icon buttons. Do not call `blur()` or
  use surrounding rings.
- Shared `--control-transition-properties` lists only background-color,
  border-color, color, opacity and box-shadow paint changes. Native
  `transition:all` must not animate outer geometry. New custom control roots
  use `.atlas-control`; hover does not change padding, margin, dimensions, font
  or transforms. Intentional movement belongs to an absolute thumb/decorative
  layer. Mark new layers with `.atlas-motion-layer` and keep hit areas fixed.
  The interaction-stability guard rejects unrestricted authored transitions and
  hover geometry changes, including in new components.
- The five public Button states live in
  `atlas.decisions.buttons.state_variants`; five others are experiments.
  Components and Storybook decision galleries share the AntD renderer. A busy
  line does not claim a real progress percentage.
- Button `width_variants` content/wide/full are approved; narrow is experimental.
  Three size/padding decisions and three widths use the same AtlasButton and
  ButtonDimensions gallery. Wide has a 175 px equivalent minimum and fits narrow
  containers; full is native block. Unknown widths fall back to content. Do not
  infer palette/tone approval or add a React island to foundation decisions.
- `AtlasIconButton` delegates to `AtlasButton`; icon and aria-label are
  required. Square size/radius/busy/disabled/bottom-lip behavior comes from the same
  model. Resolve native disabled with `disabled ?? componentDisabled` while
  preserving state-derived blocking. Number fields pass this override to both
  actions. Icon focus uses one bottom mark in readable Button foreground rather
  than relying on empty text. `AtlasIcon` uses the existing catalog and Phosphor
  core 2.1.1 regular minus/trash; keep its MIT notice on the license page.
  WebButtonDemo SSR/hydration must match. Default ButtonDemo/Storybook and the
  canonical decision/icon model remain intact.

## Field, tag and selection details

- Select suffix/clear share one fixed absolute slot and reserved padding in every
  state. Public `showArrowPaddingInlineEnd:0` removes native no-arrow hover
  margin changes. Swap icons with opacity without moving the slot. Preserve the
  native clear translateZ(0) compositing fix together with centering translateY.
  Keep the visible keyboard indicator.
- Web input/textarea/numeric fields use `--input-inset-shadow` for thin, unblurred
  upper diagonal depth and slight light. It is neither a real border nor a soft
  bevel. Radius uses the existing 3 px `--radius-sm`. Select/popups must not
  inherit this input shadow/radius. Placeholder opacity is .7 normally and .5 on
  focus/active, with the shared symmetric curve and reduced-motion exception.
  Center number-stepper text.
- `AtlasPill` uses installed AntD Tag close/disabled/keyboard contracts and the
  four Button radii. Minimum visible height is 32px; close target is 32px,
  or 44px for coarse input. Phosphor X is 20px. Documentation text is at least 14px
  and wraps. WebSelectDemo and the Select Storybook story use this master for
  tagging/multiple through `tagRender`;
  preserve native search/Enter/Backspace and focus through the public Select ref.
  The user approved aligning this Select story with the documentation through
  `pillTags:true` and `atlasSharedPreview:true`; retain the demo's native fallback.
  Master flex display must not override `ant-tag-hidden`:
  successful close hides it; `preventDefault()` cancels hiding. Manage spacing
  in the native `.ant-select-content` flex parent with `gap:var(--space-xs)`
  for both horizontal and wrapped rows; do not double space through Pill margins.
- Web Checkbox marks in web.css use symmetric 280 ms opacity and slight scale,
  with no delay. Native checked updates immediately without remounting or timers.
  Use the shared easeInOutCubic token; Quart requires separate documented approval.
  Preserve indeterminate geometry and reduced motion. The unflagged Checkbox
  Storybook story stays outside `.live-preview`, so it does not activate this web
  experiment; `COMPONENT_DECISIONS` stays unchanged.
- Web Checkbox visible boxes use the user's exact 32/40/50px selection profile;
  the label hit area stays at least 48px in both dimensions, including unlabeled
  collection selections, without enlarging the selected visual size.
  Legacy unprofiled coarse fallbacks remain outside this explicit profile,
  without UA/device detection. WebCheckboxDemo inherits shared sm/md/lg and the same four radii while preserving selection/focus. AntD Checkbox
  has no public custom icon prop; use the existing ::after with the local Phosphor
  core 2.1.1 Check SVG mask. Preserve disabled mask colors and native indeterminate
  semantics. Default demo/Storybook stays unchanged.
- Normal web Radio circles use the same exact 32/40/50px diameters, with at least 48px label hit areas for coarse
  input; dots scale proportionally. The selected label underline follows actual
  Radio background, primary-hover on hover and dot-disabled when disabled.
  Selection underline is not a focus indicator: dark selected red lacks adequate
  focus contrast, so keyboard focus uses focus-color with one left-edge mark.
  No surrounding ring, layout shift or second focus underline. Preserve default
  Storybook and `COMPONENT_DECISIONS`.
- WebRadioDemo uses AntD 6.6.6 Segmented with one pill wrapper. Preserve native
  radio name/checked/disabled and MotionThumb measurement/RTL lifecycle; do not add
  custom geometry/timers. Root tabIndex=-1 removes an extra Tab stop while native
  radio inputs remain. Do not paint a background on selected-text; only the thumb
  paints during movement. Public theme tokens use shared colors; the CSS duration
  uses symmetric 320 ms and the shared curve. Preserve one vertical keyboard focus edge and
  reduced motion. Overflow scrolls inside its wrapper without shrinking/clipping
  text. SSR/hydration uses the same WebRadioDemo. Default Radio Storybook and the
  decision list remain intact pending explicit approval.
- The web Input page shares WebInputDemo across SSR extraction and hydration.
  NumberStepper composes real AtlasIconButton sibling actions with
  `InputNumber controls={false}`; do not put buttons inside native upIcon/downIcon.
  There is no public step command; do not synthesize key/DOM click hacks. Preserve
  native editing/arrow keys. One button click means one step. Pinned mini-decimal
  1.1.4 preserves decimal arithmetic and bounds; never coerce stringMode to Number.
  Parents own controlled values. The default minimum of 1 is configurable.
  Show Phosphor trash only at the actual minimum, minus above it. onRemove is a
  separate action that does not emit below-minimum onChange; disable it without
  a callback. ArrowDown never removes at the minimum. The web example clears
  quantity locally without deleting a real cart/service. The Input Storybook
  story uses this master with `numberMode:'spinner'` and
  `atlasSharedPreview:true`; retain the demo's native fallback and public API.
- NumberStepper has three siblings within one visible wrapper. Shared fill,
  padding/radius and thin inset depth belong to the outer wrapper. Inner InputNumber
  is transparent without its own shadow. Preserve the minmax(0,1fr) center column,
  centered numbers, master icon buttons and minimum/disabled/controlled behavior.
  Documentation action faces are fully flat: the shared
  `--number-stepper-action-depth` token resolves both lip depths to zero on native
  docs owners, including pressed state. Keep the field's independent underline,
  fixed button geometry and legacy approved appearance. The Quantity browser
  regression measures face insets, lip layers and borders in both themes/sizes.
- Web Switch tracks use the shared selection sm/md/lg 32/40/50px profile, at twice
  that width. The header theme Switch uses the same Medium 40px track, including
  coarse input, with SSR-only Phosphor sun/moon icons,
  preserving first-paint theme and native button keyboard semantics.
  Normal/SM track, handle, padding and inner tokens derive from the same local
  geometry. Thumb inset is 10% of track height at both ends (3.2/4/5px); the decorative
  thumb is 80% of height (25.6/32/40px). The thumb is not a separate interaction
  target; the track's transparent ::after hit extension and labels preserve 48px
  targets. Native Switch keyboard focus retains its independent ::before marker;
  the header uses ::before for hit extension and ::after for keyboard focus.
  Content and native loading icons use 50% of owner height; the loading icon centers
  inside the derived thumb. Gap and reserved label widths derive from owner height;
  text stays at least 14px and does not shrink. Explicit Small/Medium/Large examples
  own their selected size; all other states inherit Tweaker sizing.
  Local `--switch-handle-shadow` doubles shared contact shadow offset, blur and
  opacity. Resolve derived variables on the control; ancestor calculations do not
  follow manual height. Web token ownership uses `:root[data-theme]` to outrank
  SSR token specificity, avoiding a larger track with a stale 20 px handle.
  Checked positioning uses percentage+translate independently of thumb width and
  preserves RTL. Native checked is immediate without timers. Track/handle/inner
  use symmetric 320 ms shared motion; reduced motion disables it. Selected hover
  uses primary-active in light mode and primary-hover in dark mode, plus .9→1
  opacity and shared soft shadow. Exclude disabled/loading from hover and preserve
  the bottom keyboard indicator. Shared SwitchDemo shows Required on with native
  `checked disabled` in web and Storybook: it is not temporary loading, cannot
  be turned off and has a visible label explaining the requirement. Do not change
  the decision list; the shared Cubic policy remains authoritative.
  The web-only Text and icon gallery uses native checkedChildren/unCheckedChildren
  for text, numbers, Phosphor check/X and smiley/smiley-sad with text. Each variant
  shows independently interactive on/off starting examples. Both state layers
  stay mounted; stable external aria-labelledby names and immediate native checked
  semantics survive locale/theme/size changes. Scoped width tokens reserve the
  longest English/Turkish content, including icons, without a state-dependent width.
  Inner padding/margins share the 320 ms Cubic motion; press does not nudge the
  visible label. Off-state surfaces/text use semantic field/ink tokens for legibility.
  Documentation content switches are fully opaque, like documentation primary
  Buttons: 0.9 group opacity lowers black-on-exact-blue normal text below 4.5:1
  on dark panels. Preserve hover background/shadow motion and plain-switch opacity.
  Default SwitchDemo/Storybook and canonical decisions exclude this web experiment.
  Targeted checks: `node --test --test-name-pattern='Switch' docs/tests/patterns.test.mjs`,
  the documentation Switch contrast regression in `tests/docs-brand.test.mjs`,
  the existing interaction-stability source guard and `npm run docs:check`.

## SSR, styling and verification

- Extract AntD styles into the head at build through per-page cache/extractStyle.
  Keep `cssVar.key` stable across SSR/client. Static foundation pages must not carry
  React or demo bundles. The interactive `/color-system/` route is the explicit
  exception: it owns ColorSystemDemo and route-only color CSS. Its nested
  `css-var-atlas-color-preview` key is excluded from static root-theme variable
  overrides so changing its seed can update tokens; normal SSR extraction remains.
  Approved palettes and Storybook stay unchanged. Each demo imports its own primitives.
- The selected theme must be ready for first paint. `src/ssr/styles.ts` collects
  global/component variables from separate light/dark caches at build. Normal
  `data-atlas-theme-tokens` head CSS scopes every selector to the root theme.
  Preserve canonical CSS-in-JS hashes/cache maps. Do not copy runtime ownership
  metadata onto the new scoped variables. Temporary hydration variables must not
  override the selected theme.
- Do not send only light SSR and repair dark mode in useEffect. Hiding content,
  waiting through opacity/visibility, removing SSR or suppressing hydration warnings
  are not fixes. Initial HTML must contain correct border, text, placeholder and
  component variables. `docs:test:site` checks both themes for the demo set.
- Outfit (default weight 400, minimum 300), minimum 14px documentation text, user root preferences, 320-first layouts, visible
  non-surrounding focus, branded Select popups, fixed Button bodies and shared
  symmetric motion are mandatory, including inner actions and filled/error/warning
  fields.
- Input/InputNumber/Select/Form share filled as the default surface. Do not remove
  normal borders with border:none/0 or hide the element with display:none.
  DocsLayout and the Storybook preview import web.css; only opted-in story content
  receives its `.live-preview` scope. It reserves identical outer solid border
  widths in all states. Surrounding edges stay transparent normally; the
  documentation's functional bottom edge uses its3:1 boundary token. Error/warning
  and keyboard focus change color without changing geometry. Approved consumers
  retain their separately approved baseline.
  Reserve the existing bottom focus width even normally. Affix inputs must not
  acquire a second border. Do not add hiding wrappers or duplicate variants.
  Visible fields and copyable examples remain filled without a surface selector.
  Do not add entries to `COMPONENT_DECISIONS`.
- Search/password/numeric/multiline/status/Select examples also remain filled.
  Theme/locale changes must not use keys, remounts or value resets. Both themes
  have no visible normal surrounding field borders. Gray fills remain darker than
  panels; the explicit2026-10-14 light paper update preserves the existing field
  fills even though they are lighter than that page canvas. Preserve shadows, semantic error/warning
  borders and single-edge keyboard focus.
- Do not assume AntD class names from an older major. Use public semantic
  classNames and observed installed DOM. Library focus/wave defaults are not design
  decisions.
- Form and Drawer demos stay local. Preserve drafts/focus and do not simulate
  persistence/loading. keyboard.ts Space adaptation targets only the heading
  itself, not inner control keys. Copyable code follows the same contract.
- `npm run docs:verify` runs formatting → strict Astro/TSX → behavior → static
  route build → production/link/font/SSR/import-graph tests → Playwright types/test
  discovery. `npm run verify` covers the legacy atlas. Discovery is not browser
  execution. `npm run docs:browser` is the separate real browser matrix; do not
  report PASS without results.
- Do not blindly update visual references. Prepare before/after/diff evidence and
  independent QA. Record actual browser/viewport/input profiles and missing layers.
  Never bypass a policy denial with another server, browser, renderer, URL or CDP.

## Browser smoke requests

- Apply the [shared smoke limit](/Users/w6x/AGENT.md#kalıcı-test-kapsamı-sınırı-yüzeysel-test-isteğinde-derinleşme):
  opening, representative basic interaction, obvious overflow and visible keyboard
  focus. At most one desktop and 320 px view, 5 minutes per browser, 20 minutes total.
- Do not automatically run the full docs:browser matrix or add state/variant
  combinations, pixel baselines or new tools/browsers. After one obvious small fix
  and targeted rerun, report remaining FAIL/`not_run`. Do not repeat passed checks
  without changes; changed-code mandatory gates still apply.
- Report actual browser names/versions. WebKit is not Safari; Chromium results do
  not prove Chrome/Opera. Unavailable browsers remain `not_run`. Preserve critical
  security/accessibility and existing Git/Colima rules.

## Storybook consumer

- Storybook 10.2.19 / React-Vite is the second consumer of the nine existing Demo
  exports. Do not duplicate demos/providers/tokens or create a second decision list.
  Use one demo per story and no inline duplicates with fixed IDs.
- Input and Select are explicitly aligned with the documentation: their existing
  stories set `atlasSharedPreview:true`, and only their content receives a
  `.live-preview` wrapper. Input uses `numberMode:'spinner'`; Select uses
  `pillTags:true`. Preserve the default Demo APIs and native fallbacks. Other
  stories stay outside this scope; Checkbox, Radio and Switch web experiments
  remain unapproved for Storybook. Shared changes require checking default Demo
  output and Storybook imports.
- Preview CSS order matches Astro: docs.css → atlas-shadows.css → components.css,
  followed by preview chrome styles and web.css. The toolbar stays outside
  `.live-preview`.
  Demos already own AtlasProvider; do not add a second provider. Astro SSR extraction
  stays outside Storybook.
- storybook:check, storybook:build and storybook:verify are separate integration
  gates and do not replace docs:verify or browser/pixel review. Browser smoke follows
  the existing scope and time limits.

## Light/dark appearance and popup layers

- `src/theme.ts` owns shared semantic appearance tokens and the preference store.
  Astro head bootstrap and Storybook preview share `atlas-theme`. Interaction
  works with storage disabled; theme changes preserve demos/state without remounting.
- AntD ConfigProvider light/dark algorithms use a stable CSS variable key and the
  same component tree; portals/popups inherit the theme. Decisions remain unchanged.
- Verify representative data/focus preservation, persistence, narrow layouts and
  the surrounding-ring prohibition without expanding a smoke request.
- Foundation pages use a vanilla navigation/theme/locale controller, without React
  islands, hydration or modulepreload. Measure actual production controller bytes
  separately from the optional Turkish dictionary chunk. The complete initial static
  controller graph must remain at most 8 KiB (uncompressed UTF-8). Shared i18n may
  change the emitted module count without increasing this budget. Turkish dictionaries
  must remain outside the initial graph and must not be preloaded. Do not hide excess
  bytes or treat a source-size estimate as network evidence.
- Normal fields have invisible surrounding borders in both themes. Light/dark gray
  fill is darker than panel surfaces. The explicit light-paper update to#e6e2d7
  preserves the existing lighter gray field fill. Dark panels/backgrounds remain neutral
  black/gray. Derive fields from shared fieldBg/fieldFilledBg/fieldHoverBg tokens.
  Hover does not restore surrounding borders. Error/warning may use full red/orange
  borders. Preserve visible single-edge keyboard focus, semantic colors and measured
  flat/semi-flat shadows. Color/depth references do not establish new styles or decisions.
- Open Select applies the shared overlay standard's 1 px background blur and scrim (the former 1.5 px value is superseded).
  Trigger and popup stay sharp; use existing soft/flat shadows. Backdrop
  pointer-events:none preserves AntD outside-click/keyboard/closing behavior. Remove
  blur/dimming when closed.
- The Select bottom focus mark follows keyboard modality. Mouse/touch selection
  must not leave a white line, and Tab from outside restores visible focus. Preserve
  focus access without blur(), use the provider modality source and clean up document
  listeners on unmount.
- Backdrop/trigger layering is scoped to the independent demo layouts. Reassess it
  before placing Select inside a new transform/isolation or Drawer stacking context.
  Do not raise the entire Drawer layer.

Preserve the dated data-workspace reference record and local source archive. Append new findings; never overwrite older source observations with a later proposal. The deepened report D01–D64 remains open; the local demo does not implement the entire acceptance specification. Workspace CSS is linked by route through `?url`, so adding a TSX side-effect stylesheet import must not make unrelated component pages ship it.

The documentation header, shell, footer and main content use the available viewport width. Preserve semantic gutters, sidebar/TOC tracks and contained table scrolling. Do not restore a finite outer desktop max-width; readable prose may keep its own measure. Wide geometry and320px contracts are in the existing browser suite; source gates do not prove rendered geometry.

## Color system

- `AtlasSlider` is the shared native Ant Design 6.6.6 Slider adapter used by
  `/components/slider/` and Color. Its public union and ref preserve native single,
  range, orientation, reverse, keyboard and ARIA contracts. `slider.css` is linked
  only by those routes. Visible thumbs derive the existing Radio size; interaction
  areas remain separately reserved and stable across hover/press/focus. Native axis
  coordinates remain authoritative, with central symmetric presentation motion,
  reduced-motion handling and one immediate bottom keyboard marker. Color must not
  reintroduce a separate slider geometry adapter. English/Turkish labels and numeric
  formatting preserve values and mounted controls. Slider DOM/source regressions
  are mandatory in `docs:test`; production ownership and browser discovery are
  distinct from executed rendering. This integration does not modify Storybook.
  Reversed and vertical examples use stable axis configurations; no instantaneous
  interactive direction-flip action is exposed. Adding a direction switch requires
  a separately verified interpolable presentation adapter. Numeric values between
  steps remain input drafts until native Enter/blur precision commits a valid value;
  Slider and output keep the last valid committed value during that draft.

- The 2026-10-13 layout refinement uses 41 flat spectrum steps (24 × 1.7 rounded),
  36px spectrum strips and a 48px composition strip. Presets are the first and
  initial selection method; explicitly saved/imported methods are preserved.
  The method selector fills its parent with equal halves. Preset tiles share
  equal-width columns fitted to the parent without horizontal scrolling. The
  container's available width selects 13/7/4/3/2 column-flow rows while preserving
  text and handle floors. Arrow-key movement follows the effective row token.
  Composition boundaries have persistent
  decorative triangle nodes above the strip, with symmetric position/opacity motion
  and coincident markers hidden. The shipped Phosphor catalog has no down-chevron;
  the local SVG triangle is the user-authorized fallback. Source/DOM guards run in
  `docs:test`; authored geometry/browser contracts remain separate acceptance.

- `src/data/color-system.ts` owns validated HWB selection, the 24 active preset
  identities, schema 1–4 import and official installed Ant Design color generation.
  HWB creates one sRGB HEX seed; rawHex, seedHex and colorPrimary input are identical.
  No 216-color quantization or custom palette engine. Main hue resets only fine offset;
  the fine 72-degree window keeps a stable anchor and wraps through zero. W/B inputs
  remain independent, normalized only during conversion.
- Color editing is a local preview and export tool. The UI uses the existing Atlas
  theme, tokens, keyboard focus, mobile layout, motion and English/Turkish i18n.
  Preview seed/theme changes retain sample field state. Saved/imported selections
  are validated and derived data is recalculated; storage failure is visible and
  does not block editing. A contrast pair result is not full accessibility proof.
- `tests/color-system.test.mjs`, `tests/color-page.test.mjs` and production island,
  route-owned CSS and dynamic-theme guards run through `npm run docs:verify`.
  Browser/visual/device acceptance remains separate from these source/DOM gates.

## Shared profiles and click feedback

`AtlasSizeProfile.tsx` and `AtlasProvider` own sm/md/lg, native componentSize and
height tokens; nested providers inherit the same selected profile. Field state and
DOM nodes must survive profile/theme/locale changes. Every Button is at least 48 px;
Circle Radio/Checkbox/Switch use the separate 32/40/50px visual profile from
`data/selection-sizes.ts`; their documentation Tweaker labels use these values.
General Button/field/Segmented sizes remain 48/56/64px. Related Slider handles follow
Radio diameter with their existing 44px coarse floor. Coarse input never enlarges
the explicit Radio/Checkbox/Switch visual profile; hit areas are separate. New
selection geometry belongs to native docs owners; nested approved consumers retain
the legacy base sizes and spacing. `selection-size.test.mjs` guards that boundary;
the browser selection contract verifies dimensions, hit regions and focus layers.

`deferred-feedback.ts` loads the optional presentation controller only on actual
interaction intent, keeping the complete initial vanilla graph within 8 KiB.
`interaction-feedback.ts` supplies one reference-counted delegated click/keyboard/
Slider effect, with exact target color and finite 400 ms Cubic motion. Initial-event
replay paints feedback only; never repeat click, submit or value changes. Native
AntD waves remain disabled. Reduced-motion, removal, scroll/resize and unmount clean
up decorative overlays; focus stays a separate immediate single-edge indicator.
Button waves read the current painted `::before` face, including native primary
Buttons and hover/press colors, with foreground/semantic fallback for transparent
targets. The positive duration parser accepts equivalent production CSS times,
including minified `.4s`; invalid or non-positive values produce no overlay.
Slider keyboard decoration resolves the native committed/focused handle,
coalesces rapid keys and shares cancellation with mark/pointer feedback. Slider
waves follow the painted handle rectangle through its existing position
transition; every disposal route cancels the per-wave animation frame. Each native
Slider owner retains one current wave when range handles cross; separate Slider
owners retain independent effects and cleanup.
Read-only fields keep focus/selection/copy with Phosphor lock cursor and hint;
Processing actions block activation while exposing the Phosphor prohibited cursor.
The source motion gate resolves provider-owned transition property lists from
their actual TypeScript literals and checks every CSS override. Unknown/cyclic
aliases and unsafe `all`/`none` values cannot bypass the explicit-property check.

Native virtual Select options, date/time popup cells, menu/tree actions and native
input buttons participate in the delegated feedback. Disabled/busy targets stay
excluded. Slider rail/track/mark feedback follows the final native handle, not the
rail. Keyboard and mark decoration wait for the next paint after native selection
commits; all Slider waves track actual geometry until finite disposal.
Deferred loading retains a bounded 32-event presentation queue without redispatching
business input. Scroll, resize, reduced motion and disposal clean pending decoration.
NumberStepper explicit native sizes resolve local component/field/control height
aliases together from the canonical size profiles, preserving docs px and approved
rem units, inherited sizes, drafts and focus.

The new targeted regressions are button-refresh, color-refresh, interaction-feedback
and size-profile tests. Existing motion, type/snippet, changed-consumer and static
production ownership/budget gates remain required. Browser/visual proof stays
`not_run` unless actually permitted and executed; do not expand the user's scope.

## Documentation Pill master and color collections (2026-10-14)

`AtlasPill` uses native AntD6.6.6 Tag with independent filled (default), solid and
outlined variants. An unassigned documentation Pill derives its seed from the current
ConfigProvider theme. Explicit native color takes precedence over colorIndex, then
scoped colorKey, then the theme fallback. Native Tag owns close/disabled/link and
object/function semantic styles. `AtlasCheckablePill` uses controlled CheckableTag
with native click/Space checkbox behavior; selection and removal stay separate.
Approved default filled styling retains the former ink/surface CSS-variable fallbacks.

`pill-palette.ts` retains17 chromatic families in shared token order, with75%white
and5%black for filled palette colors. Solid uses each shared family seed; outlined
uses a readable family edge/ink against the current surface. Six grey/black families
and the repeated red endpoint remain excluded. They stay in Color/Button/Tokens.
`pill-surfaces.ts` centralizes sizes32/40/48px; Pill Tweaker labels use that family.
Checkable targets retain48px; close targets retain32px precise/44px coarse floors.
Focus is one immediate, non-surrounding marker. All normal paint motion uses shared
positive Cubic tokens; native wave remains disabled in favor of shared click feedback.

`AtlasPillColorScope` owns one allocator per logical automatic collection. Consumers
supply stable raw keys and each Pill supplies colorKey; input components contain no
color-selection logic. Randomness runs after client commit, never in render/state
updaters, keeping SSR and initial hydration identical. The first assignment is random;
new keys exclude the last assigned color, then choose randomly among the least-used
eligible colors. Usage ties favor hue separation from existing colors (or the last
color during reuse), with random final ties, so adjacent pastels remain distinguishable.
Unused colors precede reuse. Removal releases usage, keeps surviving
colors, and forgets removed keys. Reordering/translation/profile/theme changes never
reassign survivors. Emptying retains the last-color exclusion; separate scopes have
independent state. Cryptographic rejection sampling avoids bias, has bounded retries
and falls back without blocking tag creation. Read-only snapshots cannot mutate the
allocator. Native Select removal/ref focus remains owned by Select; workspace semantic
status/currency mappings remain intentional fixed colors. Use automatic scopes for
collection keys, not row-order-derived status meaning.

The Pill route presents Playground, Surfaces/status, Color families, Icons/custom
styling, Selection/removal (including a field-independent automatic collection), then
Cross combinations. Settings stay in the shared closed Tweaker. `pill-catalog.css` is
linked only by the Pill route; master rules remain shared. No new Storybook decision
or dependency is introduced. Regressions: pill-refresh, pill-colors, pill-palette,
Pill/Select patterns, workspace-pill-colors, motion, native type/snippet and production
site gates. Browser contracts are separate from type/discovery proof.

The removed `violet-magenta` preset is absent from all active catalogs and aliases.
Old stored/imported settings normalize its presetId to null while preserving the
exact HWB channels and preview mode; it becomes a custom color. Direct preset
selection rejects the removed ID. Export uses presetCatalogVersion 3, with the
existing schema 1–4 import contract. Other presets retain their order and values.

## Button documentation reading order (2026-10-14)

The documentation Button catalog presents five linked sections in this order:
Playground, Action patterns, Surfaces and states, Size and shape, Color and depth.
Keep one main preview first, settings exclusively in the closed-by-default Tweaker,
and one copy of every existing gallery. Group icon/search actions and double/triple
choices together; keep dimensions and corners together; place the complete color
catalog after the action/interaction reference. Do not duplicate variant lists.
`ButtonVisualGroup` shares the existing source/rendering with the standalone
`ButtonVisualDecisions` gallery. Its Storybook/default presentation and IDs remain
unchanged. Nested documentation galleries use h4 below the section h3.
`button-catalog.css` is owned only by `/components/button/`; its token-driven Grid
flows from a single mobile column without hiding examples or reducing text/targets.
Regression gates include `docs/tests/button-refresh.test.mjs`, Tweaker/default
consumer tests, `docs:test:site`, docs lint/type/snippets and browser/visual review.
The existing browser suite includes the Button catalog anchor/keyboard/Tweaker
draft contract in both themes; discovery is not proof of browser execution.

## Workspace Pill identity (2026-10-14)

Data Pills require a stable value-based colorIndex. The shared
`data/workspace-pill-colors.ts` maps all four raw order statuses and both currency
codes to six distinct positions in the shared chromatic 75/5 palette. Tables,
mobile record lists, record summaries and currency totals share this mapping.
Never derive these colors from row order, filtered lists, locale text or formatted
amounts. Equal values retain their color through sort/filter/theme/locale changes;
different status/currency labels in the same workspace have distinct fills.
Use separated hue families for visible distinction: draft red, pending orange,
approved green, shipped cyan-blue, USD violet and EUR magenta-red. Resolve these
by shared preset identity rather than hard-coded catalog offsets. Do not collapse
the categories to neighboring warm shades or assign colors from rendered order.
The native Tag, palette, readable ink, sizing and approved consumers stay unchanged.
Regression: `docs/tests/workspace-pill-colors.test.mjs`, Pill/Select tests and SSR
site checks. Treat browser/light/dark evidence separately from DOM assertions.

## Data entry documentation reading order (2026-10-14)

Input, Select, Checkbox, Radio, Switch, Slider and Form share `DataEntryCatalog`:
purpose-based sections, one local anchor list, h3 section headings with short
descriptions, h4 subexamples and overflow-safe comparison grids. Put basic use
first, related types/precision/content next, then validation and availability.
Switch sizes and states are separate. Slider retains all six native example
blocks within basics, numeric entry, direction/marks and states. Form keeps one
real local form followed by the separate action-state preview.

Only `documentation=true` opts into this composition. Default/approved exports,
Storybook order, component decisions and raw option values stay unchanged.
Define sample markup once, keep hooks/ref Maps/Form instances in their existing
owners, and key sections by canonical IDs rather than translated titles. Never
duplicate mobile/desktop controls, replace a subtree on theme/locale/size changes
or move real sample actions into Tweaker. Existing labels/help/ARIA, exact sizing,
flat Quantity, read-only affordances and shared wave/focus/motion stay intact.
All presentation settings remain in the shared closed-by-default Tweaker.

`data-entry-catalog.css` is linked only by the seven Data entry routes. It uses
shared spacing/type tokens, one fluid column at320px and content-sized additional
columns where they fit; no extra decorative cards/borders or smaller text/targets.
Regressions: `data-entry-catalog.test.mjs`, native pattern/size tests, source motion
guard, docs lint/types/format, built SSR/route ownership checks and targeted browser
review of anchors, drafts/selection, light/dark and320px/desktop layout. Test
discovery does not prove browser-suite or CI execution.

## Shared Splitter and workspace composition (2026-10-14)

- `AtlasSplitter` renders the installed native Splitter/Panel and owns two stable,
  named, bounded panels. The caller owns records, selection, drafts and actions.
  Auto starts stacked at320px and uses measured container area for horizontal
  composition; changing orientation keeps the same content tree mounted.
  Adaptive canvas width is independent from the legacy content preview profile:
  default mobile collections keep their record-list flow while full-width canvas
  and the explicit Data table/desktop examples remain available.
- The native6.6.6 separator lacks keyboard resize and touch cancellation. The
  adapter supplies one Pointer Events/capture/cancellation path, axis arrows and
  Home/End, a named/control-linked separator, reserved32px/48pxcoarse grip space,
  visible non-drag panel actions and a non-surrounding focus marker. Never patch
  vendor bytes or hide keyboard focus. Both panels remain available; no collapse.
- Data table, Collection views, Record details, Record forms and Record workspace
  consume this master. Page/profile changes must preserve owned state. Tables
  retain contained horizontal scroll; form commit/cancel and inspection remain
  separate. Splitter geometry never commits data.
- `atlas-splitter.css` loads only on Splitter/Data workspace routes; presentation
  CSS `splitter-catalog.css` belongs to Splitter alone. No second mobile content
  tree, Storybook promotion, new runtime engine or server persistence is implied.
- Targeted regression: `node --test docs/tests/splitter.test.mjs
docs/tests/splitter-page.test.mjs docs/tests/workspace-splitter.test.mjs`.
  Existing motion/accessibility gates, docs:check/lint/format/build/test:site and
  docs:browser:check remain mandatory. Browser discovery is not runtime proof.

## Breadcrumb and Card presentation (2026-10-14)

- `AtlasBreadcrumb` uses native Breadcrumb/Dropdown/Menu. Ancestors have real
  hrefs, the current page is readable non-link `aria-current=page`, and sibling
  menus have a separate named button with native arrows, Enter/Space activation
  and immediate Escape focus return. Preserve one real anchor activation; no
  hover-only navigation or fake hash destinations. Decorative icons use shared
  Phosphor assets; icon-only home retains its name. Route-owned CSS wraps at320.
- Card defaults to a borderless surface, one primary name and no optional cover.
  Native nested cover/body/footer corners follow one enclosing0/3/5px radius;
  interior cover corners are square. Do not restore the native8px child corner
  against the header or a full-pill Card radius. Outline/cover remain explicit
  Tweaker options; native actions, tabs, state and profile ownership stay intact.
- Targeted gates include `node --test docs/tests/breadcrumb.test.mjs
docs/tests/card.test.mjs`, source motion and production route/style ownership.

## Dropdown action menus (2026-10-14)

- `AtlasDropdown` renders native Dropdown/Menu. Root and submenu popups retain
  native focus refs, bounded viewport alignment and owned scrolling; a plain
  popupRender div must not replace the native Menu.focus ref. Menus open by
  click/Enter/Space/Down, arrows traverse choices/levels and Escape returns focus.
- Groups/dividers, disabled branches and dangerous local actions stay explicit.
  Enabled leaf actions invoke one consumer callback; they do not imply a remote
  operation. Object/function semantic classNames/styles remain actual native APIs.
- Master/catalog CSS loads only on Dropdown. Native inner-layer specificity must
  retain central positive Cubic motion and avoid duplicate padding, focus rings
  and offscreen popups. `component-motion.test.mjs` rejects unsafe authored motion
  for Splitter/Breadcrumb/Dropdown and changed Card, including negative fixtures.
- `node --test docs/tests/dropdown-page.test.mjs` is part of docs:test; retain
  meaningful disabled, action-once, submenu, outside-dismiss and native autofocus
  coverage. Production ownership, types and browser checks remain separate.

## Backend-independent GenUI contracts (2026-10-14)

- GenUI core is backend-independent. Frappe compatibility belongs in an explicit
  adapter, not in component contracts, rendering or the core query interface. UI
  remains Ant Design with native X Cards/A2UIv0.9 and X SDK2.9.0. Do not add
  FastAPI/SQLAlchemy or a second renderer. The lab is a recorded local stream,
  not a connected language model or live service. Server authentication, tenant
  scope and query authorization remain server duties. Existing Frappe coupling
  in definitions.ts is migration work, not proof that this boundary is complete.
- `genui/policy.ts` validates bounded plain JSON, versions, local catalog allowlists,
  safe identifier bindings, component schemas, purpose requirements and graph
  structure before native rendering. No arbitrary HTML/CSS/JS, remote catalog,
  model-authored provenance, SQL, tenant override or unrestricted Frappe method.
- One stable native Box/Card per surface generation receives a full current
  three-command snapshot; canonical host drafts overlay incoming updates. Sequence,
  request epoch, stale rendered revision, action capabilities and action nonce are
  host-owned. Delete/recreate and explicit restore start fresh native lifecycles.
  Loading/error/cancellation retain the last valid view. Local errors remain visible
  and connected to fields; retry is an explicit registered capability.
- X SDK stays behind the Card lab dynamic import on user intent. Native request,
  stream, provider and conversation APIs are used with bounded host cancellation,
  fresh LF/CRLF/multiline SSE parsing and no automatic mutation retry. Conversation
  pool keys and history are bounded; upstream global store limitations are recorded.
- Reusable Card definitions persist versioned structure and registered query bindings
  only, never record results or current user drafts. Rendering runs allowlisted queries
  without a model call. Panel and public catalogs/tools remain separate. The injected
  `createFrappeQuerySource` defines constant server method contracts; this checkout
  does not install those methods or prove server permissions. Storage failure remains
  visible with memory fallback. Frontpage outputs are read-only.
- Regressions: card/card-primitives/card-workspace, genui-runtime/genui-definitions/
  genui-sdk, shared component motion, strict docs types/lint/format, built route/asset
  ownership, and browser contracts. Distinguish recorded/JSDOM/build evidence from
  actual browser/device/network/CI and live Frappe/model evidence.

## Shared Pagination (2026-10-14)

- `AtlasPagination` composes existing AtlasButton surfaces with native branded AntD
  Select/Input. It owns no records or fetching. Hosts control current/total/pageSize
  and one onChange callback. Boundary pages1/2 and last-1/last appear once, alongside
  current±1. Gaps are descriptive, noninteractive ellipses; single missing pages are
  shown. First/previous/next/last actions are separate named buttons.
- Existing solid/outline/tint/text/link surfaces are reused; ordinary and active
  surfaces can differ. One current page has aria-current and a separate single-edge
  marker even for text/link. sm/md/lg targets inherit48/56/64px. No new button renderer,
  dashed/dotted variants or surrounding focus frame. Shared positive motion tokens
  govern marker paint; semantics/focus are immediate, with reduced-motion handling.
- Empty results have no numbered destination. Disabled or boundary actions never
  invoke callbacks. Explicit page jumps reject fractions/non-numbers/out-of-range
  values visibly and prevent surrounding form submission. Changing page size retains
  the first visible record. Unfinished input survives unrelated presentation changes.
- RecordCollection retains controlled/local page and scoped query/group resets.
  EditableGrid retains editor closing and drafts; errors and pending/unknown operations
  block all paging. Pagination CSS is shared by Pagination and Record workspace;
  catalog CSS belongs only to Pagination. Four linked catalog sections keep real
  navigation inline and presentation options in the shared closed Tweaker.
- Gates: pagination/pagination-page/pagination-workspace tests, component motion,
  docs format/lint/types/build/site and browser contracts. Discovery is not browser
  execution. Native AntD Pagination lacks this full boundary/endpoint contract; do
  not invent unsupported native props or wrap its clickable listitems in extra buttons.

## Documentation light canvas (2026-10-14)

- Documentation light paper is exactly#e6e2d7, owned by docsThemeColors and emitted
  through docsThemeStyleText at the root, including the no-data-theme fallback.
  docsAccessibleThemeColors and runtime variables consume the same documentation
  layer. Shared themeColors/themeStyleText keep the approved/Storybook paper.
- Dark mode, panel and field fills follow the consolidated role decision above (shell `#191302`, panels `#ffffff` / `#2c2c2c`, fields `#ececec` / `#1b1b1b`). Existing accessibility role
  colors apply in no-JS fallback as well as explicit light mode; normal text roles
  pass4.5:1 on the chosen canvas. This pair check is not full WCAG certification.
  Do not replace this exact user color with a nearby neutral to satisfy a test.
- Regression: docs-light-background/theme tests, affected accessibility/brand tests,
  built root stylesheet and actual computed canvas color. Preserve literal CSS px,
  Outfit and browser root/zoom preferences. Source proof is not browser/CI proof.

## Shared Steps (2026-10-14)

- `AtlasSteps` renders installed native AntD6.6.6 Steps with modern orientation,
  titlePlacement and items.content APIs. Host owns current, data and validation;
  callbacks/ReactNode slots belong to the trusted UI adapter, not model JSON.
  This documentation component is not a registered/live GenUI capability.
- Auto starts vertically in SSR, measures its container (640px minimum inline
  area) and retains a stacked journey below480px viewport height. Explicit
  Horizontal is a preferred wide layout; narrow containers still stack. Preserve
  one mounted native tree, fields, focus and drafts across layout/theme/locale/size.
- Native sm maps to small and md/lg to medium. Marker sizes use shared32/40/50px
  selection geometry; interactive items retain48/56/64px targets. No unsupported
  native large size, library-default radius or new approved decision.
- A bounded native6.6.6 adapter adds current/disabled semantics and arrow/Home/End
  focus movement. Native Enter/Space/click activation remains single and immediate;
  disabled/current destinations cannot invoke onChange. SSR title current semantics
  transfer to the native item after commit without duplicate current indicators.
- All native title/icon/content/rail paint uses central positive Cubic motion.
  Navigation replaces native animated underline/geometry with a fixed edge;
  keyboard focus has one immediate non-surrounding mark. Reduced motion wins.
- Steps owns its master/catalog CSS and four linked groups: guided local setup,
  layouts/markers, states/recovery and revisitable navigation. Settings remain in
  the shared initially closed Tweaker. Local confirmation is not a server save.
- Gates: steps/steps-page tests, component-motion, strict docs type/snippet checks,
  lint/format/build/site ownership and browser contracts. Browser discovery alone
  is not runtime, device or CI proof. Storybook/legacy/GenUI registries stay separate.

## Shared AutoComplete (2026-10-14)

- `AtlasAutoComplete` uses installed native AntD6.6.6 editable AutoComplete, with
  immediate controlled onChange and explicit suggestion onSelect. It accepts local
  suggestion data with unique keys/values and optional grouping, description,
  metadata, keywords and disabled state. Custom values remain usable without a match.
  Do not replace controlled typing with onSearch or silently select the first item.
- Host owns text, selected context, validation and suggestion availability. Empty,
  loading and unavailable suggestions retain editable text and explain the state;
  Retry is an explicit host callback. Demo loading/error states are local samples,
  without fabricated requests, progress or timers. IME composition cannot accidentally
  activate a suggestion. Error feedback is linked and announced; warning stays editable.
- Native keyboard navigation, clearing and popup dismissal are preserved. Branded
  popups wrap useful descriptions at320px, retain48/56/64px controls and provide one
  immediate non-surrounding focus mark. Central positive Cubic/reduced-motion rules
  govern native item paint. No visible OS menu, extra ring or bespoke combobox engine.
- Four linked catalog sections cover contextual documentation search, free-text/email
  completions, suggestion recovery and field availability. Actual fields/actions stay
  inline; property settings and shared sizes stay in the initially closed Tweaker.
  Changes of size/detail/theme/locale preserve mounted fields, drafts and selected
  context. Editing or clearing the query removes stale selected context.
- Master/catalog CSS belongs only to AutoComplete until a real consumer is added.
  Gates: autocomplete/autocomplete-page tests, shared component motion, strict docs
  type/snippet checks, lint/format/build/site ownership and browser contracts. Browser
  discovery is not execution. No new packages, Storybook approval or GenUI registration.

## GenUI native Atlas direction and Cascader (2026-10-14)

- User direction: every Atlas component is to become GenUI native through an
  explicit serializable contract, validated state/events, approved capability
  registry and trusted native adapter. A React export or catalog entry alone is
  not a GenUI capability. Existing registry has12 names; do not claim all controls
  are registered yet. Core must work without Frappe, while an optional Frappe
  adapter preserves fixed method, parameter, tenant, authorization and cancellation
  boundaries. No generic remote-method/URL dispatcher or serialized callback.
- New Cascader uses native AntD6.6.6 navigation/check conduction and controlled
  stable paths. Search is token-based across full paths; lazy loading is a separate
  browse-only mode. Native clear can returnundefined and must normalize to[].
  Repeated leaf values under different parents are valid; sibling values are unique.
- Cascader page has five linked journeys: search, multiple selection, path display,
  availability and local lazy reveal. Property settings belong in initially closed
  Tweaker. Native control profiles48/56/64 and selection handles32/40/50 remain.
  Contain columns at320px and keep active keyboard column visible; no surrounding
  focus ring. Central motion/reduced-motion gate applies.
- Cascader is unfinished until native behavior, SSR/types/snippets, route-only assets,
  browser UX and independent QA pass. GenUI registration is a separate explicit
  contract/policy/runtime/adapter step; do not flatten hierarchical values into
  AtlasChoice or hijack unrelated query tools.
- Temporal controller lives at /Users/w6x/Developer/atlas-temporal. Master plans and
  reviews tests; Claude authors proposals; actual test execution/RED/GREEN and
  integration require evidence.51 configured slots is not51 proven active agents.
  Never weaken acceptance tests, suppress user hooks or bypass the Git guard.

## Documentation presentation standard (2026-10-14)

- `docs/src/data/documentation-rules.json` is the single machine-readable ECA
  source: page kinds (overview, guide, tokens, color-lab, decisions, legal,
  standard, component), the shared component section order usage → examples →
  code → astro → accessibility → notes → api → resources (showcase, then the API
  and resources reference column), and stable ruleIds with
  event/condition/action/severity. `/documentation/` publishes every declared rule,
  page type, section order, source map, admission workflow and verification limits.
  Foundation routes are listed per kind; component routes are classified from their
  real `/components/<slug>/` path, never from an enumerated slug list. Unknown
  routes fail closed. Add a rule to the JSON and the standard page together.
- `tools/docs-presentation.mjs` exports `validateBuiltPage(html,{path})` and
  `validateBuild(outputDirectory)` using the installed JSDOM. The
  `atlas-docs-presentation` integration in `docs/astro.config.mjs` runs it at
  `astro:build:done` on every generated HTML page and fails the build on findings.
  It inspects built markup only; it is not computed-style, browser, device or CI proof.
- Every documentation page has one h1. Each `section[data-doc-section]` has an
  equal id, an h2 name through aria-labelledby and exactly one link in the 320px
  `nav[data-doc-nav="sections"]`; an optional desktop `nav[data-doc-nav="toc"]` is
  checked independently. Pages render both through shared `DocumentationNav.astro`
  (`items: {id,label}[]`, `variant: 'sections' | 'toc'`) and supply their own stable
  section IDs and labels. Foundation pages keep their content and stay free of
  React islands; `/color-system/` keeps its single existing demo island.
- `/getting-started/#astro-integration` is the single shared Astro guide target.
  Every component Astro integration section links there; renaming or duplicating
  that ID fails the build-wide check.
- Surfaces: prose stays on the paper canvas, each live demonstration area uses one
  shared panel, and API tables/code keep their bounded surfaces with scrolling
  inside their containers. No full-article whitening, repeated card wrappers,
  ornamental borders or surrounding focus rings. The 14px/22px profile is retained.
- Admitting a new component means catalog data plus the shared route passing the
  full contract: local API with a usable https ant.design official reference, Astro
  integration with a trusted island example and guide link, and resources naming
  catalog, route/layout, React adapter, styles/tokens, AGENTS instructions, tests and
  GenUI `docs/src/genui/contracts.ts`, `docs/src/genui/policy.ts` and the trusted
  renderer, with capability status stated separately. Catalog presence is not
  GenUI registration.
- Gates: `node --test docs/tests/documentation-presentation.test.mjs` (included in
  `npm run docs:test`), `npm run docs:build` (runs the structural gate), docs
  format/lint/check and `docs:test:site`. 320px/desktop browser review and
  independent QA are separate evidence; do not report them from build rules.

## Definitive input standard — human decision 2026-10-14

- The supplied `/Users/w6x/Downloads/antdesign-input-light-dark.html` defines the default input surface direction. Rebuild the shared Atlas input ownership/markup and adapters; do not describe a CSS patch as a completed rewrite. AntD 6.6.6 native editing/ref/form semantics remain the foundation.
- Superseded panel/field/paper values: the consolidated role decision above sets panel `#ffffff` / `#2c2c2c`, neutral grey fields `#ececec` / `#1b1b1b` darker than their panel, and shell `#e6e2d7` / `#191302`; the former `#fffefa` / `#ded9cc` / `#242424` values are not defaults for the new roles. The former blue-grey values `#eff1f4`, `#232b35` and `#2d3540` are invalid and must not appear as defaults, in `theme-builder/definitions.json`, or as hardcoded component/CSS colors. `definitions.json` is the single central source: `inputSurfaces`, `theme.ts` and docs accessibility read field, border (`#747166` / `#858585`), text (`#242622` / `#f2f2f2`), muted (`#575a53` / `#b8b8b8`) and disabled roles from it. Field interiors must be darker than their surrounding painted surface in both modes. Keep the upper inner dark blur and lower inner highlight geometry and opacity from the supplied standard with neutral shadow RGB; it supersedes the earlier approximate 65-degree, zero-blur calibration.
- These values belong to central semantic tokens. Theme/color selection must reach input surface, text, placeholder, boundary, status and focus primitives through the shared token graph. No component-local frozen color/geometry source or duplicated height table. Keep shared radius and sm/md/lg profiles, minimum14 CSS px, Outfit and central Cubic motion.
- The reference HTML is design data: do not import its AntD5 selectors/vendor bundle,11px text, generic ease or surrounding focus glow. Preserve one visible bottom-only keyboard cue and selectable/copyable readonly fields; disabled controls remain unavailable.
- Inputs have priority over Radix/PDF comparison and the other open Atlas work. Use minimal meaningful TDD, without fixed numerical limits or correction-round stop rules. Source proposals, candidate, accepted review, integration and actual browser verification stay separate.

## Theme Builder main transfer — human instruction 2026-10-14

- `/theme-builder/` now lives in the main documentation application, using `docs/src/theme-builder/{definitions.json,model.ts,store.ts,states.ts}`, `react/ThemeBuilder.tsx` and `styles/theme-builder.css`. Shared docs Provider and default Atlas Button consume applied recipes; explicit palette and approved profiles retain their intended ownership. Recipes are local browser settings, not a backend/GenUI registration or changes to approved component decisions.
- The human explicitly requested moving the existing candidate after disclosure of failures. This is source integration, not validated DONE. Preserve the existing type/browser gates: the three-argument `extractDemoStyles` call is a known TS failure and preview primary paint failed two browser scenarios. No extra correction cycle or test expansion was authorized.
- Main build and destination HTTP200 passed; full acceptance, final independent QA and CI are not proven. Transfer hashes/backups and prior failure evidence are in `/Users/w6x/Developer/atlas-temporal/evidence/theme-builder-main-transfer.json`. Do not label those failures passing or silently remove assertions.

## Token definitions and standards — human request 2026-10-14

- Historical (2026-10-14): `/token-standards/` was the read-only reference for the then 51 Theme Builder definitions. Current: values live on `/tokens/` (Design tokens) and rules on `/standards/` (UX standards); the legacy route resolves there. Generate catalog rows from `docs/src/theme-builder/definitions.json` via `tokenDefinitions`; units, defaults, bounds and choices must not be maintained as a second numeric catalog. Shared state/measurement/surface/layer metadata comes from `states.ts`; motion remains central.
- Keep the sidebar and `/tokens/` links, Turkish dictionary and existing token-kind route registration. Machine identifiers and CSS bindings remain literal. Presets are not current browser-applied values; documented standards do not prove complete component runtime bindings or GenUI registration.
- Verification commands for this route: `npm run docs:build`, `npm run docs:lint`, `node --test docs/tests/documentation-presentation.test.mjs` and the six changed source files' Prettier check. Actual Chromium320 evidence and independent CLI review are recorded separately in `/Users/w6x/Developer/atlas-temporal/evidence/token-standards-integration.json`. Existing Theme Builder TS/paint failures and unrelated Cascader formatting failures remain open; never promote the full application gates to PASS from this page's checks.

## Latest human background correction — 2026-10-15

Superseded by the consolidated role decision above: documentation shell `#e6e2d7` / `#191302`, main panel `#ffffff` / `#2c2c2c` and fields `#ececec` / `#1b1b1b`. The input-reference blue-grey surface must not set global documentation paper/panels. Theme Builder factory definitions follow these restored values; explicit custom recipes still work. This supersedes the prior global-canvas interpretation of the input reference.

Both Select and Dropdown open-state selectors drive the same background-only 1px backdrop blur. Open triggers and native portals remain sharp above it; native outside-click/Escape dismissal is preserved. Regressions live in the existing contracts.spec.ts. Actual focused palette and Dropdown cases passed; the retained full Select case remains failed on its independently preexisting border assertion.

## Referenced selection and filter UX — 2026-10-15

Shared native selection examples preserve full label/card hit areas, disabled choices and single/multiple/toggle semantics. Checkbox groups expose select-available, mixed/all/none, visible selected count and clear; unavailable choices are excluded. Selection badges reserve their geometry, so selection must not change card height. Switch changes take effect immediately with visible local status. Keyboard focus uses one immediate, non-enclosing label underline; do not add a second wrapper/native ring.

`DateRangeFilterExample.tsx` separates draft from applied filters. Apply commits a complete valid period and optional comparison atomically; Cancel restores the entire draft, including comparison dates and edit state even after comparison is disabled. The sample cutoff is explicitly fixed/local: label its preset Latest available day, never pretend it is the real current day. The old held date serializer remains excluded.

`DepartmentSelectExample.tsx` uses native AntD search/options, explicit local creation for a new normalized name, duplicate prevention and a permanently available clear action returning focus to Select. These examples are local demonstrations, not backend writes. New prose belongs in the three `ux-*.json` Turkish dictionaries.

Bounded verification: ONE new `docs/browser/ux-guidance.spec.ts`, THREE scenarios, shared two correction cycles exhausted and 61,952ms focused checks. Date and Department scenarios PASS; combined selection scenario FAIL at a root-scoped nested Switch title locator before Switch acceptance. Existing unmodified selection regression file: three PASS. Do not mark new UX DONE or silently fix/skip the failed oracle without authorization. Build39 and lint143 PASS; docs:check retains the separate Theme Builder TS2554 failure. Browser TypeScript/discovery lists510 cases across10 files; discovery is not execution. Independent terminal review02 is BLOCKED on that same test gap, with the prior five source findings addressed. Evidence: `/Users/w6x/Developer/atlas-temporal/evidence/ux-guidance-outcome.json`. No broader matrix, CI or device proof is established.

## Native Ant Design X Hybrid UI first slice — 2026-10-15

- `@ant-design/x` is pinned to2.9.0 alongside existing X Cards/X SDK2.9.0 and AntD6.6.6/React19.2.0. The optional Card GenUI lab uses native Sender, Bubble.List, Prompts and XProvider with its existing SDK/runtime and stable Atlas input adapter. Do/Do+Chat/Chat are presentation-emphasis profiles, not separate pipelines or live AI services.
- One mounted composer/canvas and host session own scope, input, SDK messages, request and revision. Preparing an order review selects the recorded scenario and focuses the composer; explicit submission starts the existing recorded stream. Task table selection/review-note drafts survive profile changes. Prompts use an actual AtlasButton for keyboard access. Keep the restored global palette/blur and shared input/focus tokens intact.
- The lab remains a labelled local recorded fixture without a connected model/server. No arbitrary generated HTML, new catalog capability, server permission, persistence or live execution claim follows. This is a first Hybrid UI example, not adoption of all official patterns or all X components.
- Source integration is **acceptance blocked**: final Chromium320 scenario1(state continuity) and scenario2(order review) PASS. Scenario3(resource/focus/sizing/dark/resize) FAIL before its later assertions: Astro still links/requests the feature CSS before opening the lab. The native lab JavaScript entry was observed only after opening; transitive resource isolation is not proven.
- The new browser test also introduces THREE TS2339 errors by using obsolete `d`/`n` properties against es-module-lexer3.0.3's Import API. Do not hide, skip or weaken this failed gate. Main docs types retain the separate existing Theme Builder TS2554; motion retains the old atlas-feedback.css failure. Build39 and lint143 PASS.
- Shared budget: ONE new behavioral testfile `docs/browser/hybrid-ui.spec.ts`, THREE scenarios, TWO of TWO correction cycles exhausted. Measured browser/control checks62,991ms. No additional fix/test expansion is authorized; preserve failures and record unexecuted later checks as not_run. Independent terminal review and outcome: `/Users/w6x/Developer/atlas-temporal/evidence/hybrid-ui-outcome.json`.
- Official design reference: https://x.ant.design/docs/spec/hybrid-ui-design-cn/ . Actual checks are docs:build, docs:lint, docs:check, browser TypeScript, existing component-motion gate and the SAME three focused browser scenarios. Build success and source imports do not prove conditional CSS delivery, cross-browser behavior, physical devices or CI.

## Form grouping standard — human instruction 2026-10-15

Group related fields by their purpose, using native `fieldset` with a meaningful `legend`. Use a named `section` for a larger form stage or distinct task region. Do not wrap individual fields in Cards merely to create visual separation; do not create a separate group for every control without a semantic reason. A genuine independent record/artifact may still use Card. Group boundaries come from headings, alignment and shared spacing; field boundaries/error states remain functional.

The basic Form example now groups Full name/Email as Profile details and Team/updates as Workspace preferences. The record-form example's three existing stages have native fieldset legends. Accordion retains its heading/button and an accessible visually hidden legend; tabs retain their panel labels. Keep one native form/store, field names, validation/help/label connections, draft ownership, disclosure lifecycle and focus. Do not nest form tags or change availability through a blanket disabled fieldset. Shared kit RecordForm already meets the semantic grouping rule and was not changed.

Own grouping styles in components.css and workspace-forms.css: transparent, borderless fieldsets, token-based spacing/typography and native input wells retained. Form grouping does not authorize changing the approved page backgrounds, input colors/radii, sizes, focus rule, motion or unrelated AI/Theme Builder defects. English is canonical; the two new group names are translated in the registered Turkish react dictionary.

Focused evidence: ONE new form-sections.spec.ts with THREE scenarios. Basic group semantics/transparent appearance and validation/local-result/reset PASS after the final label-selector correction; workspace step/draft continuity and320/1440 reflow PASS on identical application source before that test-only correction and were not needlessly repeated. Shared two correction cycles used (nested line-legend selector scope and required Team control's label locator), measured focused execution20,765ms. Build39 and lint143 PASS. General docs types still fail on the held Theme Builder TS2554; browser types still fail on the preceding Hybrid UI test's THREE TS2339 errors, with no new form diagnostics. Independent review and evidence: `/Users/w6x/Developer/atlas-temporal/evidence/form-sections-outcome.json`. This is scoped form delivery, not whole CI/cross-browser/device acceptance.

## Contextual empty states and profile images — human Refactoring UI request 2026-10-15

Apply hierarchy through meaningful headings, readable measure and shared spacing before decorative borders or Cards. The supplied book is reference data; it does not override Atlas's approved canvas, input wells, Outfit, minimum14px, sizes, radius, focus or motion. Do not add per-field Cards, copy book assets, or imply functionality that is absent.

`AtlasEmptyState.tsx` wraps native AntD Empty for first-use, no-match and error, with an explicit heading/explanation and one optional caller-owned action outside the single live text region. `workspace/kit/StateSurface.tsx` reuses it only for those three kinds; ready/loading/denied/not-found/partial/stale/unknown semantics and content gating remain intact. A missing callback does not grant recovery. First-use examples hide unusable collection tools; no-match keeps the search reachable and preserves its value until explicit clear. When an action disappears, its local result receives visible non-enclosing programmatic focus.

`AtlasAvatar.tsx` wraps native Avatar with one accessible full name, decorative inner image, inherited canonical sm/md/lg dimensions, fixed image cover and initials fallback; whitespace-only names use a question mark with Unknown person as the accessible name. Initials remain >=14px. Uploaded images never determine the control geometry; color never invents online/role status. `atlas-avatar.css` is linked by its owning page. Both new pages follow the shared component documentation contract and registered `content-ux.json` Turkish dictionary. No backend/upload/cropping service, Storybook promotion or GenUI registration is implied.

Focused verification uses ONE `docs/browser/refactoring-ui.spec.ts` with THREE scenarios, five-minute shared ceiling and two corrective batches. The first-use/create/focus and Avatar image-failure/geometry/name scenarios passed in green01; the recovery scenario passed after correcting its supplied action-label lookup in green02 on unchanged application source. Build41/ECA structure and lint148 pass. General docs/browser type gates retain earlier ThemeBuilder/Hybrid failures; kit translation-subset and feedback motion failures remain disclosed. Full CI, other engines/devices and complete PDF adoption are unproven. Actual logs/outcome live in `/Users/w6x/Developer/atlas-temporal/evidence/refactoring-ui-outcome.json`. Do not rerun passing checks without a relevant source change or concrete defect. Continue authorized fixes under the current minimal-TDD policy; historical correction counters do not block implementation.

Refactoring UI delivery acceptance remains **INCOMPLETE** after independent review: Avatar catalog page links its CSS, but copied React/auto-generated Astro usage examples omit the required stylesheet. Paired-name duplication and structured resource inventory omissions are also open. Two corrective batches are exhausted; do not silently fix/waive these or mark the whole delivery DONE. Outcome and review02 above are authoritative.

Neutral warm field palette (human decision applied 2026-10-15): `theme-builder/definitions.json` is the single central source for field `#ececec` / `#1b1b1b` (the earlier light `#ded9cc` is superseded by the consolidated role decision), border `#747166` / `#858585`, text `#242622` / `#f2f2f2` and muted `#575a53` / `#b8b8b8`; disabled roles keep their own `definitions.json` values, with disabled text equal to muted, so every text role keeps at least 4.5:1 and the field border at least 3:1 on field, panel and canvas. Panel and field surfaces are neutral greys with equal RGB channels in both modes; the warm shell canvas (`#e6e2d7` / `#191302`, R >= G >= B, no blue overshoot) is a separate role. Shell `#e6e2d7` / `#191302` and panels `#ffffff` / `#2c2c2c` follow the consolidated role decision; brand, status, motion, font, radius, shadow geometry and explicit custom recipes are unchanged. TDD exception for this regression: exactly one new node:test file with one scenario, `docs/tests/neutral-field-surfaces.test.mjs`, bundles the real theme, input-surface, accessibility, Theme Builder model and color-system modules with esbuild, fails against the former blue-grey sources and passes after the central change; no further test waves or fixtures are added for it.
Decorative inset paint edge (human correction applied 2026-10-15; supersedes the earlier forced bright four-side field perimeter, which was a paint-role confusion and is not an approved look): the field well rests on the decorative `insetBorder` role from `inputSurfaces` (light neutral ink `rgba(26, 26, 26, 0.035)`, dark neutral white `rgba(255, 255, 255, 0.02)`), exposed as `--atlas-input-inset-border` on the provider and as the `--field-inset-border`, `--field-inner-shadow` and `--field-inner-hover` root aliases from `theme.ts` for owners outside AtlasProvider such as the sidebar search. This edge is decorative and carries no 3:1 contrast claim; the functional `--field-border` token (`#747166` / `#858585`) and its 3:1 contract are unchanged for checkbox, radio and other functional boundaries. At rest every physical border width of a field equals `--field-border-width`: no reserved thick bottom stripe and no surrounding contrast frame. Focus paints exactly one immediate bottom-only marker (`--focus-marker` tall) as a background layer inside the well over the retained reference inner shadow, so geometry never shifts; no ring, glow or sidebar label underline doubles it. Text keeps at least 4.5:1 and focus/status cues at least 3:1; `definitions.json`, surfaces, sizes, radius and layout are unchanged.
Overlay backdrop standard (permanent human decision applied 2026-10-15; standard and central implementation integrated; runtime acceptance and human visual approval tracked separately): every user-opened upper layer, meaning Dropdown, Select, AutoComplete, Cascader, DatePicker, TimePicker, range pickers, rich menus, Popconfirm, Popover, Drawer, Modal and the Tweaker, dims the page behind it with a neutral scrim and a fixed 1 px background blur. A non-modal panel and its bound trigger stay sharp above the scrim; Drawer and Modal blur the whole background including the trigger. Toast and Notification are excluded. Tooltip is included by the latest human decision: the scrim and blur apply only while a Tooltip is actually visible after hover or keyboard focus, its existing delay is preserved, and the Tooltip popup and its trigger stay sharp. Closing keeps the clip, stacking and trigger cut-out until the fade ends; the controller stays safe to import during SSR and paints through a single body pseudo-element. Native outside click, Escape, focus return, the 14 CSS px minimum and readability are preserved. `docs/src/theme-builder/definitions.json` is the single role source for the six `overlay` group tokens `overlay-scrim-color`, `overlay-scrim-opacity`, `overlay-backdrop-blur`, `overlay-scrim-z`, `overlay-trigger-z` and `overlay-popup-z` (black scrim in both themes, opacity 0.12 light / 0.24 dark, fixed 1px blur, base layers 1040 / 1041 / 1050), raising the catalog from 51 to 57 definitions; the helper, root and resolver in `docs/src/theme-builder/model.ts` and `docs/src/theme.ts` generate `--overlay-scrim` RGBA, `--overlay-backdrop-blur` and the z roles, and the documentation catalog is generated from `tokenDefinitions`, never hardcoded. Motion aliases `--overlay-open-duration: var(--press-duration)`, `--overlay-close-duration: var(--release-duration)` and `--overlay-easing: var(--motion-easing)` point at the central symmetric Cubic contract and introduce no new timing; reduced motion is instant. `--dropdown-scrim`, `--dropdown-backdrop-blur`, `--dropdown-backdrop-z` and `--dropdown-trigger-z` remain compatibility aliases only with no duplicated values. Existing modal caller z values are preserved and `layerOrder` metadata is not a universal claim. Theme Builder compatibility: a complete valid 51-token custom recipe stays valid, only the six new roles are filled from factory defaults, strict unknown/partial rejection, the storage key and version 1 are unchanged. New layered components MUST consume the semantic standard and MUST join the existing shared table in `docs/browser/drawer-feedback.spec.ts` with one row; no separate spec file or new wave. The rule is documented in `docs/src/pages/standards.astro` (`layers`, legacy anchor `overlay-standard`), its values in `docs/src/pages/tokens.astro`, and in `docs/UX-STANDARDS.md` (the former `token-standards.astro` location is history); this entry records the decision and is not evidence that runtime, browser scenarios or screenshots passed. The central helper `data/overlay-tokens.ts` and the controller `overlay-backdrop.ts` are the single runtime owners of the overlay roles; the one existing shared table in `docs/browser/drawer-feedback.spec.ts` is the only browser oracle and gains no separate spec file or case wave. The initial real RED is `overlay-backdrop-red-full.log`; the outcome record is `/Users/w6x/Developer/atlas-temporal/evidence/overlay-backdrop-delivery-20261015.json`, written by the root conductor after the checks finish. Current runtime acceptance is recorded in the linked outcome receipt; this source documentation is not evidence of passing browser or CI checks or of human visual approval.
