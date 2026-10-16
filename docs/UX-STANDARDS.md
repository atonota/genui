# Atlas UX standards and complete reference crosswalk

## Component preview workbench and detail layout — 16 October 2026

Newest human task; it supersedes the dated Badge/radius scope counts below as
current scope. This read-only source proposal is not evidence of executed checks.

- Every logical example cluster on all 40 component pages has one shared
  [ExamplePreview](src/react/ExamplePreview.tsx) workbench with a literal unique
  id: Device preview (iPhone/iPad/MacBook, default MacBook, container widths
  390/820/1280 fitted without scaling or smaller text), Preview theme (Light/Dark,
  the shared shell theme) and Example view (Preview/Code). The preview stays
  mounted; Code is fetched lazily as an authored source excerpt. It is a container
  illustration, not physical device or browser emulation.
- Component detail pages place usage, examples, code, Astro, accessibility and
  notes in a showcase column and API plus resources in a reference column, with
  the contents rail outside the article. The column split starts at 100rem
  (1600px) viewports; narrower layouts stack and 320px keeps the Contents
  disclosure. Section IDs, the eight sections and their sources are unchanged;
  only their order follows the new reading intent.
- Tests (authorized scope, not results): browser specs 27 -> 28 with two cases;
  source test files unchanged. No DONE/GREEN claim.

Türkçe: Bu bölüm en yeni insan görevidir. 40 bileşen sayfasındaki her mantıksal
örnek kümesi, benzersiz sabit kimlikli tek bir ExamplePreview çalışma alanı alır:
cihaz (iPhone/iPad/MacBook, varsayılan MacBook), önizleme teması (Açık/Koyu) ve
örnek görünümü (Önizleme/Kod). Önizleme bağlı kalır; kod yalnız seçildiğinde
yüklenir. Ayrıntı sayfası geniş ekranda vitrin, API/kaynak referansı ve dış
içindekiler rayı olarak ayrılır; dar ekranda doğal sırayla yığılır. Bölüm
kimlikleri korunur; çalıştırılmış kontrol veya DONE/GREEN iddiası yoktur.

## Current authoritative project decision — 16 October 2026

This is the current project decision. It supersedes older current statements,
including the 61- and 64-definition counts; dated sections below remain
history. Rules live on [UX standards](/standards/), values on
[Design tokens](/tokens/), behavior on each component page. This read-only
source proposal is not evidence of executed checks.

- Tokens: 65 definitions (prior 61 + 3 Badge size heights + `listy-surface`),
  all editable from the Tweaker on all 40 component pages. Saved
  51/57/60/61/64 recipes gain only missing defaults; HEX uppercase
  canonicalization is unchanged. Native Ant Design 6.6.6; no new package.
- Sizes: Listy 16 patterns on shared `AtlasListyItem`; Listy and Cascader rows
  compact 32/40/48 px (superseding the earlier Cascader regular 48 px). Standard
  Avatar/Button/Input 48/56/64 px; Select items regular; rich descriptions
  grow. Badge outer 20/26/32 px including border, default 14 px / 400.
- Radius: 0px, 3px, 5px, 100%, factory 5px; Input, slot and Button share the
  general value in both modes. Legacy numeric 0..32 values stay exact until a
  choice. Circle Avatars and explicit legacy gallery corners stay. Pill, Card
  and Checkbox inherit the general role; Button shows `Use general radius`.
- Tweaker: native per-page props, no fake placeholder; Size/preview states kept
  in memory while closed; shared recipe persists 30 days under the existing key
  until cleared or expired. Not every business state is persisted.
- Typography: project minimum 12 CSS px, default 14, ideal reading 16; weight
  default 400, minimum 300; Outfit. Global instruction files are unchanged.
- Surfaces: canonical `inputSurfaces.innerShadow` reused, duplicate blue shadow
  removed; neutral fields, white/`#2c2c2c` panels, warm shell unchanged; one
  functional outer boundary; Listy host padding/divider cleared; section gap
  > = 16 px; TOC 256 px rail with 16 px padding. Reference HTML and 31 images
  > stay local; no navy colors.
- Tests (frozen scope, not results): source 80 -> 80 with
  `neutral-field-surfaces` 1 -> 2; browser files 26 -> 27 with exactly 5 added
  cases (Badge/radius 2, docs-spacing +1, Listy +1, Tweaker +1); one old Tweaker
  case adapted and rerun. One final independent diff review pending.
- Publication: MIT GenUI `atonota/genui`; new work UNCOMMITTED; actual Pages
  deployment NOT YET LIVE; local root and Pages stay separate; Pages-only
  redaction with credential guard. No DONE/GREEN or publication claim.

Türkçe: Bu bölüm güncel proje kararıdır ve eski 61/64 tanım sayılarının yerine
geçer; aşağıdaki tarihli bölümler geçmiştir. 65 token (61 + 3 Badge yüksekliği +
`listy-surface`) 40 sayfanın tamamında Tweaker ile düzenlenir; kayıtlı tarifler
yalnız eksik varsayılanları alır. Listy 16 desen ve Cascader ile kompakt
32/40/48 px; standart kontroller 48/56/64 px; Badge 20/26/32 px, 14 px / 400.
Yarıçap 0px/3px/5px/100%, varsayılan 5px; eski 0..32 değerleri seçime kadar
korunur. Tipografi en az 12, varsayılan 14, okuma 16 px; kalınlık 400/en az 300;
Outfit. Test kapsamı sonuç değil, dondurulmuş yetkidir. Yeni iş UNCOMMITTED;
gerçek Pages dağıtımı henüz canlı değildir; DONE/GREEN iddiası yoktur.

## Latest scope boundary — 2026-10-16

The completion statements below concern the dated PDF delivery only. They do
not accept the new Badge/radius/TOC/publication scope, whose two Badge/radius
cases remain RED while source writers work. This is a read-only source proposal,
not integrated source or evidence of executed checks.

Current normative rules are on [UX standards](/standards/), values are generated
on [Design tokens](/tokens/), and native behavior belongs to
[Badge](/components/badge/). The 16 October decisions add the Badge exception,
approved radius choices with lossless legacy retention, default Badge/body
weight 400 and readable TOC insets. Existing minimum weight 300, project
12/14/16 px typography and independent non-radius custom roles remain intact.
Older prose about a numeric radius editor or independent size radii is history,
not the current editor contract. No model/schema changes belong to this proposal.

Historical 80 source-test files and 26 browser specs stay historical. Authorized
new accounting is 26 -> 27 browser specs with two Badge/radius cases and
existing docs-spacing 1 -> 2 for the TOC case; one local ignored Pages control
is separate. No additional test wave or review is authorized here.

The packet reports a 51-page local root build PASS and `/components` GET
404 -> 200 with canonical slash and declared redirect source. These supplied
local receipts are not checks run here and do not prove deployment. Explicit
publication authorization targets https://atonota.github.io/genui, retaining
http://127.0.0.1:4324/ as local root. Local build, remote commit and actual
Pages deploy are distinct evidence; committed main proves neither preview nor
deployment. Checkpoint 852f882 predates the new UNCOMMITTED patches. No new
Pages receipt or DONE/GREEN claim exists for this scope.

Türkçe: Aşağıdaki tamamlanma ifadeleri yalnız tarihli PDF teslimine aittir.
Yeni Badge/yarıçap/TOC/yayın kapsamını kabul etmez; kaynak yazarları çalışırken
iki Badge/yarıçap vakası RED durumundadır. Bu, çalıştırılmış kontrol veya
bütünleştirilmiş kaynak kanıtı değil, salt okunur kaynak önerisidir. Güncel
kurallar `/standards/`, üretilen değerler `/tokens/`, yerel Badge davranışı
`/components/badge/` sayfasındadır. Yeni kararlar Badge istisnası, eski değerleri
kayıpsız koruyan yarıçap seçenekleri, Badge/gövde için varsayılan 400 kalınlık
ve okunabilir TOC iç boşluklarıdır. En az 300 kalınlık, proje 12/14/16 px
tipografisi ve bağımsız diğer özel roller korunur. Eski sayısal yarıçap
düzenleyicisi veya bağımsız boyut yarıçapları anlatımı güncel sözleşme değil,
geçmiştir. Model/şema değişikliği bu önerinin kapsamında değildir.

Türkçe kanıt sınırı: Tarihsel 80 kaynak test dosyası ve 26 tarayıcı dosyası
geçmiş olarak kalır. İzinli yeni kapsam iki Badge/yarıçap vakasıyla tarayıcı
dosyaları 26 -> 27 ve TOC vakasıyla mevcut docs-spacing 1 -> 2 değişimidir;
yerel yok sayılan tek Pages kontrolü ayrıdır. Ek test dalgası veya inceleme
yoktur. Paket, 51 sayfalık yerel kök derlemesi PASS ve kanonik eğik çizgi ile
beyan edilmiş yönlendirme kaynağı olan `/components` GET 404 -> 200 sonucunu
bildirir; burada kontrol çalıştırılmadı. Yayın izni
https://atonota.github.io/genui içindir; http://127.0.0.1:4324/ yerel kök
olarak korunur. Yerel derleme, uzak commit ve gerçek Pages dağıtımı ayrı
kanıtlardır; main commit'i önizlemeyi veya dağıtımı kanıtlamaz. 852f882 kontrol
noktası yeni UNCOMMITTED yamalardan öncedir. Yeni Pages makbuzu veya bu kapsam
için DONE/GREEN iddiası yoktur.

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

MASTER freezes each open package at its planned test scope. The only exceptions
are one necessary RED-to-same-GREEN control for newly requested behavior or an
observed concrete defect, with a written reason. No extra test wave, review of
test proposals, browser matrix, fixture expansion or unchanged successful rerun
is authorized. The two additional defect cases in this delivery are recorded below.

Reference: the privately supplied 252-page _Refactoring UI_. Updated 15 October
2026, Europe/Istanbul. This document paraphrases the reference; it does not
redistribute its text, illustrations or assets.

**Coverage is complete; the UX completion delivery is implemented; universal
runtime certification is not claimed.** The crosswalk covers all 49 main
recommendation topics and the concluding practice section, including their
subrecommendations. The 15 October 2026 UX completion delivery implemented the
six concrete application steps listed below, and its follow-up adoption closed
the last five partial rows (UX-12, UX-13, UX-36, UX-42 and UX-43). All 23 rows
that were `gap` or `partial` (3 gap, 20 partial) are now `implemented` for their
identified consumers; none remain `partial`. A documented
rule, existing source, successful sample or catalog entry is still not proof of
adoption throughout Atlas.

Row count: the human request referred to 25 gap/partial rows; this file has 23
(UX-22, UX-41 and UX-44 gap; 20 partial). This is a documented
discrepancy, not a hold or stop; no row ID has been invented to reach 25.

Türkçe durum: PDF'nin 49 ana önerisi ve son öğrenme bölümü aşağıda tek tek
eşleştirildi. 15 Ekim 2026 UX tamamlama teslimi altı uygulama adımını kodda
gerçekleştirdi; ardından gelen benimseme kalan beş `partial` satırı da kapattı:
23 gap/partial satırın tamamı belirlenen tüketiciler için `implemented`,
`partial` satır kalmadı. Evrensel tarayıcı, kontrast, CI veya backend doğrulaması
iddia edilmez. Güncel kullanıcı kararı: TDD ile gerekli en az test;
sabit test sayısı/süresi veya düzeltme turu sınırı işi durduramaz.

## Current acceptance — DONE for the defined PDF delivery

The two lifecycle defects found by review03 are corrected. The existing media
scenario now proves keyboard focus moves to the named stable figure with the
immediate non-enclosing bottom marker after a successful same-source retry.
A single new regression in the existing patterns file proves Screenshot
A → B → A starts a new attempt after A failed. Their genuine RED and same
GREEN logs are recorded in the outcome. UX-41, UX-42 and UX-43 are implemented;
independent review04 retained both code corrections and found only documentation
inconsistencies. Those exact statements and the exception count were corrected
and read back; no further behavior checks were added or repeated.

Current scoped TDD count: 4 → 6 existing test files, 11 → 13 planned scenarios;
12 unique PDF controls selected. Only two scenarios were added, each for a
confirmed defect (CSS role bridge and Screenshot source lifecycle). Five older
theme cases and 33 older patterns cases remain outside this scope and were not
rerun. No persistent test file was added. The separate existing Hybrid package
still has 3 scenarios and only its previously failing control was rerun.

## Authority and evidence

- Human decisions and the shared coding, accessibility, motion and mobile policies
  take precedence over the book's examples. Reference content is design input,
  not operational instructions or permission to install, publish, buy assets or
  access a service.
- MUST identifies an existing human/platform/accessibility requirement. SHOULD
  identifies the default Atlas design practice. MAY identifies an applicable
  alternative, not a requirement to decorate every screen.
- `source`: an identified implementation or token exists; universal adoption and
  runtime acceptance are unproven.
- `partial`: relevant implementation exists but a named application, contract,
  integration or evidence gap remains.
- `implemented`: the shared pattern was delivered and adopted by the identified
  consumers named in the row, with the delivery's scoped checks recorded. It is
  separate from universal runtime certification: it does not certify every
  route, state, browser, device, contrast case or CI run.
- `gap`: an identified shared standard/pattern has no complete implementation in
  the reviewed source.
- `adapted`: the recommendation is accounted for through an explicit Atlas
  decision; its conflicting example must not silently replace that decision.
- `process`: a design/content practice, not a missing UI primitive.

Source review here covers the paths cited in each row and the existing delivery
records. It is not a fresh exhaustive browser review of every route or state.
The full PDF text was read; additional visual references inspected for this
crosswalk were pages 36, 51, 81, 89, 119, 130, 164, 178, 182, 209, 217, 225,
243, 245, 250 and 251, alongside the earlier pages 215, 235 and 246.

## Preserved Atlas decisions

1. MUST retain Outfit, native user root size/zoom and the current weight
   profile: default 400, minimum 300. Text sizes follow the latest direct human
   GenUI decision for this project: minimum 12 CSS px, standard 14 px, reading
   16 px (replacing the former 14 px minimum in current GenUI rules; global
   instruction files are unchanged). The book's heavier examples and smaller
   sample sizes do not change these decisions.
2. MUST retain natural zero letter spacing. Improve all-caps readability through
   wording/case and hierarchy; do not introduce new tracking overrides.
3. MUST use the consolidated 2026-10-15 roles from `definitions.json`: shell
   `#e6e2d7` / `#191302`, main panel `#ffffff` / `#2c2c2c` and neutral grey
   fields `#ececec` / `#1b1b1b`. Input wells remain darker than their
   containing surface in both modes. Input-reference surfaces are not page
   backgrounds.
4. MUST use the existing semantic color, typography, spacing, radius, surface,
   focus and motion owners. The HWB composition and installed Ant Design palette
   generator remain the color pipeline; the book's HSL preference does not
   authorize a replacement algorithm or a second shade catalog.
5. MUST preserve separate sm/md/lg control profiles, visible geometry, hit areas,
   padding and gaps. Minimum readable text and interaction targets do not shrink
   with a whole component. Start the actual journey at 320 CSS px.
6. MUST preserve the existing flat/3D distinction, stationary control body and
   restrained depth. No new gradients, texture, long decorative shadows or moving
   pressed bodies follow from this reference. Input inset shadows retain their
   separately approved lighting treatment.
7. MUST preserve one immediate non-enclosing focus cue, native semantics, real
   labels, availability and caller-owned state. Normal presentation uses central
   positive symmetric Cubic timing; reduced motion remains a narrow exception.
   A selected border, error boundary or wave is not a keyboard focus substitute.
   The only frame exception is `outline: 2px solid CanvasText` in forced-colors
   mode, and only while the central keyboard mode is on and the element matches
   `:focus-visible` (see the consolidated standards update below).
8. MUST retain the shared 1px background-only Select/Dropdown blur, sharp triggers
   and foreground portals, native outside-click and Escape behavior.
9. SHOULD separate content using space, alignment and surface hierarchy. Form
   groups use meaningful section/fieldset/legend; an individual field does not
   need a Card. Independent records/artifacts may use the existing Card surface.
10. MUST use minimal meaningful TDD: necessary real failing check, implementation,
    then the same check passing. The human clarification on 15 October 2026
    supersedes fixed test-file/scenario/time/correction-round limits and any
    exhausted-counter stop rule. Continue authorized implementation; avoid
    needless test depth and repetitions. Failed mandatory gates remain binding.

## Every recommendation mapped

Page ranges refer to the supplied PDF's numbered pages. Each row includes the
topic's concrete subrecommendations, its Atlas standard and current counterpart.

### Task-first design and constrained decisions

| ID / PDF pages | Atlas standard and covered subrecommendations                                                                                                                                                                | Current counterpart and remaining work                                                                                                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UX-01 / 8-11   | SHOULD begin with a complete user task: needed data, controls and outcome before navigation/shell decoration.                                                                                                | `process`. [ConnectedWorkspace](src/react/workspace/kit/ConnectedWorkspace.tsx) composes entry, explicit local commit and inspection. Its local journey is not a production service.                                                                                                                                           |
| UX-02 / 12-15  | SHOULD establish structure and hierarchy with a low-detail/neutral exploration before choosing decorative details; discard exploratory mockups once the real behavior exists.                                | `process`. [CardDemo](src/react/CardDemo.tsx) and existing example pages separate purpose from presentation. Exploration must not overwrite approved decisions or be called an implemented feature.                                                                                                                            |
| UX-03 / 16-19  | SHOULD build a useful small slice, expose real empty/error/dense cases and avoid showing unimplemented attachments or actions as available. Short iterations must not create duplicate or unnecessary tests. | `process`. [StateSurface](src/react/workspace/kit/StateSurface.tsx), [EvidencePanels](src/react/workspace/kit/EvidencePanels.tsx) and disabled demo actions expose limits. Full PDF adoption and several earlier packages remain incomplete.                                                                                   |
| UX-04 / 20-27  | SHOULD keep a coherent personality across font, color, radius and language; use references without copying a competing identity.                                                                             | `adapted`. [Typography](src/data/typography.ts), [brand roles](src/data/docs-brand.ts), [theme](src/theme.ts) and [i18n](src/i18n.ts) own Atlas identity. Outfit, existing radii and English/Turkish copy prevail over alternative serif/system-font examples.                                                                 |
| UX-05 / 28-34  | MUST choose finite shared scales for type, weight, line height, color, spacing, dimensions, shadows, radius, border and opacity; compare neighboring options rather than invent near-duplicates.             | `source`. [Theme definitions](src/theme-builder/definitions.json), [state metadata](src/theme-builder/states.ts), [size profiles](src/react/AtlasSizeProfile.tsx) and [Design tokens values](src/pages/tokens.astro) exist. Their existence does not prove every consumer inherits every token; that integration remains open. |

### Hierarchy and meaning

| ID / PDF pages | Atlas standard and covered subrecommendations                                                                                                                                                                                                                  | Current counterpart and remaining work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-06 / 36-37  | SHOULD distinguish primary, secondary and supporting information instead of giving every element equal emphasis.                                                                                                                                               | `implemented`. [PurposeCard](src/react/cards/PurposeCard.tsx) separates metric value, label, period, context and actions. Supporting labels use the muted ink in [record display](src/styles/kit-records.css) and [record form preview](src/styles/workspace-forms.css); leads and section intros stay muted in [docs.css](src/styles/docs.css). Per-route acceptance of every screen is not certified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| UX-07 / 38-41  | SHOULD combine scale, contrast and composition for hierarchy instead of oversized main text and unreadably small supporting text.                                                                                                                              | `adapted`. [Typography](src/data/typography.ts) follows the project 12 px minimum (standard 14, reading 16) and the human 400/default, 300/minimum weight profile. The book's heavier UI examples do not supersede either.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| UX-08 / 42-45  | SHOULD derive supporting foregrounds for their painted surface; avoid generic grey or translucent white that looks disabled or reveals a busy image. MUST assess composited readability.                                                                       | `implemented`. [Brand roles](src/data/docs-brand.ts), [accessibility roles](src/data/accessibility.ts) and [provider](src/react/AtlasProvider.tsx) supply surface-specific inks. Text over photography uses an opaque panel in [AtlasMediaFrame](src/react/AtlasMediaFrame.tsx) instead of translucent white. Rendered contrast of every colored panel/opacity state is not certified; existing placeholder-opacity decisions remain explicit and are not an accessibility certificate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| UX-09 / 46-47  | SHOULD quiet competing navigation/sidebars before making the main action louder; retain discoverable and readable secondary content.                                                                                                                           | `implemented`. [Docs layout](src/layouts/DocsLayout.astro), [shell styles](src/styles/docs.css) and [section navigation](src/styles/documentation.css) use canvas/muted inks, a hover-only surface tint and a soft current-page surface; the desktop contents replaces section links when visible. Relative emphasis at every density and theme is not certified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| UX-10 / 48-53  | SHOULD simplify redundant read-only labels where units/context are unambiguous, combine value and unit when useful, and emphasize labels when readers scan technical specifications. MUST preserve form labels, relationships, currencies, units and identity. | `implemented`. [PurposeCard](src/react/cards/PurposeCard.tsx), [field presentation](src/data/field-kit.ts) and [record display](src/react/workspace/kit/RecordDisplay.tsx) present read-only values; [kit-records.css](src/styles/kit-records.css) uses muted labels, the compact field gap and a prose measure for values, and [composite table cells](src/styles/kit-collections.css) keep labelled leaves. Labels, units and currencies are retained; do not remove labels indiscriminately.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| UX-11 / 54-55  | MUST choose real heading levels for document semantics, then style their visual importance independently. Visually hidden headings must remain accessible when needed.                                                                                         | `source`. [AtlasCard](src/react/cards/AtlasCard.tsx), [RecordDisplay](src/react/workspace/kit/RecordDisplay.tsx) and [record forms](src/react/workspace/RecordFormsDemo.tsx) expose real headings/legends. Existing form accordion legends are visually hidden without dropping their semantics.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| UX-12 / 56-59  | SHOULD balance icon/text visual weight with semantic contrast and reserved functional boundary thickness; a softer icon must remain understandable.                                                                                                            | `implemented`. [AtlasIcon](src/react/AtlasIcon.tsx) keeps the native Phosphor regular geometry and paints with `currentColor` at the central `--icon-optical-size` ([components.css](src/styles/components.css)), so each icon takes the foreground role of its context: ink beside primary text and the muted ink in supporting or secondary contexts such as Empty State pictograms ([accessibility roles](src/data/accessibility.ts)). No heavier stroke, surrounding focus ring or layout shift is introduced; rendered contrast of every icon context is not certified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| UX-13 / 60-64  | SHOULD assign one primary task action per decision region, secondary outlines and quiet tertiary links/text. Severity and priority are separate; destructive confirmation retains its real consequence.                                                        | `implemented`. Identified consumers keep one primary task action per decision region on [AtlasButton](src/react/AtlasButton.tsx): [PurposeCard](src/react/cards/PurposeCard.tsx) renders a single solid `primaryAction` and text-fill `secondaryActions`; [FormExamples](src/react/FormExamples.tsx) pairs solid Validate with outline Reset; [RecordForm](src/react/workspace/kit/RecordForm.tsx) pairs solid Commit draft with text Cancel draft; [RecordDisplay](src/react/workspace/kit/RecordDisplay.tsx) pairs solid Edit record with text Close record; [DrawerExamples](src/react/DrawerExamples.tsx) pairs solid Add note with outline Close; the [feedback](src/react/FeedbackDemo.tsx) Modal pairs solid Apply changes with text Cancel. [Carousel](src/react/AtlasCarousel.tsx) and [AvatarGroup](src/react/AtlasAvatarGroup.tsx) use tint/text fills for secondary actions. The three Toast placement triggers demonstrate separate presentation variants, not one business decision, so they are not ranked against each other. Severity stays separate from priority; Popconfirm motion acceptance stays in its own delivery records. |

### Space and layout

| ID / PDF pages | Atlas standard and covered subrecommendations                                                                                                                                                                                | Current counterpart and remaining work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-14 / 66-69  | SHOULD begin with clear group separation and reduce it deliberately; dense data-workspaces are a conscious density choice, not a reason to shrink text/targets.                                                              | `implemented`. [docs.css](src/styles/docs.css) owns `--field-gap`, `--field-gap-compact`, `--field-gap-dense` and `--section-gap`; [record forms](src/styles/workspace-forms.css), [record display](src/styles/kit-records.css) and [Atlas form sections](src/styles/components.css) consume them. Text and targets do not shrink with density. The [Theme Builder model](src/theme-builder/model.ts) derives the same aliases from the editable spacing scale and density: comfortable entry (`--field-gap`), compact read-only display (`--field-gap-compact`) and dense data (`--field-gap-dense`), consumed for example by fieldsets, record fields and numeric cells in [kit-collections.css](src/styles/kit-collections.css). A regression case confirms compact and comfortable density leave text size and control minima unchanged. Spacing outside these identified consumers is not certified. |
| UX-15 / 70-75  | MUST use a constrained spacing/sizing system with meaningful small and large increments; no pixel-by-pixel improvisation or mechanical requirement that every value be a multiple of four.                                   | `source`. Shared space variables in [docs.css](src/styles/docs.css), [size profiles](src/react/AtlasSizeProfile.tsx) and [selection profiles](src/data/selection-sizes.ts) exist. Component-specific minima need an intentional owner; the book's 16px example does not change Atlas body typography.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| UX-16 / 76-83  | SHOULD give prose/forms only the width they need, start mobile at 320px, and place supporting context in a separate column when space permits without stretching fields. Wide data surfaces may legitimately use more space. | `implemented`. Prose uses the shared `--prose-measure` ([documentation.css](src/styles/documentation.css)); form controls keep bounded widths in [forms](src/styles/workspace-forms.css) and [components.css](src/styles/components.css); desktop record forms and [record panels](src/styles/kit-records.css) gain a second column through container queries only when space permits. Wide tables keep the full width.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| UX-17 / 84-91  | SHOULD use intrinsic/fixed sidebar widths and max-width content instead of forcing everything onto percentage columns. Do not make medium layouts wider than large layouts accidentally.                                     | `source`. [Docs shell](src/styles/docs.css) has explicit sidebar/reading/TOC variables and flexible content. [AtlasSplitter](src/react/AtlasSplitter.tsx) intentionally exposes user-controlled pane proportions; those are not an accidental grid rule. All layout transitions remain unverified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| UX-18 / 92-95  | MUST size font, padding, hit area and large headings independently; sm/md/lg must feel intentional rather than whole-widget zoom.                                                                                            | `source`. [AtlasButton](src/react/AtlasButton.tsx), [size profiles](src/react/AtlasSizeProfile.tsx) and [typography](src/data/typography.ts) separate these values. Existing held input geometry/token issues prevent a universal completion claim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| UX-19 / 96-100 | SHOULD make space around a semantic group greater than space within it; labels remain closer to their own control than to the next field, and headings belong visibly to following content.                                  | `implemented`. [Basic form](src/react/FormExamples.tsx), [record forms](src/react/workspace/RecordFormsDemo.tsx), [group styles](src/styles/workspace-forms.css) and [kit form](src/react/workspace/kit/RecordForm.tsx) provide semantic groups; the larger `--section-gap` separates groups and the smaller `--field-gap` separates fields within them. Spacing in every layout/list is not measured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### Typography and reading

| ID / PDF pages  | Atlas standard and covered subrecommendations                                                                                                                                                                                                        | Current counterpart and remaining work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-20 / 102-107 | MUST use explicit semantic type scales; do not compound nested em values into off-scale readable text. Mathematical ratios are tools, not mandatory formulas.                                                                                        | `source`. [Typography](src/data/typography.ts) supplies explicit docs sizes/line heights; approved consumers retain their own profile. The 12px project minimum covers readable descendants, including code and metadata. Runtime coverage is not universal.                                                                                                                                                                                                                                                                             |
| UX-21 / 108-113 | SHOULD choose legible fonts for their actual text size, available weights and language coverage; references inform selection without replacing brand decisions.                                                                                      | `adapted`. Existing Outfit variable font assets and [font declarations](src/styles/docs.css) meet Atlas's chosen identity. System fonts, serifs or condensed headline faces in the reference are not new defaults; no font installation follows.                                                                                                                                                                                                                                                                                         |
| UX-22 / 114-117 | SHOULD constrain prose to a readable character measure, normally around 45-75 characters per line. Large tables/images may be wider than neighboring prose.                                                                                          | `implemented`. [docs.css](src/styles/docs.css) defines `--prose-measure: 65ch`; [documentation.css](src/styles/documentation.css) applies it to leads, section intros, example prose and usage/accessibility/notes lists, and Empty State descriptions, record display and collection record values, kit captions, record-form captions and review values, and media and screenshot captions use the same measure. Demos, code, tables and resources keep the page width. Line length in every language and zoom level is not certified. |
| UX-23 / 118-121 | SHOULD align adjacent mixed-size text by its baseline; icons, thumbnails and multi-line rows may need other deliberate alignment.                                                                                                                    | `implemented`. The site brand and component metadata in [docs.css](src/styles/docs.css) and collection and record-display headings in [kit-collections.css](src/styles/kit-collections.css) and [kit-records.css](src/styles/kit-records.css) declare baseline alignment for mixed-size text. Avatar, icon and control rows keep deliberate center alignment.                                                                                                                                                                            |
| UX-24 / 122-125 | SHOULD use more line spacing for small or long-line text and tighter line spacing for large headings; one ratio need not fit every role.                                                                                                             | `source`. [Typography](src/data/typography.ts) separates body, heading, section and subsection line heights. Existing 14px/22px body and user zoom remain authoritative; long-text consumers still need rendered acceptance.                                                                                                                                                                                                                                                                                                             |
| UX-25 / 126-127 | SHOULD keep prose links discoverable while making dense navigation quieter. Hover is never the sole indication or way to reach an action.                                                                                                            | `source`. [Documentation navigation](src/styles/documentation.css) uses restrained default links and an immediate keyboard underline. [AtlasButton](src/react/AtlasButton.tsx) retains real action semantics; a link-looking action does not become a navigation link.                                                                                                                                                                                                                                                                   |
| UX-26 / 128-131 | SHOULD start-align long prose, reserve centering for short independent copy, end-align comparable numbers and use tabular digits. Prefer natural wrapping over justified UI text; justified editorial content would need language-aware hyphenation. | `implemented`. [Card numeric styles](src/styles/atlas-card.css) use tabular digits; [kit table styles](src/styles/kit-collections.css) end-align number/money/unit/duration cells and composite leaves with tabular digits while labels keep the start edge; [Chart](src/react/AtlasChart.tsx) data tables mark numeric columns. Long Empty State descriptions wrap start-aligned within the prose measure ([components.css](src/styles/components.css)). IDs, units and table scrolling are unchanged.                                  |
| UX-27 / 132-136 | SHOULD respect the chosen font's spacing and use case-aware wording. The reference's tighter headlines/wider all-caps tracking are optional alternatives.                                                                                            | `adapted`. [docs.css](src/styles/docs.css) retains the human zero-tracking rule. Do not add local tracking to imitate the book; shorten or sentence-case an awkward uppercase label instead.                                                                                                                                                                                                                                                                                                                                             |

### Color and accessibility

| ID / PDF pages  | Atlas standard and covered subrecommendations                                                                                                                                        | Current counterpart and remaining work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-28 / 138-141 | SHOULD reason about color attributes rather than unrelated literals; distinguish hue/chroma/lightness or whiteness/blackness correctly. Serialization format is not the UX contract. | `adapted`. [Color system](src/data/color-system.ts) uses validated HWB composition and converts through the existing pipeline. Keep that decision rather than replacing it with the reference's HSL/HSB preference or its historical browser assumptions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| UX-29 / 142-147 | SHOULD provide neutral, primary and semantic accent roles with enough tonal steps for text, fields, panels, statuses and data categories; use accents sparingly.                     | `source`. [Theme](src/theme.ts), [brand](src/data/docs-brand.ts), [palette](src/data/button-palette.ts) and [accessibility](src/data/accessibility.ts) provide these roles and 24 active presets. A preset count does not prove all states/consumers inherit them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| UX-30 / 148-151 | MUST reuse approved base/edge/intermediate shade definitions; avoid slightly different per-component lighten/darken recipes and uncontrolled new tones.                              | `source`. [Brand palettes](src/data/docs-brand.ts) and [button palette](src/data/button-palette.ts) use the installed Ant Design generator and shared composition. Tune only the owning model under an authorized change; do not hand-pick a parallel scale in a component.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| UX-31 / 152-157 | SHOULD assess perceived brightness and saturation at tonal extremes, with restrained hue shifts owned by the palette model. Hue changes must not silently change semantic identity.  | `source`. The existing official palette generator in [docs-brand.ts](src/data/docs-brand.ts) owns tonal derivation; [color-system.ts](src/data/color-system.ts) owns composition. No new per-component saturation/hue algorithm is needed. Visual acceptance of every family remains unproven.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| UX-32 / 158-161 | MAY use an intentional neutral temperature, but it MUST remain consistent with the approved surfaces.                                                                                | `adapted`. [Theme](src/theme.ts) retains warm light and neutral dark canvas/panels. The reference's blue-grey examples do not authorize the earlier unwanted blue-black background regression.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| UX-33 / 162-165 | MUST meet the applicable contrast contract on the actual painted surface. SHOULD use readable dark-on-tint status treatments where strong solid fills would steal task priority.     | `implemented`. [Accessibility roles](src/data/accessibility.ts), [brand contrast selection](src/data/docs-brand.ts), [Pill](src/react/AtlasPill.tsx) and [feedback](src/react/AtlasFeedback.tsx) supply surface-specific and tinted status treatments; [Upload](src/react/AtlasUpload.tsx) and [Chart](src/react/AtlasChart.tsx) report problems as text alerts. Source ratios do not certify every alpha/image/disabled state; no WCAG 2.2 AA conformance claim is made and no book shorthand replaces it.                                                                                                                                                                                                                                                                                                                                    |
| UX-34 / 166-170 | MUST communicate status/trend/selection with text, shape or icon as well as color. Charts need explicit labels/values and distinguishable series, not color-only meaning.            | `implemented`. [Metric meaning text](src/react/cards/PurposeCard.tsx) and [selection marks](src/react/AtlasSelectionVariants.tsx) pair color with text/shape. [AtlasChart](src/react/AtlasChart.tsx) draws multi-series grouped bars on one zero-based scale with fill-plus-pattern series, a labelled legend, value labels and the complete data table, and refuses invalid data with a text alert. It is one grouped-bar pattern, not a complete chart library. The [GenUI surface](src/react/genui/AtlasGenUISurface.tsx) retains its labelled meter/data display and now registers [AtlasSeriesChart](src/react/genui/native/series-chart.tsx), which reuses the existing AtlasChart grouped-bar, legend and complete-table presentation through validated JSON. This remains a bounded grouped-bar pattern, not a complete chart library. |

### Depth and layering

| ID / PDF pages  | Atlas standard and covered subrecommendations                                                                                                                                                    | Current counterpart and remaining work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-35 / 172-179 | SHOULD maintain a consistent overhead light cue: darker upper inset edge/lighter lower inset edge for wells, restrained raised cues for controls. Avoid photorealistic decoration.               | `source`. [Input surfaces](src/data/input-surfaces.ts) implement the approved inset treatment; [AtlasButton](src/react/AtlasButton.tsx) retains flat/3D and a fixed body. The supplied input standard, not a fresh approximation of the book, owns exact values.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| UX-36 / 180-185 | SHOULD assign elevation by role and interaction: control, popup and modal are distinct. Drag feedback must have an accessible non-drag alternative; pressed feedback must not move the hit area. | `implemented`. The [Theme Builder model](src/theme-builder/model.ts) binds the legacy `--shadow-contact`, `--shadow-soft` and `--shadow-raised` aliases to the same editable `shadow-sm`/`shadow-md`/`shadow-lg` [definitions](src/theme-builder/definitions.json) that feed Ant Design's `boxShadowTertiary`, `boxShadow` and `boxShadowSecondary`, so control, popup and modal elevation share one scale. [Dropdown](src/react/AtlasDropdown.tsx) and [overlay](src/react/AtlasOverlay.tsx) use it; [atlas-shadows.css](src/styles/atlas-shadows.css) keeps its generated recipes; control bodies stay stationary when pressed. One regression case confirms edits to the three roles reach the aliases. Large decorative book shadows do not override Atlas restraint. |
| UX-37 / 186-189 | MAY compose ambient and contact shadows through central tokens, reducing contact emphasis at higher elevation instead of stacking arbitrary effects.                                             | `source`. [atlas-shadows.css](src/styles/atlas-shadows.css) includes layered/native multi-part recipes and [input-surfaces.ts](src/data/input-surfaces.ts) owns inset pairs. Do not require two shadows on every surface or introduce local geometry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| UX-38 / 190-193 | SHOULD express flat depth using approved surface relationships and short stationary layers: darker wells, lighter independent surfaces, and the existing 3D lip where selected.                  | `source`. [Theme](src/theme.ts), [input surfaces](src/data/input-surfaces.ts), [AtlasButton](src/react/AtlasButton.tsx) and [AtlasCard](src/react/cards/AtlasCard.tsx) exist. Flat must remain a genuine separate presentation rather than inheriting a tactile lip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| UX-39 / 194-198 | MAY overlap meaningful layers while maintaining contrast, separation, focus and unobscured controls. Overlapping media needs a stable surface-colored separation treatment.                      | `implemented`. Native popups/drawers/modals layer through [AtlasOverlay](src/react/AtlasOverlay.tsx). [AtlasAvatarGroup](src/react/AtlasAvatarGroup.tsx) overlaps decorative faces beside an always-visible native names list with a real expand control, and [AtlasCarousel](src/react/AtlasCarousel.tsx) shows one manual slide with Previous/Next buttons and a status position, without autoplay, swipe or timers. No decorative Card nesting is added.                                                                                                                                                                                                                                                                                                               |

Overlay backdrop standard (permanent human decision, 2026-10-15): every user-opened upper layer dims the page behind it with a neutral scrim and a fixed 1 px background blur. Non-modal panels and their bound trigger stay sharp; Drawer and Modal blur the whole background including the trigger; Toast and Notification are excluded; Tooltip is included while it is actually visible after hover or keyboard focus, with its delay preserved and its popup and trigger sharp. The rule lives in the [UX standards layers section](src/pages/standards.astro) (legacy anchor `overlay-standard`) and its generated token table in the [Design tokens page](src/pages/tokens.astro); the six `overlay` definitions belong to [definitions.json](src/theme-builder/definitions.json). New layered components join the existing shared table in [drawer-feedback.spec.ts](browser/drawer-feedback.spec.ts) with one row. Status: `IN_PROGRESS` until the root conductor's real GREEN receipt; see [Consolidated standards update](#consolidated-standards-update-2026-10-15). The UX-36 and UX-39 rows above keep their recorded status and evidence; this note is not runtime or browser evidence. Details: [Overlay backdrop standard](#overlay-backdrop-standard).

### Images and assets

| ID / PDF pages  | Atlas standard and covered subrecommendations                                                                                                                                                                                 | Current counterpart and remaining work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-40 / 200-201 | SHOULD choose suitable high-quality, licensed photography at the actual content/design stage; do not assume a placeholder can later be replaced with an arbitrary photo.                                                      | `process`. [Local selection SVGs](public/selection/) and the fictional [Avatar demo](src/react/AvatarDemo.tsx) are labelled examples, not a production photo library. Asset purchase, external licensing and photo capture are not implied by this reference.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| UX-41 / 202-207 | MUST keep text readable across the real image, not just a convenient sample. MAY use a semantic opaque caption surface, bounded scrim, authorized image treatment or restrained text contrast aid when appropriate.           | `implemented`. [AtlasMediaFrame](src/react/AtlasMediaFrame.tsx) is a native figure/figcaption that reserves a landscape/square/portrait ratio, supports cover/contain fit, treats an empty alt as decorative, shows a text fallback for a missing or failed image and places overlay text on an opaque panel. [CardMedia](src/data/card-model.ts) still covers monograms/symbols only. No image service, photo library or asset licence is implied; the book's glow/colorization techniques remain optional alternatives.                                                                                                                                                                                                                                                                                                                                                                                                          |
| UX-42 / 208-213 | SHOULD use icons at their designed optical size, place a small icon in a larger reserved container rather than merely magnifying it, capture screenshots at a readable scale/crop, and simplify marks for small favicon uses. | `implemented`. [AtlasIcon](src/react/AtlasIcon.tsx) has native geometry; Empty State keeps its control-height image slot and centers the glyph at an optical size in [components.css](src/styles/components.css); [RichMenu](src/react/AtlasRichMenu.tsx) and [IconList](src/react/AtlasIconList.tsx) reserve icon containers. [AtlasScreenshot](src/react/AtlasScreenshot.tsx) on the existing media page shows the public recorded DPR 1 Avatar PNG (1440 by 1000) at its original CSS size inside its own named, keyboard-focusable scroll region with an immediate bottom focus edge ([atlas-screenshot.css](src/styles/atlas-screenshot.css)) instead of scaling it down; a missing or failed image shows a text fallback. The simplified favicon SVG is served with HTTP 200 and an SVG content type. No separate screenshot route was added. Do not shrink readable UI text inside live components to imitate a screenshot. |
| UX-43 / 214-218 | MUST reserve user-image geometry and define crop, missing/loading/failure behavior and accessible identity. SHOULD separate same-color images from their surroundings with a restrained functional inner edge where needed.   | `implemented`. [AtlasAvatar](src/react/AtlasAvatar.tsx) reserves its size, retries a changed source, falls back to initials and has a `decorative` mode for a visible paired name; copied snippets import its stylesheet. [AtlasMediaFrame](src/react/AtlasMediaFrame.tsx) reserves its ratio, handles missing/failed images and its retry requests the same source again. Loaded images in the [Avatar](src/styles/atlas-avatar.css) and [media](src/styles/atlas-media.css) styles draw only a functional inner edge of the central `--image-edge-width` in the line color; `box-sizing: border-box` keeps the reserved dimensions, and initials and fallbacks stay edgeless. [Selection media](src/react/AtlasSelectionVariants.tsx) uses cover cropping. No upload/storage/cropping service is implemented.                                                                                                                    |

### Finishing and richer compositions

| ID / PDF pages  | Atlas standard and covered subrecommendations                                                                                                                                                                                | Current counterpart and remaining work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-44 / 220-223 | MAY enrich existing list bullets, attributed quotations, links and selection controls with meaningful branded treatment while retaining native semantics and one clear hierarchy.                                            | `implemented`. [Selection variants](src/react/AtlasSelectionVariants.tsx) and [navigation links](src/styles/documentation.css) provide branded controls. [AtlasIconList](src/react/AtlasIconList.tsx) is a native list with decorative icons and visible titles; [AtlasQuote](src/react/AtlasQuote.tsx) is a figure with a blockquote and a figcaption attribution, plus optional context that discloses examples. Decoration does not imply verified security, endorsement or availability.                                                                                                                                                                               |
| UX-45 / 224-227 | MAY use a single functional accent for selection or status when it improves comprehension; do not add decorative bars to every card, heading or page.                                                                        | `adapted`. [Selection borders](src/styles/atlas-selection-variants.css), [status feedback](src/react/AtlasFeedback.tsx) and existing navigation supply functional meaning. Atlas's no-decorative-frame and non-enclosing focus rules prevail; a status accent and a focus cue remain different concepts.                                                                                                                                                                                                                                                                                                                                                                   |
| UX-46 / 228-233 | SHOULD use the approved surface hierarchy for section distinction. The reference's gradients, repeating patterns and background illustrations are optional aesthetics, not requirements.                                     | `adapted`. [Theme](src/theme.ts) retains the explicitly restored backgrounds. No gradient/texture/global recoloring is introduced, and no pattern/illustration asset is required merely to fill a plain background.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| UX-47 / 234-237 | SHOULD distinguish first use, no match and failure with useful explanation and a real next action. Hide irrelevant tools in a first-use empty view; keep search/filter recovery reachable when a query yields nothing.       | `implemented`. [AtlasEmptyState](src/react/AtlasEmptyState.tsx), [demo](src/react/EmptyStateDemo.tsx) and [StateSurface](src/react/workspace/kit/StateSurface.tsx) exist; [RecordCollection](src/react/workspace/kit/RecordCollection.tsx) now hides irrelevant query/view tools for true first use while no-match recovery keeps search/filter reachable. [Carousel](src/react/AtlasCarousel.tsx) and [Chart](src/react/AtlasChart.tsx) state their empty/unavailable data. Other card/attachment consumers are not certified. Never invent recovery permission.                                                                                                          |
| UX-48 / 238-241 | SHOULD try spacing, alignment and appropriate existing surface separation before adding a border or another shadow. MUST keep functional form, selected, invalid and table boundaries.                                       | `implemented`. [AtlasCard](src/react/cards/AtlasCard.tsx) is borderless by default and rejects nested Cards; form sections and record fieldsets are borderless ([components.css](src/styles/components.css), [workspace-forms.css](src/styles/workspace-forms.css), [kit-records.css](src/styles/kit-records.css)); Empty State and the new patterns add no decorative frame. Table, selected, invalid and error-summary boundaries remain. No blanket border removal is authorized.                                                                                                                                                                                       |
| UX-49 / 242-248 | MAY compose menus with labelled groups/icons/supporting text or columns, tables with related fields/media, and radio choices as cards/boxes. Maintain each widget's own keyboard, sorting/filtering and selection semantics. | `implemented`. [Dropdown](src/react/DropdownDemo.tsx) has grouped/nested/icon menus; [AtlasRichMenu](src/react/AtlasRichMenu.tsx) adds labelled groups, icons and supporting descriptions through AtlasDropdown's native menu, focus and dismissal. The [record table](src/react/workspace/kit/ViewAdapters.tsx) has composite columns and Avatar identity cells ([kit-identity.css](src/styles/kit-identity.css)); [selection variants](src/react/AtlasSelectionVariants.tsx) have boxes/icon/image cards. The popup uses two columns at 40rem and above and one column below it ([atlas-rich-menu.css](src/styles/atlas-rich-menu.css)); native menu order is preserved. |

### Ongoing practice

| ID / PDF pages  | Atlas standard and covered subrecommendations                                                                                                                                                                                                                                   | Current counterpart and remaining work                                                                                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-50 / 249-252 | SHOULD study unfamiliar effective decisions and rebuild only bounded authorized examples. Consider datepicker surface contrast, inline input actions and two-tone headings as task-specific patterns; record findings without copying a brand or expanding tests unnecessarily. | `process`. [Date/time](src/react/AtlasDateTime.tsx), [input catalog](src/react/DataEntryCatalog.tsx) and [overview](src/pages/index.astro) provide related examples. The book's examples are not authority to change global backgrounds or held packages. No recurring audit, background automation or unlimited iteration follows. |

## Components and patterns mentioned by the reference

The source catalog contains 38 component routes across `catalog.ts`,
`catalog-extensions.ts`, `catalog-content.ts` and `catalog-ux-patterns.ts`,
including the six pages added by the UX completion delivery. The Screenshot
belongs to the existing media page, and read-only static `source/*.txt` text
resources are not UI routes. An available Ant Design package
API is not automatically an Atlas component, and an illustrative photograph is
not automatically a requirement for a new UI primitive.

| Component/pattern family                                                        | Atlas counterpart                                                                                                           | Actual status                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buttons, icon actions, search and inline input actions                          | AtlasButton, AtlasIconButton, AtlasButtonGroup, AtlasInput family and DataEntryCatalog                                      | Existing sources. Held input/token and complete wave coverage issues remain separate.                                                                                                                                                                                                                                                 |
| Fields, field groups, forms and validation                                      | AtlasInput/InputNumber, FormExamples, RecordForm, RecordFormsDemo                                                           | Existing native fields and semantic grouping; not every layout/state is accepted.                                                                                                                                                                                                                                                     |
| Checkbox, Radio, Switch and selectable plan/image/icon cards                    | AtlasSelectionVariants and existing demos; pricing/selection PurposeCard recipes                                            | Existing. No duplicate selection engine is needed. Source coverage is not complete acceptance of all prior UX scenarios.                                                                                                                                                                                                              |
| Dropdown and grouped/nested/icon menus                                          | AtlasDropdown and DropdownDemo                                                                                              | Existing; AtlasRichMenu adds grouped supporting descriptions and icons. The native popup uses two columns at 40rem and above and one below it; native item order is preserved.                                                                                                                                                        |
| Tabs, navigation, sidebar, datepicker/calendar                                  | Workspace tabs; Breadcrumb, Steps, Pagination, native date/time and collection calendar views                               | Existing component-specific implementations. Date/model and layout acceptance gaps remain; no universal navigation primitive is claimed.                                                                                                                                                                                              |
| Alert, Toast, Notification, Modal and confirmation                              | AtlasFeedback and demos                                                                                                     | Existing sources. Feedback motion and earlier Popconfirm acceptance remain open.                                                                                                                                                                                                                                                      |
| Cards, metric/statistic, profile/product/content and pricing summaries          | AtlasCard, PurposeCard and its 23 purpose models/recipes                                                                    | Existing. A `media` purpose with a symbolic illustration is not a photo renderer.                                                                                                                                                                                                                                                     |
| Tables, lists, composite identity cells and record detail summaries             | RecordCollection/ViewAdapters/RecordDisplay and collection views                                                            | Existing; numeric end-alignment with tabular digits and decorative Avatar identity cells are delivered. Full reading hierarchy across every view is not certified.                                                                                                                                                                    |
| Data charts and trends                                                          | PurposeCard trend meaning text; registered GenUI labelled meters/data; AtlasChart                                           | AtlasChart delivers multi-series grouped bars with a patterned legend and the full data table. It is not a complete chart library; other chart types are absent.                                                                                                                                                                      |
| Empty states                                                                    | AtlasEmptyState plus StateSurface and RecordCollection first-use reuse                                                      | Existing; first-use tool visibility is adopted by RecordCollection. Other consumers are not certified.                                                                                                                                                                                                                                |
| Avatar/profile image                                                            | AtlasAvatar, AvatarDemo and AtlasAvatarGroup                                                                                | Existing; the decorative paired-name mode, initials fallback and snippet stylesheet imports address the stylesheet and paired-name review findings. The source inventory now links actual allowlisted build-time text files; this resolves the source-link implementation finding without claiming copied-example runtime acceptance. |
| Photo/media frame, caption and text-over-image surface                          | AtlasMediaFrame, AtlasScreenshot and the media demo                                                                         | Delivered: ratio, fit/crop, alt or decorative image, missing/failed fallback, same-source retry, caption and opaque overlay without an extra Card. Loaded images draw a functional 1px inner edge without changing their reserved size. No image service is implied.                                                                  |
| Upload/dropzone illustrated in the inset example                                | AtlasUpload (native Upload.Dragger) and its demo; EvidencePanels metadata                                                   | Delivered local selection only: type/size checks on choose and drop, alerts, removal and Space activation. Nothing is sent; there is no upload, storage or file processing.                                                                                                                                                           |
| Icon list, quotation and testimonial                                            | AtlasIconList and AtlasQuote with the content patterns demo                                                                 | Delivered with native list and figure/blockquote/figcaption semantics and visible attribution; no endorsement is implied.                                                                                                                                                                                                             |
| Overlapping media, AvatarGroup and Carousel controls                            | AtlasAvatarGroup and AtlasCarousel; overlays handle popup layers                                                            | Delivered: overlapping faces with visible names and an expand control; a manual single-slide carousel without autoplay, swipe or timers.                                                                                                                                                                                              |
| Optical icon containers, legible screenshot presentation and simplified favicon | AtlasIcon at the central optical size, Empty State glyph, RichMenu/IconList containers, AtlasScreenshot and the favicon SVG | Delivered: optical icon sizing for those consumers, an original-size recorded screenshot in its own keyboard scroll region on the media page and a simplified favicon SVG served with the correct type.                                                                                                                               |

## Delivered application steps and remaining work

The six steps formerly listed here were implemented in the 15 October 2026 UX
completion delivery. `implemented` means a delivered shared pattern with
identified consumer adoption, not universal runtime certification.

1. **Avatar review findings:** [AtlasAvatar](src/react/AtlasAvatar.tsx) has a
   `decorative` paired-name mode and an initials fallback, and copied snippets
   import its stylesheet with conditional delivery preserved. Table identity
   cells use the decorative mode beside the visible name.
2. **Media:** [AtlasMediaFrame](src/react/AtlasMediaFrame.tsx) is a flat figure
   with ratio, fit, caption, decorative alt, missing/failed fallback and an opaque
   overlay panel. It implies no image service.
3. **Missing patterns:** [AtlasIconList](src/react/AtlasIconList.tsx),
   [AtlasQuote](src/react/AtlasQuote.tsx),
   [AtlasAvatarGroup](src/react/AtlasAvatarGroup.tsx),
   [AtlasCarousel](src/react/AtlasCarousel.tsx) and the local-only
   [AtlasUpload](src/react/AtlasUpload.tsx) exist with native semantics. Upload
   keeps files on the device; nothing is sent, stored or processed.
4. **Menu composition:** [AtlasRichMenu](src/react/AtlasRichMenu.tsx) adds
   grouped supporting descriptions and icons through the existing AtlasDropdown
   engine. The popup uses two columns at 40rem and above and one column below it ([atlas-rich-menu.css](src/styles/atlas-rich-menu.css)); native menu order is preserved.
5. **Typography consumers:** a shared 65ch prose measure, baseline-aligned
   mixed-size rows, numeric end-alignment with tabular digits in kit tables and
   the Empty State optical glyph. Fixed user typography, table scrolling, input
   wells and approved backgrounds are unchanged.
6. **Cross-consumer adoption:** density and section gaps, muted supporting
   labels, borderless semantic groups, RecordCollection first-use tool visibility
   and text alerts for Upload/Chart problems. [AtlasChart](src/react/AtlasChart.tsx)
   adds a multi-series grouped-bar chart with a patterned legend and the full data
   table; it is not a complete chart library.

Follow-up adoption closed the five rows that had remained `partial`, each for
its identified consumers: UX-12 (central optical icon size and contextual
foreground roles), UX-13 (one primary action per identified decision region),
UX-36 (legacy shadow aliases bound to the editable sm/md/lg elevation scale,
with central density gap aliases), UX-42 (original-size recorded Screenshot on
the media page and the simplified favicon SVG) and UX-43 (functional 1px image
inner edge and same-source Media retry). No row remains `partial`. The Avatar
source-link implementation finding is resolved by actual allowlisted source destinations; copied-example runtime acceptance is not claimed.

The earlier documentation pass applied no source fixes; the controller had
incorrectly treated test limits as an implementation stop. The human clarified
on 15 October 2026 that authorized implementation continues with minimal
meaningful TDD and no correction-counter stop.

## Verification record and limits

### Current UX completion delivery

The controller-written outcome and evidence coverage record is
`/Users/w6x/Developer/atlas-temporal/evidence/ux-completion-outcome.json`.
This document links that record and adds no logs of its own.

- Genuine RED before implementation: five new routes returned 404 and the
  paired table Avatar was missing (6 failures); paired Avatar wrappers were not
  decorative (1 failure); the Theme Builder `extractDemoStyles` call failed type
  checking (TS2554).
- The same frozen checks then passed. The first green run's two failures were a
  test setup bug (Amount not yet projected) and a real projection pointer
  defect, both corrected inside the same scenarios. The 320px selection-column
  density defect gained one assertion in its existing scenario. A pinned
  es-module-lexer API change in the existing graph walker was corrected without
  changing assertions.
- Build: six new component routes, 38 component routes and 47 pages. Astro
  check: 0 errors with 102 typed copy snippets. Lint: 163 modules, 0 errors.
  Motion admission: 2 PASS. The previously failed existing Hybrid case 3 now
  passes with lazily loaded CSS; only that Hybrid case was rerun.
- First-delivery test scope: four test files defined 11 cases, of which 10
  were selected. No additional test wave, matrix or schedule was started. The
  planned scope remains frozen. An exception permits one minimum necessary
  check for newly requested behavior or an observed defect, with the reason
  recorded; an obsolete correction counter does not stop implementation.
- The approved light/dark canvases and panels are unchanged.
- Not claimed: universal browser/device coverage, rendered contrast
  certification, CI, backend upload/storage, licensed photography or book
  assets, or a complete chart library.

### Follow-up adoption of the five partial rows

- Scope: UX-12, UX-13, UX-36, UX-42 and UX-43 as described in their rows. No
  new component route, test file, dependency, backend service, external API call, GenUI capability or
  approved decision was added; the Screenshot lives on the existing media page.
- Genuine RED, then the same check GREEN: the screenshot region's keyboard
  bottom edge measured 0px, then the central 3px focus marker; Media retry of
  the same source failed before the fix and then issued two requests for that
  source. The one new case, in the existing `theme.test.mjs`, covers a
  confirmed broken CSS bridge: edits to the three editable shadow roles reach
  the legacy aliases, and compact/comfortable density leaves text size and
  control minima unchanged. It passed.
- Test scope: the existing PDF scope grew from 4 files with 11 cases to 5
  existing files with 12 cases. Other confirmed defects gained assertions
  inside existing cases. The Hybrid file still has 3 cases; only the previously
  failed case 3 was rerun, with the same GREEN. No GenUI (51) or browser (24)
  test wave, matrix or schedule was started.
- Recorded runs: avatar-route-green 2 expected, 0 unexpected; consumer-green 3
  expected, 0 unexpected; media-final-green 1 expected, 0 unexpected;
  hybrid-green 1 expected, 0 unexpected. None were skipped or flaky.
- Gates: Astro check 0 errors and 2 hints across 180 files with 103 typed copy
  snippets; lint 165 modules, 0 errors; build 47 HTML pages with 38 component
  routes and a passing ECA check; motion admission 2 PASS; new token regression
  1 PASS.
- Outcome: the current acceptance section and outcome record supersede this
  intermediate review-pending state; review04 found no remaining code defect,
  and its documentation-only finding was corrected by exact source readback.
- Historical held-counter stops of other packages are revoked; their failed
  checks are not marked done by this delivery.
- Not claimed: universal browser/device coverage, physical devices, rendered
  contrast certification of every state, CI, backend upload/storage services,
  licensed photography or a complete chart library.

### Earlier history

The prior delivery record is
`/Users/w6x/Developer/atlas-temporal/evidence/refactoring-ui-outcome.json`:

- Genuine pre-implementation RED: both new routes returned 404 in three cases.
- Scoped GREEN: first-use creation/focus and Avatar fallback/geometry passed in
  green01; the recovery case passed in green02 on unchanged application source.
- Build: 41 pages and documentation structure passed. Lint: 148 modules passed.
- At that time, general documentation types, browser types, kit dictionary-subset
  and feedback motion gates were failing; the current results above supersede
  them where they report the same gate. CI, Firefox/WebKit, physical devices and complete
  cross-component rendered accessibility were not established.
- Independent review then requested revision: one major Avatar stylesheet
  integration issue and two minor paired-name/resource-inventory issues. The
  current delivery addresses the stylesheet, paired-name and source-link findings;
  source inventories now expose allowlisted build-time text destinations.
- Shared focused execution: 25,733ms including the recorded local gates; two
  correction batches, one behavioral test file and three cases used.

This documentation update records the delivered code; it adds no application
code, tests, quality gate or scheduled work itself. **Reference coverage is
complete; all 23 former gap/partial rows are implemented for their identified
consumers, none remain partial, and product-wide runtime verification is not
claimed.**

### Final lifecycle corrections

Review03 identified loss of keyboard focus after successful media retry and a
Screenshot failure remembered across source changes. Claude implemented both
through Temporal; serial CAS updated the main source. Media completion checks
the actual retry button against its owner document's active element before
unmounting it, so it does not move focus when the user already left. The stable
figure has a caption/alt name and one immediate shared bottom marker. Screenshot
resets failure when its requested source changes and keys the actual image.

Only their necessary controls ran: the existing media browser scenario passed
and the new Screenshot lifecycle unit passed. The unit proves React props and
failure state, not network or browser layout. Mandatory gates remain unchanged
and passing: 180 typed source files, 103 strict copy snippets, 165 linted modules,
47 HTML pages/ECA, browser types and two motion admission controls. No unchanged
successful browser scenarios or historical node cases were rerun for this fix.

### Overlay backdrop standard

Permanent human decision recorded 2026-10-15. Every user-opened upper layer
(Dropdown, Select, AutoComplete, Cascader, DatePicker, TimePicker, range
pickers, rich menus, Popconfirm, Popover, Drawer, Modal and the Tweaker) dims
the page behind it with a neutral black scrim and a fixed 1 px background blur.
A non-modal panel and its bound trigger stay sharp above the scrim; Drawer and
Modal blur the whole background including the trigger. Toast and Notification
are excluded. Tooltip is included: the scrim and blur apply only while it is actually
visible after hover or keyboard focus, its delay is preserved, and the Tooltip
popup and its trigger stay sharp.
Native outside click, Escape, focus return, the 14 CSS px text minimum and
readability are preserved.

Token source: six `overlay` group definitions in
[definitions.json](src/theme-builder/definitions.json) (`overlay-scrim-color`,
`overlay-scrim-opacity`, `overlay-backdrop-blur`, `overlay-scrim-z`,
`overlay-trigger-z`, `overlay-popup-z`) are the single role source; the
[model](src/theme-builder/model.ts) and [theme](src/theme.ts) generate
`--overlay-scrim`, `--overlay-backdrop-blur` and the z roles. Motion aliases
`--overlay-open-duration`, `--overlay-close-duration` and `--overlay-easing`
read `--press-duration`, `--release-duration` and `--motion-easing`; they add no
timing values, and reduced motion is instant. The former `--dropdown-scrim`,
`--dropdown-backdrop-blur`, `--dropdown-backdrop-z` and `--dropdown-trigger-z`
names are compatibility aliases only. Existing modal caller z values are
preserved; `layerOrder` is metadata, not a universal claim. Theme Builder keeps
complete valid 51-token recipes, fills only the six new roles with factory
defaults and still rejects unknown or partial recipes under the unchanged
storage key and version 1.

Status: standard and central implementation integrated; runtime acceptance
and human visual approval tracked separately. The central helper
`data/overlay-tokens.ts` and the controller `overlay-backdrop.ts` are the
single runtime owners of the overlay roles that reach definitions, model,
theme, docs.css and component CSS. New layered components must consume the
semantic tokens and must join the existing shared table in
[drawer-feedback.spec.ts](browser/drawer-feedback.spec.ts) with one row; that
table is the only browser oracle, and no separate spec file or new wave exists.
The initial real RED is `overlay-backdrop-red-full.log`; the outcome record is
`/Users/w6x/Developer/atlas-temporal/evidence/overlay-backdrop-delivery-20261015.json`,
written by the root conductor after the checks finish. Current runtime
acceptance is recorded in the linked outcome receipt; this source documentation
is not evidence of passing browser or CI checks, screenshots or human visual
approval, and no historical record above changes.

### Consolidated standards update (2026-10-15)

Status (current): the eight consolidated packages are acceptance GREEN on their
own receipts (P0-A 2, P0-B table 1, P1-A full Tab scan 1 plus pointer final 1
plus mode 1, P1-B 3, P1-C 1, P2-A 1, P2-B 1). P2-C passed one actual native
Temporal dry run with the same two security regressions GREEN; native usage
reports provider `openai-codex`, model `gpt-6.1-sol`. The earlier install block
was a misdiagnosis, resolved by a private HOME tools link and validated runtime
permissions without vendor install, update, authentication, configuration or
pool change; Hermes code writes remain read-only proposals. The root
conductor's record is
`/Users/w6x/Developer/atlas-temporal/evidence/consolidated-20261015/delivery.json`;
`hermes-runtime-block.json` in the same folder is historical evidence. That
evidence root is local, untracked and not HTTP served. Human visual approval is
PENDING. No genuine RED log is restated here; the receipts list them. Earlier
passed history above and the eight documentation sections are unchanged.

- Current packages: information architecture 3 GREEN, spacing 1 GREEN and font
  1 GREEN for explicit new requests; radius, size and List are integrated with
  acceptance PENDING. The frozen 59 GenUI packages stay 58 integrated plus 1
  live endpoint/authentication decision; no catalog rescan or new backlog.
- Tokens: 61 definitions (51 legacy + 6 overlay + 3 compact + 1 weight); stored
  51/57/60-token recipes stay valid; `Atlas*` source APIs and storage keys are
  unchanged. Tests: 80 node source files with one font case added (2 -> 3);
  browser specs 21 -> 26 files with 7 cases. No CI, Firefox, WebKit, device or
  visual claim.
- Open, non-blocking: the old slot-marker and well-shadow review finding awaits
  a future human decision. Dark-shell sidebar search measures fill contrast 1.07
  and boundary 4.67; report only, not recolored.
- Physical project: `/Users/w6x/Developer/genui`, MIT, public `atonota/genui`,
  `main` initialized; the first push is PENDING and is not claimed.
- Color roles: [definitions.json](src/theme-builder/definitions.json) is the
  single color source for shell `#e6e2d7` / `#191302`, the entire main panel
  `#ffffff` / `#2c2c2c` and neutral grey fields `#ececec` / `#1b1b1b`, darker
  than their panel. [theme.ts](src/theme.ts) exposes isolated `--shell-bg`,
  `--panel-bg` and `--field-bg` aliases. Functional boundaries keep 3:1 and text
  4.5:1; the quiet field well reference stays. The sidebar search on the dark
  shell ([nav.css](src/components/shell/nav.css)) is ambiguous: the root
  conductor measures and reports it, and it is not recolored here.
- Shell: one new DocsShell owns shell styles, navigation and layout. Form
  fieldset/legend grouping and Card rules (UX-19, UX-48) are unchanged.
- Input slots: the control height is the total border-box height of 48/56/64 px.
  Control border, slot inset and slot size derive from
  [AtlasButton](src/react/AtlasButton.tsx) and
  [size profiles](src/react/AtlasSizeProfile.tsx) through the nested
  content-box formula; the input and its slot share the exact general radius
  (the former concentric radius subtraction is superseded). Standalone Buttons
  are unchanged.
- Overlay: Tooltip is included while actually visible after hover or keyboard
  focus, with its delay preserved; popup and trigger stay sharp. Drawer and Modal
  blur the whole background including the trigger; Toast and Notification stay
  excluded. Closing retains clip, stacking and trigger cut-out until the fade
  ends; the controller is safe to import during SSR and uses a single body
  pseudo-element. [overlay-tokens.ts](src/data/overlay-tokens.ts) keeps the six
  overlay roles, motion aliases and 51-token recipe compatibility. Tooltip gains
  one row in [drawer-feedback.spec.ts](browser/drawer-feedback.spec.ts); no new
  scenario or spec file.
- Focus (FOCUS01): ringless, type-specific focus through `--focus-bg`,
  `--focus-indicator-color` and `--focus-indicator-width` plus two field focus
  roles. Fields show one bottom marker only with keyboard modality and
  `:focus-visible`; list rows use a 3 px start edge replacing the 2 px active
  marker; Buttons fill, links underline, choices fill or scale. Visible focus
  starts off; only Tab/Shift+Tab turns it on, while arrows, Escape, Enter/Space
  and typing never do. While on, arrow keys move focus inside composite widgets
  following the APG and keep the mode, Enter/Space keep their native action, and
  programmatic or dialog focus return keeps the indicator. Pointer down or touch
  start only hides the indicator and never blurs. One central modality state and
  `:focus-visible` drive every indicator, without a storage key or new setting.
  Forced-colors mode alone may draw `outline: 2px solid CanvasText`, and only with
  that keyboard mode and `:focus-visible`. The human directly authorized this
  exception; the four global instruction files were updated through
  breadcrumb-alignment-core-02.
- Theme paint: switching light and dark is an atomic palette commit, not
  component state motion. Static per-mode background, border and shadow paint
  exists before the first SSR frame, without inline wrong-mode paint or an
  appearing hydration transition. Normal states keep positive Cubic motion;
  reduced motion is instant. See the motion sections of
  [Design tokens](src/pages/tokens.astro) and
  [UX standards](src/pages/standards.astro).
- Lint: a local Stylelint plugin pinned to 17.16 (`atlas/focus-no-surround`) is
  implemented and runs in `docs:lint`; docs lint passed. It checks authored
  stylesheets, not rendered runtime focus.

### UX standards page and project overrides (2026-10-15)

Normative rules now live on the [UX standards page](src/pages/standards.astro)
in nine sections: `surfaces`, `typography`, `size-radius`, `interaction-states`,
`focus`, `layers`, `motion`, `layout` and `accessibility`. Values stay on
[Design tokens](src/pages/tokens.astro), generated from
[definitions.json](src/theme-builder/definitions.json); the standards page reads
the values it names from those definitions and links to the token tables instead
of copying the catalog. Legacy Token standards anchors `measurement-scales`,
`surface-states`, `motion-focus`, `layers` and `overlay-standard` resolve inside
the matching standards sections;
[p1-d-standards.json](migrations/p1-d-standards.json) records the moved prose.
Historical records above that name Token standards remain history.

- Typography (latest direct human decision for this project): minimum 12 CSS px,
  standard 14 px, reading 16 px, weight at least 300. It replaces the 14 px
  minimum in current GenUI rules only; global instruction files are not changed.
- Radius: one shared general radius, default 5 px, for all size families; an
  input and its slot use exactly the same radius when edited. This supersedes
  the concentric radius subtraction; the nested content-box size formula stays.
- Sizes: standard controls and Avatar 48/56/64 px; compact selection, Pill,
  Slider, list and Cascader rows 32/40/48 px; descriptions grow.
- Focus, overlay, motion and shell role colors are unchanged. This entry is not
  evidence of passing checks, rendering or human visual approval.
