import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { render, root } from './build.mjs';
import { setup } from '../tests/harness.mjs';

// Generate fixtures from the production recipe adapter, never from a second mapping.
export async function writeAntdFixtures() {
  const h = setup((await render()).html);
  try {
    const recipes =
      h.read(`AXES.flatMap(axis => axis.options.flatMap(([value]) => STATES.map(([state]) => {
      const recipe = buildAntdRecipe({...BASE,[axis.key]:value},state);
      return {configProvider:recipe.configProvider,button:{props:recipe.button.props,styles:recipe.button.styles}};
    })))`);
    const unique = [...new Set(recipes.map(value => JSON.stringify(value)))];
    const text =
      'import type { AntdButtonRecipe } from "../../src/compat/antd-contract";\n' +
      '// Generated from the actual standalone adapter; do not hand-maintain fixtures.\n' +
      'export const recipes = [\n' +
      unique.join(',\n') +
      '\n] satisfies AntdButtonRecipe[];\n';
    await writeFile(resolve(root, 'tests/fixtures/antd-recipes.generated.ts'), text);
    return { cases: recipes.length, distinct: unique.length };
  } finally {
    h.close();
  }
}
