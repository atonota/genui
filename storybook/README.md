# Atlas Components Storybook

Storybook 10.2.19 uses the shared React demos: Button, Input, Select, Checkbox,
Radio, Switch, Accordion, Form and Drawer. Astro documentation and Storybook
share demo code, `AtlasProvider`, tokens, Outfit fonts and stylesheets.

## Run and verify

Run from the project root:

```sh
npm run storybook
npm run storybook:check
npm run storybook:build
npm run storybook:verify
```

The development server listens on `127.0.0.1:6007`. Do not stop an existing service
if the port is occupied. Static output goes to `storybook-static/`; a build does
not deploy or publish it. The verification gate checks formatting, strict
TypeScript, static output and the story index. It does not prove browser behavior
or visual equivalence.

## Story contract

English is the default for story names, demo text, controls and documentation.
The preview offers English and Turkish, shares the documentation locale store and
loads Turkish messages on request. Display labels use `useI18n().t()`; stable CSF
exports, routes, option values and keys are never translated. Switching language
must preserve drafts, selected values and mounted controls. AntD receives `enUS`
by default and `trTR` for Turkish.

`Components/Button` and other English CSF titles keep story URLs stable. Button
exports `Playground`, approved states, dimensions and visual decision stories.
Other components export `Variants`. Variants use the existing demo controls;
props-free demos must not gain a second independent Controls state.

Demos already include `AtlasProvider`; do not add a duplicate provider decorator.
Preview CSS follows the documentation order: `docs.css`, `atlas-shadows.css`,
`components.css`, then preview chrome styles and `web.css`. Only Input and Select
opt into `atlasSharedPreview: true`, which places their content inside the same
`.live-preview` scope as the documentation. Input sets `numberMode: 'spinner'` to
use the shared NumberStepper; Select sets `pillTags: true` to use AtlasPill.
The demo APIs and native fallbacks stay available. Other stories remain outside
this scope; Checkbox, Radio and Switch web experiments are not promoted by this
alignment. AntD generates its client styles; the Astro SSR extraction code is not
used in Storybook.

Some demos use stable IDs. Do not mount multiple copies of the same demo on one
page or add automatic inline Docs copies. There is no `autodocs` tag. Use the
canonical demo and generated `docs:data` model instead of duplicating examples or
decision lists.

Approved states are Default, Hover, Pressed, Disabled, Processing, Saving, Syncing
and Queued. Approved visual stories preserve the user's recorded fill, color,
tone, radius, shadow and transition choices. `AtlasButton` is the common AntD
renderer. Busy states prevent repeated submission and show an indeterminate line;
the line does not represent a real request or measured progress.

## Verification boundaries

When a browser smoke check is requested, limit it to initial load, a representative
basic interaction, obvious overflow and visible keyboard focus: one desktop and
320 CSS px viewport, at most five minutes per browser and twenty minutes total.
Do not add a variant matrix, pixel baselines or browser installations. Record the
actual browser/version; do not substitute engines or bypass an access policy with
another renderer or URL. Source, DOM and build checks are separate evidence.

Storybook 10.2.19 is pinned with TypeScript 5.9.3 and `skipLibCheck: false`.
Storybook uses Vite 7.3.7; Astro resolves Vite 8.3.4 separately. The existing
esbuild 0.28.2 override is shared by build tools and must be verified when upgraded.
