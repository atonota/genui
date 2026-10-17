# GenUX

GenUX is a local Flat 2.0 component library with a standalone HTML studio, Astro documentation
and Storybook. English is the default language and canonical message source;
Turkish is the secondary locale. Existing component decisions, stable values,
identifiers, fonts and vendor provenance are preserved.

## Run and verify

The canonical local checkout is `/Users/w6x/Developer/genux`; new scripts should
use the `genux` path. The local move is complete: `/Users/w6x/Developer/genui` is
only a temporary compatibility symlink to the same checkout, not a duplicate, so
existing local services and workflows keep running. Agent orchestration
(workflow workers, run evidence and reports) lives in a separate local project
and is not part of this repository.

Use the pinned dependencies and a supported Node version (`^24.15.0 || >=26.0.0`).
The current environment uses Node 24.21.0.

```sh
npm ci
npm run verify
npm run docs:verify
npm run storybook:verify
npm run build
```

`npm ci` runs the project-scoped `postinstall` patch for four declaration files
in two pinned dependencies. An installation without lifecycle scripts requires:

```sh
npm ci --ignore-scripts
npm run deps:patch
npm run verify
```

`verify` checks formatting, lint, JavaScript/CSS compilation and preservation,
strict TypeScript/AntD contracts, dropdown provenance and Node/JSDOM regressions.
`docs:verify` also checks snippets, semantic DOM interactions, production output,
asset boundaries and browser test type/discovery contracts. Test discovery is not
browser execution. `storybook:verify` checks types, a static build and story index.

`build` writes `dist/buton-genuxi.html` without changing the user's copy. `sync`
updates the existing Downloads file using the machine-specific target and known
hash in ignored `evidence/sync-state.json`. It refuses external changes, uses an
exclusive lock and unique staging files, and can recover a replacement whose final
state write was interrupted. Before removing an abandoned lock, verify its PID is
no longer running. The target hash is checked again before replacement; this does
not claim perfect filesystem compare-and-swap with unrelated editors.

## Source layout

| Source                       | Responsibility                                                              |
| ---------------------------- | --------------------------------------------------------------------------- |
| `src/model/`                 | Decisions, experiments, axes, palettes, icons and historical archive        |
| `src/shared/`                | Normalization, color/contrast and preview measurement helpers               |
| `src/button/`                | Button DOM, states and icons                                                |
| `src/compat/`                | AntD recipes and public type contracts                                      |
| `src/genux/`                 | Navigation, catalog, studio, saved items, math and export flows             |
| `src/forms/`                 | Form demo model, rendering and interactions                                 |
| `src/workspace/`             | Experimental local listing/details/form examples, separate preview profiles |
| `src/i18n/`                  | Offline locale runtime and Turkish messages                                 |
| `src/styles/`, `src/assets/` | Ordered CSS, tokens and licensed Outfit fonts                               |
| `src/vendor/`                | Pinned headless dropdown source, bundle and licenses                        |
| `docs/src/`                  | Astro pages, shared React components, tokens and lazy locale store          |
| `storybook/`, `.storybook/`  | CSF stories and shared preview configuration                                |

`build-order.json` combines legacy sources into one classic script and stylesheet.
Those files share a lexical scope; they are not independent ES modules. Model data
feeds rendering and export, controllers own state, and shared/model functions own
pure calculations. No extra framework or architecture layer is required.

Approved decisions are the source for axes, rendering and AntD recipes. Fonts and
vendor bytes are hash-protected. Behavioral tests check values, selections, focus,
ARIA, hidden state, classes and tokens; they do not measure pixels. Dropdown checks
rebuild the adapter in memory, verify the pinned package/license/lock records and
compare the preserved bundle without changing it or downloading packages.

## Experimental data workspace examples

Open **Form components → Data workspace examples** in the standalone HTML.
Choose **Mobile example** or **Desktop example** explicitly. Both share fictional
orders and a persistent form draft, while mobile uses group → list → detail
navigation and desktop exposes separate panes with a contained table. Single-page
and multistep form modes share validation and keep entered values.

These are local examples awaiting approval. They do not save server records or
implement the full attached ERP specifications. The workspace section and its
styles are isolated from the existing catalog; historical fixture bytes remain
unchanged and existing journeys still pass preservation checks. The offline file
embeds the small shared additions, builds their DOM lazily, and does not claim
profile-specific network delivery. The new examples are not added to Storybook or
approved component decisions. Promote them only after an explicit user decision.

## GenUX controlled record workspace

The Astro documentation adds `/color-system/` for the supplied HWB color model,
official Ant Design palette derivation and local import/export. It uses the GenUX
visual identity without changing approved palettes or Storybook.

Documentation uses the exact `#0080CC` brand through the explicit
`GenUXProvider appearance="docs"` contract. Its readable foreground, link and
state roles are centralized in `docs/src/data/docs-brand.ts`; unopted shared
providers and explicit component palette choices retain their existing identity.

`/components/record-workspace/` connects reusable controlled collection, form and
single-record display components. Order and equipment schemas share field meaning,
validation and filtering. Local drafts require explicit commits. The page also
demonstrates cell/row grid drafts, overlapping groups, related identities,
repeating rows, prepared changes, review queues and supplied evidence.

These remain experimental web components. The original gap audit and reference
reviews are retained; a dated application register separates implementation from
unexecuted browser/device/visual acceptance. Use `npm run docs:verify` for source,
DOM, production, strict snippet and browser-contract discovery checks.

## Localization

English phrases are canonical translation keys. Documentation uses leaf
`data-i18n` markers and attribute markers; React uses `useI18n().t()`. Custom Turkish
messages are separate JSON data loaded only when requested. AntD locale modules
are included in the shared component runtime. The standalone genux
embeds its Turkish dictionary so it works offline. `genux-locale` stores an explicit
choice; a fresh visit defaults to English. AntD receives the selected locale.

Translate visible text and accessibility labels, never option values, IDs, routes,
exported API identifiers or user-authored text. Locale changes update mounted
controls without clearing drafts, selections or focus. Search normalizes both
translated labels and stable English identifiers. Use locale-aware number/date
formatters and named interpolation parameters instead of assembling translated
sentences from fragments. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Ant Design boundary

AntD 6.6.6, React 19.2.0 and TypeScript 5.9.3 are pinned. The standalone HTML does
not load the AntD or React runtime; Astro and Storybook do. Public button and eleven
form component prop contracts are checked with strict types. Contract checks do
not prove visual parity with the standalone preview.

Two upstream declaration patches remain version- and hash-bound:
`@rc-component/image@1.10.0` redefines the group's `imageRender` callback with
`Omit<InternalPreviewConfig, 'imageRender'>`; `@rc-component/picker@1.12.2` redefines
the nullable panel `defaultValue` through `Omit<BasePickerPanelProps, 'defaultValue'>`.
`patches/antd-declarations.json` records exact before/after content and hashes.
The patch tool refuses unexpected files, changes no JavaScript and preserves
`strict: true` and `skipLibCheck: false`. Review patches when upgrading dependencies.

## Evidence limits

Browser access was denied by policy in this task. Chromium, Firefox, WebKit,
physical devices, screenshots/diffs, computed mobile layout and CI are `not_run`.
The policy was not bypassed with a server, URL, CDP connection or renderer. See the
local, untracked reports and evidence for the actual commands and DOM/source
observations.

Some historical studio/background settings still use native selects; form demos
use the preserved Zag headless dropdown. Those native settings remain a known
older styling gap.

## GitHub Pages publication

The documentation is configured for publication at https://atonota.github.io/genux/.
Local development and plain `npm run docs:build` keep the root base and write `docs/dist`.
The Pages artifact uses the same pinned build command with one environment flag:

```sh
GENUX_DOCS_PAGES=1 npm run docs:build
```

The flag sets the Astro site and `/genux` base and writes a fresh `docs/pages/dist`; it
never copies `docs/dist` or local review material. The existing presentation gate checks
canonical root paths first. `tools/docs-pages.mjs` then prefixes authored root-absolute
HTML, island, refresh, inline script, JavaScript chunk and CSS URLs exactly once, adds
`.nojekyll`, and fails on private files or missing linked assets. Already based `/genux`
and `/genux/` name the Pages homepage and stay unchanged, so GenUX product links use
`genuxPageHref(import.meta.env.BASE_URL)`: `/genux/` locally and `/genux/genux/` on Pages.
`/` strings in JavaScript or island props change only in explicit URL positions; other uses
stay unchanged.

`.github/workflows/pages.yml` runs only on pushes to `main` and manual dispatch with Node
24.21.0, `npm ci`, the flagged `docs:build` and commit-pinned official Pages actions. It
also retains the FAB, motion and interaction `node --test` gates and calls the reusable
adaptive workflow. Publication is pending until a deployment receipt
exists; this README claims no workflow run, deployment or Pages setting.

## License

GenUX is released under the MIT License; see [LICENSE](LICENSE). Embedded Outfit
OFL and third-party MIT license texts remain intact under their own terms. The
public source repository is https://github.com/atonota/genux. This README makes
no claim about pushed commits, CI runs or published releases.
