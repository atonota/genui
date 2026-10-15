import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCache, extractStyle, StyleProvider } from '@ant-design/cssinjs';
import postcss from 'postcss';
import { AtlasSsrTheme } from '../react/AtlasProvider';
import type { ThemeMode } from '../theme';

type DocumentationDemoProps = { documentation?: boolean };
function collectStyles(
  Demo: ComponentType<DocumentationDemoProps>,
  mode: ThemeMode,
  documentation: boolean,
) {
  const cache = createCache();
  renderToStaticMarkup(
    createElement(
      StyleProvider,
      { cache },
      createElement(
        AtlasSsrTheme.Provider,
        { value: mode },
        createElement(Demo, { documentation }),
      ),
    ),
  );
  return cache;
}

function scopeVariables(
  cache: ReturnType<typeof createCache>,
  mode: ThemeMode,
  dynamicVariableKeys: readonly string[],
): string {
  const css = postcss.parse(extractStyle(cache, { types: ['token', 'cssVar'], plain: true }));
  css.each(rule => {
    if (rule.type !== 'rule') throw new Error('Unexpected Ant Design variable CSS node');
    // extractStyle appends this even for variable-only extraction. Keep only the canonical map.
    if (rule.selector === '.data-ant-cssinjs-cache-path') {
      rule.remove();
      return;
    }
    if (rule.nodes.some(node => node.type !== 'decl' || !node.prop.startsWith('--')))
      throw new Error(`Unexpected Ant Design variable rule: ${rule.selector}`);
    const selectors = rule.selectors.filter(
      selector =>
        !dynamicVariableKeys.some(key => new RegExp(`\\.${key}(?![\\w-])`).test(selector)),
    );
    if (!selectors.length) {
      rule.remove();
      return;
    }
    rule.selectors = selectors.map(selector => `:root[data-theme='${mode}'] ${selector}`);
  });
  return css.toString();
}

// Build-only, per-page caches. Unmodified CSSinJS styles retain their hydration ownership.
// Separate, higher-specificity scheme variables cannot be replaced by transient client tokens.
export function extractDemoStyles(
  Demo: ComponentType<DocumentationDemoProps>,
  {
    dynamicVariableKeys = [],
    documentation = false,
  }: { dynamicVariableKeys?: readonly string[]; documentation?: boolean } = {},
): string {
  if (dynamicVariableKeys.some(key => !/^css-var-[\w-]+$/.test(key)))
    throw new Error('Dynamic theme keys must be CSS variable class names');
  const light = collectStyles(Demo, 'light', documentation);
  const dark = collectStyles(Demo, 'dark', documentation);
  return (
    extractStyle(light) +
    `<style data-atlas-theme-tokens>${scopeVariables(light, 'light', dynamicVariableKeys)}${scopeVariables(dark, 'dark', dynamicVariableKeys)}</style>`
  );
}
