import { resolve, sep } from 'node:path';

const sharedStyles = resolve(import.meta.dirname, '../docs/src/styles') + sep;
const pixels = value =>
  value
    .replace(/(-?\d*\.?\d+)rem\b/g, (_, amount) => `${Number(amount) * 16}px`)
    .replace(/max\((\d+(?:\.\d+)?px),\s*\1\)/g, '$1');

/** Astro-only projection of legacy shared styles. Storybook keeps the source units. */
export default function docsPixelStyles() {
  const owns = node => node.source?.input.file?.startsWith(sharedStyles);
  return {
    postcssPlugin: 'genux-docs-native-pixels',
    Declaration(node) {
      if (owns(node)) node.value = pixels(node.value);
    },
    AtRule(node) {
      if (owns(node) && ['media', 'container'].includes(node.name))
        node.params = pixels(node.params);
    },
  };
}
