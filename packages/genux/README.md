# genux

Local consumable package for the GenUX Ant Design base UI library. It is built from the
canonical sources in `docs/src` of this repository; no component logic is copied here.

This package is for local consumers only. It is **not** an npm publication (`private: true` only
blocks `npm publish`), and building it is **not** proof of remote SSR or production hosting. There
is no live Frappe or AI authentication.

## Entries

| Entry                                                             | Contents                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `genux`                                                           | Base controls (Input, InputNumber, Button, ButtonGroup, Badge, Listy, Cascader, Selection, Avatar, MediaFrame, Feedback, Dropdown, Steps, Chart, Splitter, ...), `GenUXProvider` and the React adaptive bindings. Never imports GenUX or Ant Design X. |
| `genux/adaptive`                                                  | Pure, SSR-safe adaptive core (policy, environment store, server and delivery helpers). No React, AI or Frappe.                                                                                                                                         |
| `genux/genux`                                                     | Optional GenUX runtime (`createGenUXRuntime` and the other runtime exports), the `GenUXSurface` React surface, `genuxComponentNames`, and the contract names and types such as `GENUX_COMPONENT_NAMES`. Requires the optional `@ant-design/x*` peers.  |
| `genux/frappe`                                                    | The canonical `createFrappeQuerySource` adapter and its `QuerySource` type. It validates query intents and the returned `message` envelope; the consumer supplies the `call` transport.                                                                |
| `genux/input/spatial`, `genux/input/pointer`, `genux/input/webos` | Explicit input layers built directly from `docs/src/adaptive`, loaded only when needed.                                                                                                                                                                |
| `genux/styles.css` (alias `genux/styles`)                         | The only supported stylesheet: the canonical static sheets, then the component CSS that the JavaScript entries import, with the Outfit font files and their license.                                                                                   |

## Build and pack

From the repository root, with the pinned toolchain already installed:

```sh
node tools/build-library.mjs
cd packages/genux && npm pack
```

`tools/build-library.mjs` writes only `packages/genux/dist` and `packages/genux/LICENSE` and records
the emitted entries, chunks, externals and assets in `dist/consumer.json`. It fails when an
`exports` entry or the `files` list disagrees with the emitted output, or when the bundle imports an
undeclared package. esbuild also emits a CSS bundle for each JavaScript entry (for example
`dist/index.css`); these are not exports. The build appends every bundle rule missing from the
static sheets to `dist/styles.css`, rebasing asset URLs, and fails unless the written `styles.css`
keeps the static sheets unchanged and contains every bundle rule. `consumer.json` lists each bundle
under `bundleStyles` with its rule and appended counts. `npm pack` writes `genux-0.1.0.tgz`; a local consumer installs it with
`npm install <path>/genux-0.1.0.tgz`.

Required peers: `react`, `react-dom`, `antd`, `dayjs`, `@ant-design/cssinjs`, `@ant-design/colors`
and `@rc-component/mini-decimal`. The `@ant-design/x*` peers are only needed for `genux/genux`.

## Usage

```tsx
import 'genux/styles.css';
import { GenUXProvider, GenUXButton } from 'genux';

export function App() {
  return (
    <GenUXProvider>
      <GenUXButton text="Save" />
    </GenUXProvider>
  );
}
```

Controls rely on `GenUXProvider` for the approved theme. Docs appearance settings are opt-in.

## SSR caveats

- Importing `genux/styles.css` needs a bundler that handles CSS imports; plain Node cannot import
  `.css`.
- Profile CSS imported with `?inline` stays a string inside its JavaScript chunk (see
  `eagerInlineStyles` and `inlineStyles` in `dist/consumer.json`) and is not part of `styles.css`.
- `genux/adaptive` is SSR-safe. Load the input layers on the client, through a dynamic `import()`,
  only when the matching input is present.
- Ant Design CSS-in-JS styles need the consumer's own SSR style extraction (`@ant-design/cssinjs`)
  to avoid unstyled first paint.
- Only the local build is checked; remote SSR and production hosting are not covered.

## Design rules

- Outfit is the default font, readable text is at least 14 CSS px, and the root font size stays
  under user control.
- Motion uses the central tokens (easeInOut Cubic by default) with the reduced-motion exception.
- Keyboard focus stays visible without surrounding focus rings.

These values come from the project's current decision record. Consumers can adjust themes and
tokens within these rules; the library build rejects shipped text below 14 CSS px, but it cannot
check a consumer's own styles.

## License

MIT, same as the repository (`LICENSE`). The bundled Outfit fonts are licensed under the SIL Open
Font License 1.1; see `dist/LICENSE.fonts`.
