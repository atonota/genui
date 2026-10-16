# GenUI maintenance contract

## Black dark documentation shell and canonical sidebar search — human task 2026-10-16

Newest human task; a precise, human-authorized exception to the color freeze in
the entries below, for the dark shell only. Older entries stay as history.
Results are PENDING; this entry claims no executed check and no DONE.

- Only `canvas.defaults.dark` in `docs/src/theme-builder/definitions.json`
  moves from `#191302` to `#000000`; theme.ts already aliases `--paper` to
  `--shell-bg`, so the dark header, left sidebar, Drawer, right contents rail
  and footer turn black. Light values, panels, fields, accent, the approved and
  Storybook `themeColors.dark.paper` (#242424) and the definition count stay;
  no new token, CSS black override or `!important`. Saved Theme Builder
  recipes keep their values and are not migrated.
- The sidebar search stays the static SSR native `#component-search` under its
  label, i18n and autocomplete (DocsLayout filter and Drawer move unchanged; no
  island, hydration, dependency or JS). DocsNav renders it inside a canonical
  `.atlas-input-frame[data-atlas-input=text][data-size=md]` fed by
  `inputSurfaceAliasVariables`, `inputPaddingInline` and the md atlas size
  profile. `docs/src/styles/atlas-input.css` is the single paint owner (its
  native-child reset covers `input.atlas-input-native`), focus-fields.css owns
  the Tab-only bottom marker, and the narrow forced-colors frame rules apply.
  Sidebar fill/border/shadow/radius/marker copies in nav.css, shell.css and the
  forced-colors block are removed; legacy sidebar placeholder rules in
  docs-accessibility.css only reach unframed inputs.
- Correction to the initial quiet search choice: the shared GenUI input gains
  an `underlined` variant. AtlasInputFrame takes an optional `variant` typed
  from AntD `InputProps['variant']` (default `filled`) and emits
  `data-variant`; the AtlasInput wrappers and AtlasInputNumber forward their
  native variant. Only `[data-variant=underlined]` in atlas-input.css paints
  the rest bottom edge with the functional `--atlas-input-border` (fallback
  `--field-border`) at the unchanged 1px width; other edges keep the quiet
  inset edge, and fill, inset shadow, radius, height and type stay. Status,
  disabled and forced-colors rules still override it; the default `filled`
  master look is unchanged. DocsNav opts the sidebar search into the same
  variant, with no sidebar paint copy. Rest and focus are separate criteria:
  the resting edge needs 3:1 against the unfocused fill and the Tab-only
  bottom marker needs 3:1 against the focused fill; neither substitutes for
  the other.
- Test accounting (authorized scope, not results): existing cases only, 0 new
  cases; the author ran no test. Outfit, the 14 CSS px minimum, central roles,
  Cubic motion and ringless keyboard focus stay. The root conductor records
  actual receipts.

## Normal-laptop component detail presentation, colors frozen — human task 2026-10-16

Newest human task; it rejects the previous detail composition and supersedes
the dated shell-only ownership and the 1600px split threshold below for this
presentation case only. The frozen 59-package backlog is not new scope. Results
are PENDING; this entry claims no executed check and no DONE.

- Geometry only: every existing color, background, border, shadow, opacity and
  other paint value keeps its exact value, selector and media context, and
  role colors are unchanged. Geometry only and no new JS refer to the shared
  shell: layout and shared styles, the 875px sidebar/native Drawer threshold,
  docs-shell.ts and the shell header stay unchanged. The existing shared
  preview renderer alone receives icon markup, central bounded device geometry
  and caption presentation, with unchanged native behavior, theme, state and
  Code privacy. Outfit, frozen type tokens, the 14 CSS px minimum, central
  roles, Cubic motion and Tab-only ringless focus stay; no new JS package,
  framework, asset profile, service or scrollspy. Layout styles keep their old
  paint context; new decorative device hardware reuses the existing preview
  chrome, sensor, panel and ink colors with no new palette or alpha.
- Owned: `docs/src/components/shell/layout.css` and
  `docs/src/styles/documentation.css` for shell geometry, plus the existing
  shared preview renderer `docs/src/react/ExamplePreview.tsx`,
  `docs/src/styles/preview-workbench.css` and `docs/src/data/preview-devices.ts`
  (this case only; it supersedes the earlier preview-workbench.css exclusion).
  Shell geometry variables only: sidebar
  14rem (224px) from 875px with the 16px inset and 48px targets; shell and page
  grid gap 24px. Global spacing tokens are unchanged.
- Component detail from 80rem (1280px): showcase left, API/resources one
  continuous non-sticky right stack, `minmax(0, 1.65fr) minmax(20rem, 1fr)`
  with a 24px gap (showcase >= 560px, reference >= 320px at 1280 and 1920).
  Narrower layouts stack; 320px has no page overflow. The far contents rail
  (16px padding) appears from 100rem (1600px) in both stylesheets; below it the
  Contents disclosure and section links stay. Eight section ids, their order
  and all content are kept; API tables keep their own scroller (full cell
  interaction not certified); prose stays at 65ch.
- Device previews are bounded illustrations, not device emulation, detection or
  asset profiles: 390/820/1280px stay preferred reference maximums, and central
  display caps (iPhone 260, iPad 400, MacBook 384 CSS px screen) bound the
  frame within its column without scaling. Phones and tablets keep portrait and
  the MacBook landscape proportions; every screen shares a 200px minimum and
  grows with its content. The Device · Theme caption sits above the frame, the
  toolbar centres. Known inner titles that duplicate the external heading,
  including the button playground's, are visually hidden (screen-reader only)
  in their known wrappers; external headings and anchors stay untouched.
- Test accounting (authorized scope, not results): the two existing
  component-preview cases and the existing contents-rail case are adapted, 0
  new cases; browser spec files 28 and source test files 80 unchanged. One
  independent review. The root conductor records actual receipts.

## Shell and shared documentation geometry, colors frozen — human task 2026-10-16

Newest human task; it supersedes the dated docs-spacing count below only for
this case. The preview workbench entry (164/40 rows, native behavior) and the
frozen 59-package backlog stay unchanged. This entry claims no executed check.

- Improve the shell and shared documentation pages through geometry, spacing and
  type hierarchy only. Every existing color, background, border color/width/
  style, shadow, opacity, filter and other paint declaration keeps its exact
  value, selector and media context; no new paint, decoration, cards,
  gradients, sticky header or JS behavior. Outfit, the current font and type
  tokens (frozen, unchanged), central roles, Cubic motion and keyboard focus
  stay; every readable shell and shared documentation text stays at least 14
  CSS px, and no text or control shrinks.
- Owned styles: `docs/src/components/shell/{shell,layout,nav}.css` and
  `docs/src/styles/documentation.css`. Definitions, theme, docs brand,
  `docs.css`, `preview-workbench.css` and application components stay
  unchanged; test changes are owned by the test author only as listed under
  test accounting below.
- Header keeps DOM and Tab order (menu, wordmark, meta, language, theme,
  Getting started): at 320px at most 192px with 48px targets and no hidden or
  truncated label; one band from 875px. Sidebar title, search label, group
  labels and link text share one start edge; spacing after a group's last row
  stays within 24px; the sticky desktop sidebar contains its own scroll and the
  Drawer alone insets the moved sidebar. The contents rail keeps 240/256px,
  16px padding and touching 48px rows. Shell sections use one semantic
  `--doc-section-gap`; live previews use one inset step.
- Test accounting (authorized scope, not results): the existing
  `docs/browser/docs-spacing.spec.ts` goes 2 -> 3, the only new case, owned by
  the test author; browser spec files stay 28 and source test files 80. The root
  conductor records the actual RED/GREEN receipt. No PASS/DONE/GREEN claim.

## Component preview workbench and detail layout — human task 2026-10-16

Newest human task; it supersedes the dated Badge/radius scope counts and status
text below as current scope, which stay history. See `docs/AGENTS.md` for the
full entry. This entry claims no executed check.

- All 40 component pages wrap every logical leaf example cluster once in the
  shared `docs/src/react/ExamplePreview.tsx` workbench with a literal unique
  route-prefixed id: Device preview iPhone/iPad/MacBook (default MacBook,
  container widths 390/820/1280 fitted without scaling), Preview theme
  Light/Dark (shared shell theme) and Example view Preview/Code. The preview
  stays mounted; Code is fetched lazily from build-time `/preview-code/<id>.json`
  produced by `tools/docs-preview-code.mjs` with privacy redaction.
- Component detail: showcase column (usage, examples, code, astro,
  accessibility, notes), reference column (api, resources) and the contents rail
  outside the article. `docs/src/data/documentation-rules.json` and the existing
  presentation test follow that order without new cases; the split starts at
  100rem (1600px) and narrower layouts stack. `preview-workbench.css` is linked by
  every component route.
- Test accounting (authorized scope, not results): browser specs 27 -> 28 with
  two cases; source test files 80 unchanged. No DONE/GREEN claim.

## Current authoritative project decision — 16 October 2026

This entry is the current project decision. It supersedes older current-policy
statements, including the 61- and 64-definition counts in the dated entries
below; those entries and their receipts remain dated history. Normative rules:
`/standards/`; generated values: `/tokens/`; component behavior: each
component page. CSS stays in its owning stylesheets; policy text does not copy it.

- Tokens: 65 definitions = prior 61 + 3 Badge size heights + 1 `listy-surface`
  role. All 65 are editable from the Tweaker on every one of the 40 component
  pages. Saved 51/57/60/61/64-token recipes stay valid and receive only the
  missing factory defaults; HEX uppercase canonicalization is unchanged. Native
  Ant Design 6.6.6 and existing dependencies only; no new package is installed.
- Sizes: Listy has 16 actual patterns on the shared `AtlasListyItem`; Listy and
  Cascader rows are compact 32/40/48 px (superseding the earlier Cascader
  regular 48 px statement). Standard Avatar, Button and Input stay 48/56/64 px
  and Select items stay regular. Rows with rich descriptions grow instead of
  clipping. Badge outer heights 20/26/32 px include the border; Badge text
  defaults to 14 px / 400.
- Radius: general radius choices 0px, 3px, 5px and 100%, factory default 5px.
  One edit sets Input, its slot and Button to the same general value in both
  modes. Valid legacy numeric 0..32 values are retained exactly until a choice
  is made. Intentional circle Avatars and explicit legacy gallery corners are
  preserved. Pill, Card and Checkbox documentation defaults inherit the general
  role; the Button corner control shows `Use general radius` instead of a
  misleading fixed 5.
- Tweaker: each of the 40 pages offers its own native props, with no fake
  generic placeholder settings. Common Size and preview states stay in memory
  while the panel is closed. The shared theme/token recipe persists for 30 days
  under the existing storage key until history is cleared or it expires. Not
  every business state is persisted; do not claim that.
- Typography (repeated direct human project exception; do not re-ask 14 vs 12):
  minimum 12 CSS px, default 14 px, ideal reading 16 px; weight default 400,
  minimum 300; Outfit. Global host instruction files are not edited. Listy row
  text defaults to 14 px; a custom token may lower it only to 12 px.
- Surfaces: the input root reuses the canonical `inputSurfaces.innerShadow`
  through the existing resolver, removing the duplicate blue shadow. Fields stay
  neutral `#ececec` / `#1b1b1b`, panels `#ffffff` / `#2c2c2c`; the warm shell
  is unchanged. An outlined field has one functional outer boundary and a
  decorative inset well edge, with no nested field, native border or extra
  shadow. Native Listy host padding/divider are cleared so the outer row owns
  the compact height. Section gaps are at least 16 px through semantic main
  spacing; the TOC targets a 256 px rail with 16 px padding.
- Raw reference HTML and its 31 images are local reference only: not published
  or copied, and their navy colors are not adopted; GenUI keeps its current
  neutral color roles. No fake AI functionality.
- Test accounting (frozen authorized scope, not results): source test files
  80 -> 80; the existing `neutral-field-surfaces` file goes 1 -> 2 cases for the
  actual blue-shadow regression, and only that new case executes. Browser spec
  files 26 -> 27: a new Badge/radius file with 2 cases, docs-spacing 1 -> 2,
  Listy 1 -> 2 and Tweaker 2 -> 3, exactly 5 added browser cases. The first old
  Tweaker case is adapted to the choice API and rerun for 30-day retention;
  other old cases are not rerun. The existing ignored local Pages control and
  HTTP alias checks are separate operational checks. No new matrix, review
  round, catalog scan or frozen59 backlog. Receipt logs stay local; one final
  independent diff review is pending. Source guidance is not runtime, CI or
  Pages proof, and no DONE/GREEN acceptance is stated here.
- Publication: public MIT GenUI, `main`, `atonota/genui`; the karacaismail
  author and committer guard is preserved. New work is UNCOMMITTED as of this
  packet. A supplied receipt reports the fresh Pages artifact control GREEN; the
  actual Pages deployment is NOT YET LIVE. Local root http://127.0.0.1:4324/
  and https://atonota.github.io/genui stay separate. The source API applies
  Pages-only machine-prefix redaction with a credential fail guard; the old
  intentional Avatar/Media error fixtures stay on an exact allowlist only under
  that source guard. Do not claim publication complete; the live-host
  endpoint/authentication decision remains pending.

## Latest direct human decisions — 2026-10-16

This entry overrides older current-policy statements only in the newly requested
Badge, radius, default weight, TOC and publication scopes. Earlier receipts below
are dated history, not acceptance of this scope. Normative rules: `/standards/`;
generated values: `/tokens/`; component behavior: `/components/badge/`.

- Badge uses native Ant Design 6.6.6 Badge/Tag, not a new GenUI registration.
  Its outer sm/md/lg profile is 20/26/32 px, distinct from compact Pill.
  The source target is 64 definitions: existing 61 plus three badge-size heights;
  legacy recipes receive missing defaults only. Outfit 14/400 is the Badge
  default; body defaults to 400, without changing the project minimum weight
  300 or the 12/14/16 px text policy. Never shrink text.
- The new radius editor offers 0px, 3px, 5px and 100%, factory default 5px.
  One edit updates general sm/md/lg for Input, slot and Button in both modes.
  Valid legacy numeric 0..32 recipes retain their exact values until edited
  and display their retained current value. Non-radius roles remain independent,
  including a custom dark body size of 20px. CSS 100% remains a percentage;
  native numeric AntD fallback is fully round; intentional circle Avatars stay circles.
- The source owner repairs the reported 192px, padding-zero right TOC using
  existing layout standards: token gutters at least 16px, readable rail at
  least 240px, natural label wrapping, sticky overflow and mobile Details
  without horizontal page overflow. This proposal does not edit layout CSS.
- Packet-reported local evidence: `/components` alias now returns 200 with
  canonical trailing slash and declared redirect source; root build 51 pages PASS.
  These are supplied receipts, not checks performed by this proposal. Publish
  authorization targets https://atonota.github.io/genui; retain local root
  http://127.0.0.1:4324/. Deployment source belongs to another owner.
  Local build, remote commit and actual Pages deployment are distinct evidence;
  committed main does not prove a preview or deployment. Publication checkpoint
  852f882 predates these currently UNCOMMITTED patches; no new live receipt exists.
- Current scope remains RED: two Badge/radius cases, source writers running.
  Historical 80 source-test files and 26 browser specs remain history. The
  authorized scope is browser specs 26 -> 27 with two Badge/radius cases,
  existing docs-spacing cases 1 -> 2 for TOC, and one local ignored Pages
  control; actual `/components` GET changed 404 -> 200 per supplied evidence.
  Do not add tests, review rounds, matrices, dependencies, scans or backlog.
- Preserve all eight component sections, frozen59, existing colors, Tab-only
  ringless focus, Cubic/reduced motion, MIT/public GenUI identity, Atlas APIs,
  storage keys and the karacaismail author/committer guard. No screenshot navy
  palette or fabricated AI functionality. Temporal/Hermes native documentation
  phase produces a read-only SOURCE proposal; master reviews and integrates it.
  Build metadata follows all source integration; do not infer unknown-token
  server errors before that build. No DONE/GREEN or new Pages publication claim.

## Bounded defect closure — latest human summary 2026-10-15

Close the recorded defects with one necessary regression per actual defect. Then
allow at most one final independent review of those correction diffs, not the
whole catalog. Fix new findings from that review only when they concern security
or data integrity (unauthorized actions, validation bypass, false success, data
loss or mixing). Record other findings without blocking this acceptance. Do not
open a third full-surface review or repeat already closed fixes/checks merely
because the same queued instruction arrives again. An existing final focused
review may be reused when its accepted production source hashes still match main.
Keep adapter regressions in the shared conformance row; bridge, query-neutral,
action and Hybrid checks retain their own files. Preserve the frozen59 membership
and the live-host decision boundary. End reports include package states, defect
records, before/after test-file counts and actual agent peak/mean for that turn.

## UX standards page and project overrides — human instruction 2026-10-15

Normative UX rules live on `/standards/` (`docs/src/pages/standards.astro`, Turkish
`docs/src/locales/tr/foundations-standards.json`) in nine sections: surfaces,
typography, size-radius, interaction-states, focus, layers, motion, layout and
accessibility. Approved values stay on `/tokens/` (Design tokens), generated from
`docs/src/theme-builder/definitions.json`; the standards page reads the values it
names from those definitions/models and links to the token tables instead of
copying the catalog. The legacy `/token-standards/` route is retired by the
navigation package: its catalog anchors resolve on `/tokens/`, while
`measurement-scales`, `surface-states`, `motion-focus`, `layers` and
`overlay-standard` resolve as aliases inside the matching `/standards/` sections
without duplicated rule text. `docs/migrations/p1-d-standards.json` maps the moved
prose. Current policy references say UX standards for rules and Design tokens for
values; historical log/evidence paths naming Token standards stay labelled history.

- Typography for this project's GenUI rules (latest direct human decision):
  minimum 12 CSS px, standard 14 px, reading 16 px, weight at least 300; Outfit
  remains. This replaces the 14 px minimum in current GenUI/Atlas rules only; the
  four global instruction files are not changed here.
- Radius: one shared general radius, default 5 px from `radius-md`, for every size
  family. An input and its slot use exactly the same radius when edited; this
  supersedes the former concentric subtraction for radius only. The nested
  content-box formula for slot size and inset stays.
- Sizes: standard controls and Avatar 48/56/64 px; compact selection, Pill,
  Slider, list and Cascader rows 32/40/48 px; descriptions grow instead of shrinking.
- Focus (Tab-only central mode, narrow forced-colors CanvasText fallback), overlay
  (Tooltip included, Toast/Notification excluded), central Cubic motion and shell
  role colors are unchanged. Preserve the eight component sections, the frozen 59
  packages and the pending live-host decision. The physical project is now GenUI
  at `/Users/w6x/Developer/genui`; new content does not hardcode the repository path.
- This entry records rules and ownership; it is not evidence of passing checks,
  rendering or human visual approval.

## Consolidated standards update — human instruction 2026-10-15

Status (current, 2026-10-15): the eight consolidated packages are acceptance
GREEN on their own receipts: P0-A 2, P0-B table 1, P1-A full Tab scan 1
(`p1-a-GREEN-picker.log`) plus pointer final 1 plus mode 1, P1-B 3, P1-C 1,
P2-A 1 and P2-B 1. P2-C (Hermes) passed ONE actual native Temporal dry run
(`p2-c-GREEN-tools-link-attempt.log`) and the same two security regressions
are GREEN; native usage reports provider `openai-codex`, model `gpt-6.1-sol`.
The earlier install block was a misdiagnosis, resolved by Hermes' own private
HOME tools link and validated runtime permissions; no vendor install/update,
authentication, configuration or pool change was made. Hermes code writes stay
read-only proposals. The root conductor's record remains atlas-temporal's
`evidence/consolidated-20261015/delivery.json`; `hermes-runtime-block.json`
there is historical evidence. That evidence root and its one-time command
records are local, untracked and not HTTP served. Human visual approval is
PENDING; the new review gallery is `http://127.0.0.1:4324/genui-update-review/`
and the existing consolidated 128 gallery is retained. Final local gates: build
50 pages, Astro check 307 files 0 errors 0 warnings 3 hints, lint 287 modules
70 styles 0 findings, format pass, browser TypeScript pass; root source
admission only, not CI. This entry does not overwrite earlier passed history; keep the
eight-section documentation order.

- New explicit user packages: information architecture 3 GREEN (enhanced first
  menu case, final `ia-GREEN-visible-nav` log, 3 -> 3 cases), spacing 1 GREEN
  (`spacing-GREEN-labels.log`), font 1 GREEN (`typography-minimum-GREEN.log`),
  radius 1 GREEN (`radius-GREEN-options-ready`) plus exactly one confirmed
  data-integrity regression `radius-GREEN-cross-theme` GREEN (1 -> 2 cases, same
  file), size one 23-surface table GREEN (`sizes-GREEN-checkable-hit`) and List
  1 GREEN. Other theme roles stay independent; only the general radius is global.
- Frozen backlog: the old 59 packages stay 58 integrated plus 1 pending live
  endpoint/authentication decision. No catalog rescan or new backlog.
- Tokens: 61 definitions (51 legacy + 6 overlay + 3 compact + 1 weight); stored
  51/57/60-token recipes stay valid. Defaults: every general radius 5 px and the
  exact same slot value; compact 32/40/48 px, regular 48/56/64 px; font minimum
  12, standard 14, reading (ideal) 16 px, weight >= 300 for this project only.
  Public `Atlas*` source APIs stay backward compatible; storage keys are unchanged.
- Tests: `docs/tests` keeps 80 source files; one font case was added to its
  existing file (2 -> 3 cases). Browser specs went 21 -> 26 files; the five new
  files hold 8 cases (7 for explicit new requests plus 1 for the actual
  cross-theme radius defect). No other browser case or file is added. No CI,
  Firefox, WebKit, device or visual approval is claimed.
- One read-only independent review: 2 critical functional/data-integrity
  findings FIXED through RED/GREEN. Open, non-blocking MINOR findings: radius
  editor prose says independent/unordered while the validator is ordered; legacy
  `/tokens/#colors`, `#typography`, `#size-radius`, `#motion-focus` and
  `#overlay` bookmarks; simple List labels nowrap/ellipsis while the catalog
  wraps. No further review rounds.
- Open, non-blocking: the existing review finding on the old slot marker and
  well shadow is recorded and pending a future human decision. Dark-shell
  sidebar search measures fill contrast 1.07 and boundary 4.67; report only,
  not recolored.
- Physical project: GenUI lives at `/Users/w6x/Developer/genui`, license MIT,
  public repository `atonota/genui` with `main` initialized. Publication is
  proven only by Git remote ref verification recorded in the local delivery
  receipt; no future push is claimed.
- Color roles supersede the earlier pale `#fffefa` / `#ded9cc` panel/field and
  dark `#242424` shell statements below: shell `#e6e2d7` / `#191302`, the entire
  main panel `#ffffff` / `#2c2c2c`, and fields `#ececec` / `#1b1b1b` as neutral
  greys darker than their panel. `docs/src/theme-builder/definitions.json` is the
  single color source; `--shell-bg`, `--panel-bg` and `--field-bg` are isolated
  role aliases, so overriding one never moves another. Functional boundaries keep
  3:1 and text 4.5:1 contrast; the quiet field well reference is preserved. The
  sidebar search on the dark shell is an open ambiguity: the root conductor
  measures and reports it; do not recolor it.
- One new DocsShell owns shell styles, navigation and layout. The form
  fieldset/legend grouping and Card rules are unchanged.
- Input slot chain: control height is the total border-box height 48/56/64 px;
  control border, slot inset and slot size derive from the AtlasButton size
  model through the nested content-box formula. Radius is the one shared general
  radius: input and slot use exactly the same value (superseding the former
  concentric radius subtraction). Standalone Buttons are unchanged.
- Overlay: Tooltip is included. Its scrim and 1 px blur apply only while it is
  actually visible after hover or keyboard focus, its existing delay is preserved
  and its popup and trigger stay sharp. Drawer and Modal blur the whole
  background, including the trigger; Toast and Notification stay excluded.
  Closing retains the clip, stacking and trigger cut-out until the fade ends; the
  controller is safe to import during SSR and uses a single body pseudo-element.
  Preserve the 57 definitions, 51-token legacy recipe compatibility, the six
  overlay tokens, the motion aliases and instant reduced motion. Tooltip gains one
  row in the existing `docs/browser/drawer-feedback.spec.ts` table, without a new
  scenario; new overlay components join that same table. Documentation is not proof.
- Focus rule FOCUS01 is ringless and type-specific through the central roles
  `--focus-bg`, `--focus-indicator-color` and `--focus-indicator-width` plus two
  field focus roles. Fields show one bottom marker only with keyboard modality
  and `:focus-visible`; list rows use a 3 px start edge that replaces the 2 px
  active marker; Buttons change fill, links underline and choices change fill or
  scale. Normal modes never draw a frame and never hide focus. Visible focus
  mode starts OFF; only plain Tab/Shift+Tab turns it ON, and arrows, Escape,
  Enter/Space and typing never turn it on. While ON, composite widgets move focus
  with APG arrow keys without leaving the mode, Enter/Space keep their native
  action, and programmatic or dialog focus return keeps the indicator visible.
  `pointerdown`/`touchstart` only hide the visual indicator; they never call
  `blur()`, move the caret or remove keyboard access. One central modality state
  (`html[data-input-modality]`) drives every indicator together with
  `:focus-visible`; there is no storage key or new setting. The forced-colors
  exception requires that central keyboard mode AND `:focus-visible` and draws
  only `outline: 2px solid CanvasText`. The human directly authorized this
  exception, and the four global instruction files were updated accordingly
  through breadcrumb-alignment-core-02.
- A local Stylelint plugin pinned to Stylelint 17.16 (`atlas/focus-no-surround`
  in `tools/stylelint-focus-plugin.mjs`) is implemented and run by `docs:lint`;
  docs lint passed. It checks authored stylesheets, not rendered runtime focus.
- A light/dark palette switch is an atomic commit, not component state motion:
  each mode's static background, border and shadow paint is present before the
  first SSR frame, the Provider adds no inline wrong-mode paint and hydration
  shows no appearing transition. Normal state changes keep positive symmetric
  Cubic motion; reduced motion is instant. The reasons are documented in the
  Design tokens motion section, the UX standards `motion` section and
  `docs/UX-STANDARDS.md`, without a new test.

## Frozen GenUI/Atlas backlog — human instruction 2026-10-15

The application backlog is frozen at the 59 named packages in atlas-temporal's
`evidence/genui-backlog-freeze-20261015.json`. Add a package only for an explicit
new human request or an observed concrete defect in integrated code, recording
the request or defect evidence. Do not rescan the catalog or open speculative gap
discovery. Administrative consolidation activities are not application packages.
All 49 registered native adapters from this frozen list share the single
`docs/tests/genui-native-conformance.test.mjs` table and scenario. The two existing
Date/Cascader extensions belong in their original rows' specific checks. The
record-field schema bridge is infrastructure rather than another registered native
component; its existing foundation check stays separate. Preserve bridge and
query-neutral tests. Relocate existing adapter-specific controls into their row's
one extra function; do not retain separate adapter test files or create scenarios.
Report the 59 packages' integrated/GREEN, running and decision-waiting counts,
and actual before/after test-file counts; source acceptance is not live-host/CI proof.

## Shared GenUI conformance — human instruction 2026-10-15

The original 42-package plan uses one table-driven registration conformance test
for adapter packages 3–36, covering all 34 names in one scenario. Check serializable
payloads, controlled value transitions (or explicit rejection for read-only controls),
invalid properties and unauthorized actions. Do not create another test per adapter.
Foundation packages 1–2 precede dependent integration; independent authors may work
in parallel with separate ownership. Packages 37–41 retain their existing targeted
checks. Package 42 requires the human's live endpoint/authentication choice.
The latest follow-up requires the original 34 separate adapter files to be
consolidated into this shared file. Preserve their adapter-specific behavior and
concrete regression assertions in one extra function per row; remove only common
assertions already guaranteed by that row's conformance check. Remove the old
separate files only after acceptance of the combined file. Foundation bridge and
query-neutral files stay unchanged. The later backlog-freeze instruction above
also consolidates the 15 native adapters in the additional 18-package set.
This is relocation of frozen coverage, not permission for new test scenarios.
The shared test's RED uses preserved pre-adapter source: report it as retrospective
verification, never as a new implementation-first chronology. Count actual CLI
process intervals separately from Temporal state and configured capacity.

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

## Complete Refactoring UI crosswalk — human request 2026-10-15

Read [docs/UX-STANDARDS.md](docs/UX-STANDARDS.md) for all 49 main reference topics
and the concluding practice section, including subrecommendations, Atlas policy
adaptations, source counterparts and missing components. This is the current UX
standard companion; a `source` or `partial` entry is not implementation/runtime
acceptance. Keep its explicit user-decision precedence and evidence labels.
The human clarified the verification policy on 2026-10-15: use TDD with the
minimum meaningful tests and continue authorized implementation. There is no
fixed test-file/scenario/time limit or two-correction stop rule. Older exhausted
budget/held-package statements below are historical snapshots, not current
authorization gates. Actual defects and failed checks still block acceptance.

Higher-level user instructions apply. This file records project implementation and
verification boundaries; it does not introduce UI decisions on behalf of the user.

- The user decision of 2026-10-13 requires smooth entry and exit for every normal
  visual state transition. The motion acceptance contract in `CONTRIBUTING.md`
  applies to human, Claude and Codex contributions. Docs and Storybook use
  `docs/src/data/motion.json` as the single source of curves and positive
  durations. New components must pass the source guard. Linear/steps/one-way
  easing, normal none/zero duration and inline motion overrides are prohibited.
  Values, ARIA and focus update immediately; only presentation transitions.
  Preserve reduced motion and immediate visible keyboard focus. The shared
  [motion policy](/Users/w6x/AGENT.md#ux-motion-policy) remains authoritative.
- English is canonical and the initial UI/SSR language across source, documentation,
  examples and Storybook. Turkish is secondary through shared phrase-key i18n and
  lazy custom dictionaries in docs/Storybook. The standalone atlas embeds its
  dictionary for offline use; AntD locale modules remain in the shared runtime.
  Explicit language preference may be restored safely; storage
  failure must not block interaction. Preserve machine identifiers, API properties,
  option values, story IDs and approved decisions. Translate visible and accessible
  copy, validation and status feedback. Language changes preserve forms, selection,
  open panels and focus without remounting. Search matches stable English identifiers
  and translated labels through shared normalization. See `docs/AGENTS.md`.
- Canonical legacy sources are `src/`, ordered by `build-order.json`, producing
  `dist/buton-atlasi.html`. Do not patch the Downloads HTML manually. Use source
  → verify → build → sync.
- Appearance-preserving maintenance must retain CSS order, pseudo layers, DOM order,
  fonts and icon bytes. Equivalent DOM/CSS does not replace pixel testing.
- Do not change `COMPONENT_DECISIONS` or decision fields without explicit user
  approval. Form controls remain experiments. Approved Button surfaces, palettes,
  tones, shadows and durations live in the canonical model; preserve the separation
  from experiments and do not duplicate axis lists.
- Magenta retains its exact middle color `#da037d`. Dark/light/pastel/edge values
  come from the installed `@ant-design/colors` 8.0.1 generator. Preserve default
  coral and the eight existing palettes; adding a color does not promote it to a decision.
- The latest user decision on 2026-10-13 keeps Default, Hover, Pressed,
  Disabled and a single Processing busy state. Saving/Syncing/Queued are removed
  from public choices; old saved recipes normalize internally to Processing. The source is
  `buttons.state_variants`; five other states remain in `BUTTON_EXPERIMENTS`.
  Light/dark Atlas and Storybook derive from the same source. Do not copy the list.
- The user also approved Content, Wide and Full width in `buttons.width_variants`.
  Narrow remains experimental. The three sm/md/lg size/padding decisions (48/56/64 px) and three
  widths share a renderer and the Storybook ApprovedDimensions gallery. Preserve
  existing story IDs.
- Preserve Flat 2.0/semi-flat, Outfit, natural 0 px letter spacing,
  0.9→1 opacity and the shared easeInOutCubic curve. The user explicitly permits
  measured inset depth on input fields. No gradients, moving bodies or surrounding
  focus rings. Keyboard focus requires one visible non-surrounding indicator.
- Begin the mobile flow at 320 CSS px and preserve input, selection, panels and
  focus. New dropdowns use branded controls and popups rather than visible native
  operating system menus.
- Do not recreate form controls when theme, appearance or locale changes. Follow
  adapter destroy/close contracts and preserve event/timer cleanup.
- The actual AntD target is 6.6.6. TypeScript belongs only to build/check stages;
  offline browser output must not carry TS/JSX or runtime transpilers. Do not mix
  a React migration into maintenance refactors. Actual rendering requires separate
  verification.
- `npm run verify` is the legacy gate: formatting, lint, syntax, CSS, strict AntD
  types and DOM tests. Preserve semantic claims without binding tests to whitespace
  in minified sources. Do not automatically update baselines or weaken checks.
- Pinned dependency declaration patches run only through
  `tools/patch-antd-types.mjs` with matching hashes/versions. Runtime JavaScript
  and global settings remain unchanged.
- Dropdown adapter changes require `npm run check:dropdown` for source, lockfile,
  licenses and preserved bundle equality. Do not blindly update a failed reference
  hash; planned vendor updates require separate review.
- If browser policy denies access, do not bypass it through another renderer, URL,
  server, browser or CDP. Mark screenshots, pixel diffs, physical devices, AntD
  runtime and CI `not_run` when they were not executed. Independent code review
  does not replace independent render QA.
- Preserve the Git authorship guard, running services and global configuration.
  Keep the public/open-source preference if a repository is created; do not select
  a license without user approval.

## Astro documentation application

- `docs/` is the real AntD runtime documentation application. It does not rewrite
  the existing single-file atlas. Follow `docs/AGENTS.md` and `docs/README.md`.
- Project override (2026-10-15, latest direct human GenUI decision): current
  GenUI rules use minimum 12, standard 14 and reading 16 CSS px with weight >= 300;
  see the UX standards entry above. Global baseline: the user's 2026-10-14 global
  typography decision sets a minimum of 14 CSS px for all readable text and removes
  the former 1rem minimum requirement.
  A larger existing type scale remains valid; do not flatten headings to the minimum.
  For documentation, retain native Ant Design CSS pixel measurements without
  automatic rem conversion. Body text is 14px/22px. Outfit
  is the default and recommended face for documentation. The final weight policy
  is default 400, minimum 300, including headings and labels. Code retains its monospace family. Do not override the
  browser's root font size or disable zoom. This documentation measurement profile does not change the
  existing approved/Storybook 16px/rem profile, 48/56/64px Buttons or handles of
  at least 32px. Historical reports remain unchanged; current global policy also
  uses the 14 CSS px minimum.
- `npm run docs:verify` and legacy `npm run verify` are separate gates.
  Documentation build success does not prove pixel equality with the old HTML.

## Browser smoke scope

- When the user asks for a surface/smoke check, follow the
  [shared limit](/Users/w6x/AGENT.md#kalıcı-test-kapsamı-sınırı-yüzeysel-test-isteğinde-derinleşme):
  page opening, representative basic interaction, obvious overflow and visible
  keyboard focus. Use at most one desktop and 320 CSS px view per browser, no more
  than 5 minutes per browser and 20 minutes total.
- Do not interpret that request as authorization for the full `docs:browser`
  matrix. Do not add variant combinations, pixel baselines or new tools/browsers.
  After one obvious small fix and targeted rerun, report remaining FAIL/`not_run`.
- Report actual Safari, Chrome, Firefox and Opera by name/version. Do not substitute
  engine results for another product. Do not repeat passed checks without a change.
  Critical security/accessibility and mandatory changed-code gates remain applicable.

## Storybook maintenance boundary

- The standalone `Form components → Data workspace examples` section is explicitly
  experimental. The attached v2 specifications and 96 pending proposal cards do
  not approve Atlas component variants. Do not add these examples to Storybook
  or `COMPONENT_DECISIONS` without a separate explicit user decision.
- Workspace mobile and desktop examples share local data and a persistent form
  draft. The mobile example starts with a sequential group/list/details journey;
  desktop exposes separate panes and a contained table. These are manual preview
  profiles, not user-agent/device detection. Do not duplicate hidden form controls.
- The standalone offline file embeds the small shared workspace script/styles;
  lazy DOM construction avoids mounting inactive controls. This is a single-file
  packaging tradeoff, not proof of conditional network delivery. No backend save,
  TanStack engine, permission system or production ERP is implemented by examples.
- New workspace styles are scoped, retain symmetric motion and visible single-edge
  keyboard focus, and are checked in `tests/workspace-examples.test.mjs` through
  the existing `npm run verify` gate. Historical fixture bytes stay unchanged.

- Storybook 10.2.19 / React-Vite consumes the nine existing
  `docs/src/react/*Demo.tsx` exports from `storybook/*.stories.tsx`.
  Do not add a second demo/provider/token source or invent user decisions.
  Preserve application render sources.
- Each component has one interactive CSF3 story. Button also derives its
  approved states and sizes/widths in separate decision stories. Preserve English
  title/export identities. Do not duplicate fixed-ID demos on one page, generate
  inline Docs copies or add a second provider decorator.
- `npm run storybook` uses loopback port 6007. `storybook:check` checks formatting
  and strict TypeScript; `storybook:build` creates a static build;
  `storybook:verify` combines checks, build and index contracts. These are not
  browser/pixel evidence. Browser smoke follows the same 5-minute-per-browser and
  20-minute-total limits; do not rerun passed checks without changes.

## Current component refresh (2026-10-13)

- All buttons use sm/md/lg (48/56/64 px); selection handles stay at least 32 px.
  AtlasSizeProfile and the canonical size model own the three choices. Nested
  providers inherit size without duplicating controls or resetting drafts.
- Normal Button surfaces are solid, outline, pastel-filled, text and link, plus
  Disabled state; no dashed/dotted/naked/dark-ink/neutral families are public.
  AtlasButtonGroup owns double/triple native single-selection wrappers.
- Documentation primary is exactly #0099ff. Color families and the Tokens page
  inherit the 24 active presets through button-palette.ts, with HWB10/10 adjustment.
- Documentation tactile feedback is 116.667 ms (previous 166.667 ms ×0.7). Shared
  transient click waves use 400 ms Cubic and never replace the keyboard marker.
  Optional wave code loads on real interaction intent; first-event presentation
  replay never redispatches a business action. Respect reduced motion and keep
  the existing 8 KiB initial vanilla-controller budget. Native wave remains disabled
  to avoid duplicate feedback. No new Storybook stories or source/config edits.

## Delivery and minimal TDD — human clarification 2026-10-15

Before starting, state the delivered behavior, owned files and necessary verification in at most four lines. Do not ask again for authorized routine work. The goal is delivery; testing, review and orchestration must not become growing independent projects.

Use the minimum meaningful tests across all agents. For meaningful behavior, observe a necessary real failing check, implement, then pass the same check; never manufacture RED. Prefer existing tests and focused regressions. There is no fixed count of test files, scenarios, minutes or correction rounds, and implementation must not stop because an earlier counter was exhausted.

After relevant checks pass, deliver. Do not repeat successful checks or expand fixtures, matrices or review without a new change or concrete defect. Keep testing proportional to the requested behavior; avoid unnecessary depth. Continue authorized fixes without asking to expand a test budget. Report missing evidence honestly.

Preserve existing required CI/release gates, assertions and security protections. Do not bypass a failed check or mark unverified delivery DONE. Never create tests, reports, reviews, infrastructure or repeated tasks merely to fill agent counts. Report concrete technical blockers; do not invent a process or quality gate. Live supervision only; no scheduled task or automatic future wakeup.

## Definitive input standard — human decision 2026-10-14

- The supplied `/Users/w6x/Downloads/antdesign-input-light-dark.html` defines the default input surface direction. Rebuild the shared Atlas input ownership/markup and adapters; do not describe a CSS patch as a completed rewrite. AntD 6.6.6 native editing/ref/form semantics remain the foundation.
- Superseded panel/field/canvas values: the consolidated role decision above sets panel `#ffffff` / `#2c2c2c`, neutral grey fields `#ececec` / `#1b1b1b` darker than their panel, and shell `#e6e2d7` / `#191302`; the former `#fffefa` / `#ded9cc` / `#242424` values are not defaults for the new roles. The former blue-grey values `#eff1f4`, `#232b35` and `#2d3540` are invalid and must not appear as defaults, in `theme-builder/definitions.json`, or as hardcoded component/CSS colors. `definitions.json` is the single central source: `inputSurfaces`, `theme.ts` and docs accessibility read field, border (`#747166` / `#858585`), text (`#242622` / `#f2f2f2`), muted (`#575a53` / `#b8b8b8`) and disabled roles from it. Field interiors must be darker than their surrounding painted surface in both modes. Keep the upper inner dark blur and lower inner highlight geometry and opacity from the supplied standard with neutral shadow RGB; it supersedes the earlier approximate 65-degree, zero-blur calibration.
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

## Selection and feedback extensions — 2026-10-15

- Radio, Checkbox and Switch examples share `AtlasSelectionVariants.tsx` and `atlas-selection-variants.css`: horizontal, vertical, boxes, icon cards and image cards. Preserve native AntD semantics, separate single/multiple/toggle state, disabled options, descriptive fieldsets, local lazy SVG assets, semantic sizes/radii/colors and one bottom-only keyboard marker. Do not duplicate three separate selection engines.
- Drawer workspace-navigation and order-details examples have different content/state. Feedback wrappers in `AtlasFeedback.tsx` retain native AntD lifecycle and contexts; local outcomes are demonstrations, not backend mutations. `catalog-extensions.ts` owns the six new public entries; these entries are not GenUI capability registration.
- `AtlasDateTime.tsx` uses native AntD/Dayjs directly. The old serialization model is held and must not be silently imported or described as accepted. Existing two-cycle limits remain binding; the missing catalog time-only range example is open.
- Main source integration is not final acceptance. Current known failures: Theme Builder TS2554; snippets generator relative-import failure after catalog extraction; two legacy Drawer checks; feedback motion rule; Popconfirm defaultOpen; remaining conditional ghost fills; held input token geometry/local-alias defects. Preserve assertions and required gates. Current evidence and remaining verification limits are in `/Users/w6x/Developer/atlas-temporal/plans/ATLAS-ACTIVE-REQUESTS-2026-10-14.md`.

## Approved documentation backgrounds and dropdown backdrop — 2026-10-15

The human explicitly restored the former documentation palette after input reference colors leaked into the whole page. Superseded by the consolidated role decision above: the documentation shell is `#e6e2d7` / `#191302`, the main panel `#ffffff` / `#2c2c2c` and fields `#ececec` / `#1b1b1b`, all read from `theme-builder/definitions.json`. Do not derive page/panel backgrounds from `inputSurfaces.*.surface`; those values describe an input-reference surface. Explicit user-applied custom recipes remain supported. This newer decision supersedes the earlier statement treating the blue-grey input-reference canvas as the global docs canvas.

Open native Select and Dropdown share a non-modal background-only blur of 1 CSS px, owned by `--dropdown-backdrop-blur`. Keep trigger at the central trigger layer, popup above the backdrop, foreground controls sharp, and backdrop pointer-events:none so Escape/outside-click/native focus work. Do not apply filter:blur to body or intercept pointer events. Positive symmetric central Cubic presentation motion remains.

The existing `docs/browser/contracts.spec.ts` now has background navigation/reload and Dropdown blur/dismissal regressions; the existing Select assertion expects 1px. Run these focused checks with the current browser runner. The full Select case has a separate preexisting bottom-border failure; preserve it and never report its entire case PASS from a manual blur-only observation. Full CI/browser acceptance remains separate.

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

## GenUI application delivery — 2026-10-15

- Preserve the existing GenUI model and the original 12 component names. The accepted bounded registry now has 61 names: 12 existing and 49 native Atlas adapters. Schema modules stay below policy/React; use `docs/src/genui/native-contract.ts` for exact bounded JSON and identifiers, not a policy/registry initialization cycle.
- Native drafts belong to the exact component type, binding path, host source, surface generation and rendered revision. Validate transitions from the published native value; keep the original host fingerprint for reconciliation. Incomplete or unresolved rejected streams cannot enable edits/actions. A collection callback chain publishes one full validated value with its original revision fence.
- Local drafts remain editable when incomplete. Create/review actions also use the code-owned native action-readiness boundary and existing field-kit domain validation. Read-only fields are enforced at native transition boundaries, not only by omitted UI setters.
- Write intents always require an exact fresh human-approved review; a host predicate cannot waive it. Review capture and authorization share `actionBindingJSON`. Password changes expose only a code-owned sensitive/changed indicator; protected binding data must never be rendered or logged as review text. Native confirmation receives actual outer-action availability; false/throw keeps it open and cancellation remains available.
- Outcome cache ownership includes fresh authorization and exact scope/payload/revision/context; a cached result cannot authorize a different operation. Host authorization, durable idempotency and receipt authenticity remain trusted host responsibilities. Local callback acceptance is not a server commit.
- Feature adapters own their existing CSS and load through literal lazy imports. No unchecked payload spreading, raw HTML/CSS/functions, model-selected endpoints, enclosing focus rings, or visual-identity changes are introduced by a native bridge.
- Frappe query integration is optional at `docs/src/genui/adapters/frappe.ts`; the core does not require a Frappe host. The current Lab is recorded/local. Live host URL/authentication is a pending human choice; do not fabricate a gateway, receipt or model completion.
- Keep the user's frozen minimal TDD scope: one necessary real RED → implementation → same GREEN per behavior; only one regression for a concrete observed defect. No proposal/browser test waves, broader matrices, reruns of historical passing tests, schedules or headcount fillers. Build/type/lint gates and source/runtime/CI evidence boundaries remain distinct.

Neutral warm field palette (human decision applied 2026-10-15): `theme-builder/definitions.json` is the single central source for field `#ececec` / `#1b1b1b` (the earlier light `#ded9cc` is superseded by the consolidated role decision), border `#747166` / `#858585`, text `#242622` / `#f2f2f2` and muted `#575a53` / `#b8b8b8`; disabled roles keep their own `definitions.json` values, with disabled text equal to muted, so every text role keeps at least 4.5:1 and the field border at least 3:1 on field, panel and canvas. Panel and field surfaces are neutral greys with equal RGB channels in both modes; the warm shell canvas (`#e6e2d7` / `#191302`, R >= G >= B, no blue overshoot) is a separate role. Shell `#e6e2d7` / `#191302` and panels `#ffffff` / `#2c2c2c` follow the consolidated role decision; brand, status, motion, font, radius, shadow geometry and explicit custom recipes are unchanged. TDD exception for this regression: exactly one new node:test file with one scenario, `docs/tests/neutral-field-surfaces.test.mjs`, bundles the real theme, input-surface, accessibility, Theme Builder model and color-system modules with esbuild, fails against the former blue-grey sources and passes after the central change; no further test waves or fixtures are added for it.
Decorative inset paint edge (human correction applied 2026-10-15; supersedes the earlier forced bright four-side field perimeter, which was a paint-role confusion and is not an approved look): the field well rests on the decorative `insetBorder` role from `inputSurfaces` (light neutral ink `rgba(26, 26, 26, 0.035)`, dark neutral white `rgba(255, 255, 255, 0.02)`), exposed as `--atlas-input-inset-border` on the provider and as the `--field-inset-border`, `--field-inner-shadow` and `--field-inner-hover` root aliases from `theme.ts` for owners outside AtlasProvider such as the sidebar search. This edge is decorative and carries no 3:1 contrast claim; the functional `--field-border` token (`#747166` / `#858585`) and its 3:1 contract are unchanged for checkbox, radio and other functional boundaries. At rest every physical border width of a field equals `--field-border-width`: no reserved thick bottom stripe and no surrounding contrast frame. Focus paints exactly one immediate bottom-only marker (`--focus-marker` tall) as a background layer inside the well over the retained reference inner shadow, so geometry never shifts; no ring, glow or sidebar label underline doubles it. Text keeps at least 4.5:1 and focus/status cues at least 3:1; `definitions.json`, surfaces, sizes, radius and layout are unchanged.
Overlay backdrop standard (permanent human decision applied 2026-10-15; standard and central implementation integrated; runtime acceptance and human visual approval tracked separately): every user-opened upper layer, meaning Dropdown, Select, AutoComplete, Cascader, DatePicker, TimePicker, range pickers, rich menus, Popconfirm, Popover, Drawer, Modal and the Tweaker, dims the page behind it with a neutral scrim and a fixed 1 px background blur. A non-modal panel and its bound trigger stay sharp above the scrim; Drawer and Modal blur the whole background including the trigger. Toast and Notification are excluded. Tooltip is included by the latest human decision: the scrim and blur apply only while a Tooltip is actually visible after hover or keyboard focus, its existing delay is preserved, and the Tooltip popup and its trigger stay sharp. Closing keeps the clip, stacking and trigger cut-out until the fade ends; the controller stays safe to import during SSR and paints through a single body pseudo-element. Native outside click, Escape, focus return, the 14 CSS px minimum and readability are preserved. `docs/src/theme-builder/definitions.json` is the single role source for the six `overlay` group tokens `overlay-scrim-color`, `overlay-scrim-opacity`, `overlay-backdrop-blur`, `overlay-scrim-z`, `overlay-trigger-z` and `overlay-popup-z` (black scrim in both themes, opacity 0.12 light / 0.24 dark, fixed 1px blur, base layers 1040 / 1041 / 1050), raising the catalog from 51 to 57 definitions; the helper, root and resolver in `docs/src/theme-builder/model.ts` and `docs/src/theme.ts` generate `--overlay-scrim` RGBA, `--overlay-backdrop-blur` and the z roles, and the documentation catalog is generated from `tokenDefinitions`, never hardcoded. Motion aliases `--overlay-open-duration: var(--press-duration)`, `--overlay-close-duration: var(--release-duration)` and `--overlay-easing: var(--motion-easing)` point at the central symmetric Cubic contract and introduce no new timing; reduced motion is instant. `--dropdown-scrim`, `--dropdown-backdrop-blur`, `--dropdown-backdrop-z` and `--dropdown-trigger-z` remain compatibility aliases only with no duplicated values. Existing modal caller z values are preserved and `layerOrder` metadata is not a universal claim. Theme Builder compatibility: a complete valid 51-token custom recipe stays valid, only the six new roles are filled from factory defaults, strict unknown/partial rejection, the storage key and version 1 are unchanged. New layered components MUST consume the semantic standard and MUST join the existing shared table in `docs/browser/drawer-feedback.spec.ts` with one row; no separate spec file or new wave. The rule is documented in `docs/src/pages/standards.astro` (`layers`, legacy anchor `overlay-standard`), its values in `docs/src/pages/tokens.astro`, and in `docs/UX-STANDARDS.md` (the former `token-standards.astro` location is history); this entry records the decision and is not evidence that runtime, browser scenarios or screenshots passed. The central helper `data/overlay-tokens.ts` and the controller `overlay-backdrop.ts` are the single runtime owners of the overlay roles; the one existing shared table in `docs/browser/drawer-feedback.spec.ts` is the only browser oracle and gains no separate spec file or case wave. The initial real RED is `overlay-backdrop-red-full.log`; the outcome record is `/Users/w6x/Developer/atlas-temporal/evidence/overlay-backdrop-delivery-20261015.json`, written by the root conductor after the checks finish. Current runtime acceptance is recorded in the linked outcome receipt; this source documentation is not evidence of passing browser or CI checks or of human visual approval.
