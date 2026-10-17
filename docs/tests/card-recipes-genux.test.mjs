import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import test from 'node:test';
import { build } from 'esbuild';
import { mountPattern } from './harness.mjs';

const production = await build({
  stdin: {
    contents: `export { CARD_RECIPES } from './docs/src/data/card-recipes'; export { validateCardModel } from './docs/src/genux/policy'; export { createGenUXRuntime } from './docs/src/genux/runtime'; export { GENUX_CARD_CATALOG_ID } from './docs/src/genux/contracts';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { CARD_RECIPES, validateCardModel, createGenUXRuntime, GENUX_CARD_CATALOG_ID } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(production.outputFiles[0].contents).toString('base64')
);
const componentFor = kind =>
  kind === 'entity'
    ? 'GenUXEntityCard'
    : kind === 'metric'
      ? 'GenUXMetricCard'
      : 'GenUXPurposeCard';
const commandsFor = recipe => [
  {
    version: 'v0.9',
    createSurface: { surfaceId: `recipe-${recipe.id}`, catalogId: GENUX_CARD_CATALOG_ID },
  },
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: `recipe-${recipe.id}`,
      components: [
        { id: 'root', component: componentFor(recipe.model.kind), model: { path: '/state/card' } },
      ],
    },
  },
  {
    version: 'v0.9',
    updateDataModel: { surfaceId: `recipe-${recipe.id}`, path: '/state/card', value: recipe.model },
  },
];

test('all 37 gallery recipes satisfy the actual production Card policy without normalizing away data', () => {
  assert.equal(CARD_RECIPES.length, 37);
  const failures = [];
  for (const recipe of CARD_RECIPES) {
    try {
      assert.deepEqual(validateCardModel(recipe.model), recipe.model);
    } catch (error) {
      failures.push(`${recipe.id}: ${error.message}`);
    }
  }
  assert.deepEqual(failures, [], 'every documented recipe must enter the same production gate');
});

test('all 37 recipes commit through real A2UI data bindings and the appropriate registry component', () => {
  const failures = [];
  const renderers = new Set();
  for (const recipe of CARD_RECIPES) {
    const runtime = createGenUXRuntime({ scopeId: `Recipe-${recipe.id}` });
    const requestId = `Request-${recipe.id}`;
    runtime.beginRequest(requestId);
    const accepted = runtime.applyBatch({ requestId, sequence: 1, commands: commandsFor(recipe) });
    if (!accepted.ok) {
      failures.push(`${recipe.id}: ${accepted.error}`);
      continue;
    }
    runtime.finishRequest(requestId, 'success');
    const snapshot = runtime.getSnapshot();
    assert.equal(snapshot.status, 'success', recipe.id);
    assert.equal(snapshot.surfaces.length, 1, recipe.id);
    assert.deepEqual(snapshot.surfaces[0].models.root, recipe.model, recipe.id);
    assert.equal(snapshot.surfaces[0].components[0].component, componentFor(recipe.model.kind));
    renderers.add(componentFor(recipe.model.kind));
  }
  assert.deepEqual(failures, [], 'no gallery-only recipe may bypass production runtime validation');
  assert.deepEqual(renderers, new Set(['GenUXEntityCard', 'GenUXMetricCard', 'GenUXPurposeCard']));
});

test('every recipe renders and dispatches its primary action through the actual native XCard registry bridge', async t => {
  const fixture = `.card-recipes-genux-${randomUUID()}.tsx`;
  const path = new URL(fixture, import.meta.url);
  await writeFile(
    path,
    `
    import {useState} from 'react';
    import GenUXProvider from '../src/react/GenUXProvider';
    import GenUXSurface from '../src/react/genux/GenUXSurface';
    import {CARD_RECIPES} from '../src/data/card-recipes';
    import {createGenUXRuntime} from '../src/genux/runtime';
    import {GENUX_CARD_CATALOG_ID} from '../src/genux/contracts';
    export default function Recipes() {
      const [executions,setExecutions]=useState([]);
      const [runtimes]=useState(()=>CARD_RECIPES.map(recipe=>{
        const runtime=createGenUXRuntime({scopeId:'Recipe-'+recipe.id,onAction:(action,model)=>setExecutions(current=>[...current,{recipe:recipe.id,actionId:action.actionId,modelId:model.id}])});
        const requestId='Request-'+recipe.id, surfaceId='recipe-'+recipe.id;
        runtime.beginRequest(requestId);
        const component=recipe.model.kind==='entity'?'GenUXEntityCard':recipe.model.kind==='metric'?'GenUXMetricCard':'GenUXPurposeCard';
        const result=runtime.applyBatch({requestId,sequence:1,commands:[
          {version:'v0.9',createSurface:{surfaceId,catalogId:GENUX_CARD_CATALOG_ID}},
          {version:'v0.9',updateComponents:{surfaceId,components:[{id:'root',component,model:{path:'/state/card'}}]}},
          {version:'v0.9',updateDataModel:{surfaceId,path:'/state/card',value:recipe.model}},
        ]});
        if(!result.ok) throw new Error(recipe.id+': '+result.error);
        runtime.finishRequest(requestId,'success');
        return {id:recipe.id,runtime};
      }));
      return <GenUXProvider appearance="docs">{runtimes.map(owner=><GenUXSurface key={owner.id} runtime={owner.runtime}/>)}<output data-recipe-executions>{JSON.stringify(executions)}</output></GenUXProvider>;
    }
  `,
  );
  t.after(() => unlink(path));
  const h = await mountPattern('default', 'docs/tests/' + fixture);
  t.after(() => h.dispose());
  await h.waitFor(
    () => h.document.querySelectorAll('[data-genux-card]').length === CARD_RECIPES.length,
    'all native recipe surfaces render',
    5000,
  );
  for (const recipe of CARD_RECIPES) {
    const scope = h.document.querySelector(`[data-genux-scope="Recipe-${recipe.id}"]`);
    const card = scope.querySelector('[data-genux-card]');
    assert.equal(card.dataset.cardKind, recipe.model.kind, recipe.id);
    assert.equal(card.dataset.cardId, recipe.model.id, recipe.id);
    assert.equal(scope.querySelectorAll('.ant-card').length, 1, recipe.id);
    assert.ok(card.classList.contains('ant-card'), recipe.id);
    assert.ok(card.querySelector('[data-card-source]'), recipe.id);
    const primary = card.querySelector('[data-card-primary]');
    assert.equal(primary.disabled, false, recipe.id);
    await h.click(primary);
  }
  const executions = JSON.parse(h.document.querySelector('[data-recipe-executions]').textContent);
  assert.deepEqual(
    executions,
    CARD_RECIPES.map(recipe => ({
      recipe: recipe.id,
      actionId: recipe.model.primaryAction.id,
      modelId: recipe.model.id,
    })),
  );
  assert.equal(h.document.querySelectorAll('.ant-card .ant-card').length, 0);
});
