# genui

Local consumable package for the Atlas Ant Design base UI library. It is built from the
canonical sources in `docs/src` of this repository; no component logic is copied here.

This package is for local consumers only. It is **not** an npm publication (`private: true` only
blocks `npm publish`), and building it is **not** proof of remote SSR or production hosting. There
is no live Frappe or AI authentication.

## Entries

| Entry                                                             | Contents                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `genui`                                                           | Base controls (Input, InputNumber, Button, ButtonGroup, Badge, Listy, Cascader, Selection, Avatar, MediaFrame, Feedback, Dropdown, Steps, Chart, Splitter, ...), `AtlasProvider` and the React adaptive bindings. Never imports GenUI or Ant Design X.          |
| `genui/adaptive`                                                  | Pure, SSR-safe adaptive core (policy, environment store, server and delivery helpers). No React, AI or Frappe.                                                                                                                                                  |
| `genui/genui`                                                     | Optional GenUI runtime (`createGenUIRuntime` and the other runtime exports), the `AtlasGenUISurface` React surface, `atlasGenUIComponentNames`, and the contract names and types such as `GENUI_COMPONENT_NAMES`. Requires the optional `@ant-design/x*` peers. |
| `genui/frappe`                                                    | The canonical `createFrappeQuerySource` adapter and its `QuerySource` type. It validates query intents and the returned `message` envelope; the consumer supplies the `call` transport.                                                                         |
| `genui/input/spatial`, `genui/input/pointer`, `genui/input/webos` | Explicit input layers built directly from `docs/src/adaptive`, loaded only when needed.                                                                                                                                                                         |
| `genui/styles.css` (alias `genui/styles`)                         | The only supported stylesheet: the canonical static sheets, then the component CSS that the JavaScript entries import, with the Outfit font files and their license.                                                                                            |

## Build and pack

From the repository root, with the pinned toolchain already installed:

```sh
node tools/build-library.mjs
cd packages/genui && npm pack
```

`tools/build-library.mjs` writes only `packages/genui/dist` and `packages/genui/LICENSE` and records
the emitted entries, chunks, externals and assets in `dist/consumer.json`. It fails when an
`exports` entry or the `files` list disagrees with the emitted output, or when the bundle imports an
undeclared package. esbuild also emits a CSS bundle for each JavaScript entry (for example
`dist/index.css`); these are not exports. The build appends every bundle rule missing from the
static sheets to `dist/styles.css`, rebasing asset URLs, and fails unless the written `styles.css`
keeps the static sheets unchanged and contains every bundle rule. `consumer.json` lists each bundle
under `bundleStyles` with its rule and appended counts. `npm pack` writes `genui-0.1.0.tgz`; a local consumer installs it with
`npm install <path>/genui-0.1.0.tgz`.

Required peers: `react`, `react-dom`, `antd`, `dayjs`, `@ant-design/cssinjs`, `@ant-design/colors`
and `@rc-component/mini-decimal`. The `@ant-design/x*` peers are only needed for `genui/genui`.

## Usage

```tsx
import 'genui/styles.css';
import { AtlasProvider, AtlasButton } from 'genui';

export function App() {
  return (
    <AtlasProvider>
      <AtlasButton text="Save" />
    </AtlasProvider>
  );
}
```

Controls rely on `AtlasProvider` for the approved theme. Docs appearance settings are opt-in.

## SSR caveats

- Importing `genui/styles.css` needs a bundler that handles CSS imports; plain Node cannot import
  `.css`.
- Profile CSS imported with `?inline` stays a string inside its JavaScript chunk (see
  `eagerInlineStyles` and `inlineStyles` in `dist/consumer.json`) and is not part of `styles.css`.
- `genui/adaptive` is SSR-safe. Load the input layers on the client, through a dynamic `import()`,
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
