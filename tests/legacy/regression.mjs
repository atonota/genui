import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import test from 'node:test';
import ts from 'typescript';

const file = new URL('../../dist/buton-atlasi.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const beforeHtml = readFileSync(new URL('./before-refined-shadows.html', import.meta.url), 'utf8');
const beforeModel = name => JSON.parse(beforeHtml.split('const '+name+' = ')[1].split(name==='COMPONENT_DECISIONS'?';\nconst BUTTON_DECISIONS':';\nconst PRESETS')[0]);
const translations = JSON.parse(readFileSync(new URL('../../src/i18n/tr.json', import.meta.url), 'utf8'));
const toEnglish = Object.fromEntries(Object.entries(translations).map(([en, tr]) => [tr, en]));
const englishData = value => Array.isArray(value) ? value.map(englishData) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, englishData(item)])) : typeof value === 'string' ? toEnglish[value] || value : value;
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const css = html.match(/<style(?: [^>]*)?>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g,'');
new vm.Script(script);
// Retain all legacy assertions; use syntax boundaries rather than minified whitespace.
const parsed = ts.createSourceFile('atlas.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const currentStart = parsed.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(parsed) === 'current')).getStart(parsed);
const bootstrapStart = parsed.statements.find(node => ts.isExpressionStatement(node) && node.getText(parsed).startsWith("document.querySelectorAll('.tab').forEach")).getStart(parsed);
const sourceFunction = name => parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(parsed);
const randomizeSource = parsed.statements.find(node => ts.isExpressionStatement(node) && node.getText(parsed).startsWith("$('randomize').onclick")).getText(parsed);

class TestNode {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.style={values:{},setProperty(key,value){this.values[key]=value;}};this.attributes={};this.value='Continue';}
  set id(value){this._id=value;roots.set(value,this);}
  get id(){return this._id;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(key,value){this.attributes[key]=value;if(key==='class')this.className=value;}
  getAttribute(key){return this.attributes[key]??null;}
  removeAttribute(key){delete this.attributes[key];}
  querySelectorAll(selector){const name=selector.slice(1),out=[];for(const c of this.children){if((c.className||"").split(" ").includes(name))out.push(c);if(c.querySelectorAll)out.push(...c.querySelectorAll(selector));}return out;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
const roots=new Map(),timers=new Map();let timerSequence=0;
const stylesheet=new TestNode('style');stylesheet.id='atlas-styles';stylesheet.textContent=css;
const context = vm.createContext({ ATLAS_TR: translations, t: value => value, getLocale: () => 'en', normalizeSearch: value => value, formatNumber: (value, options) => value.toLocaleString('en-US', options), document: {
  getElementById(id){if(!roots.has(id))roots.set(id,new TestNode());return roots.get(id);},
  querySelectorAll(){return [];},
  createElement(tag){return new TestNode(tag);},
  createElementNS(namespace,tag){assert.equal(namespace,'http://www.w3.org/2000/svg');return new TestNode(tag);},
  createTextNode(text){return {textContent:text,children:[]};}
},localStorage:{getItem(){return null;}},setTimeout(fn,ms){const id=++timerSequence;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},requestAnimationFrame(callback){callback();} });
vm.runInContext(script.slice(script.includes('const COMPONENT_DECISIONS')?script.indexOf('const COMPONENT_DECISIONS'):script.indexOf('const AXES'), currentStart) +
  '\nthis.catalog={AXES,PRESETS,BASE,safeConfig,PALETTES,paletteFor:typeof paletteFor==="undefined"?undefined:paletteFor,contrast,solidText,rgb,buttonFor,STATES,ARCHIVED_PRESETS,buildAntdRecipe:typeof buildAntdRecipe==="undefined"?undefined:buildAntdRecipe,COMPONENT_DECISIONS:typeof COMPONENT_DECISIONS==="undefined"?undefined:COMPONENT_DECISIONS};', context);
const { AXES, PRESETS, BASE, safeConfig, PALETTES, contrast, solidText, rgb } = context.catalog;
vm.runInContext(script.slice(currentStart,bootstrapStart)+
  '\nthis.renders={showTab,cancelHeldDemoKeys:typeof cancelHeldDemoKeys==="undefined"?undefined:cancelHeldDemoKeys,cancelOperationDemo:typeof cancelOperationDemo==="undefined"?undefined:cancelOperationDemo,bindOperationDemo:typeof bindOperationDemo==="undefined"?undefined:bindOperationDemo,buildControls,renderStudio,renderHero,renderGallery,stateBar,renderDecisions:typeof renderDecisions==="undefined"?undefined:renderDecisions,renderPrimitives,renderBehavior,renderCompare,updatePreviewReadout,recipeFor(config){current=config;return exportedRecipe();},sampleSelection(){selected=[{id:"sample",name:"sample",config:BASE}];}};',context);

vm.runInContext(sourceFunction('syncAdvanced'),context);

test('catalog, random combinations and legacy recipes allow only flat surfaces', () => {
  const prohibited = new Set(['cut','chamfer','slant','hard2','hard4','hard8','hard12',
    'stack','frame','inset','double','thick','dots','lines','grain','halftone',
    'innerframe','offsetframe','doubleline','toplight','textshadow','lift','grow',
    'depress','nudge','shrink','breath','wobble','spring','slide','flash']);
  for (const axis of AXES) for (const [value] of axis.options)
    assert.ok(!prohibited.has(value), `${axis.key}: ${value}`);
  for (const preset of PRESETS) for (const [key,value] of Object.entries(preset.config))
    assert.ok(!prohibited.has(value), `${preset.name}: ${key}=${value}`);
  const legacy = safeConfig({ shape:'cut', shadow:'hard8', border:'double',
    texture:'dots', detail:'innerframe', hover:'lift', press:'inset', animation:'flash',
    customShadow:{ x:12,y:12,blur:0,spread:4,opacity:100 }, customBorder:8 });
  assert.equal(legacy.shape,'rect');
  assert.equal(legacy.hover,'opacity');
  assert.equal(legacy.press,'flatten');
  assert.equal(legacy.customShadow,undefined);
  assert.equal(legacy.animation,'none');
  for(const easing of ['out','smooth','linear','inout','unknown',undefined]){
    assert.equal(safeConfig({...BASE,easing}).easing,'inout','saved recipes cannot bypass the shared ease-in-out curve');
    assert.equal(context.catalog.buttonFor({...BASE,easing}).dataset.easing,'inout');
  }
  assert.deepEqual(Array.from(AXES.find(a=>a.key==='easing').options,o=>o[0]),['inout']);
  assert.equal(legacy.customBorder,undefined,'freeform border cannot bypass decided variants');
  assert.equal(legacy.border,'hairline');
  for(const border of ['solid','bottom','left'])assert.equal(safeConfig({border}).border,'hairline','removed border recipes normalize to the retained 1px option');
  assert.equal(PRESETS.length,1,'discarded ready-made styles stay out of the visible catalog');
  assert.equal(PRESETS[0].name,'Lower lip');assert.equal(BASE.palette,'coral');assert.equal(BASE.detail,'bottomedge');
  assert.equal(context.catalog.ARCHIVED_PRESETS.length,28,'source data is archived intact');
  assert.equal(AXES.some(a=>a.key==='type'),false,'Typography variants are removed from all model-driven UI');
  for(const type of ['heavy','light','serif','mono','uppercase','italic','condensed','system'])assert.equal(safeConfig({...BASE,type}).type,'system','legacy typography selections normalize to default Outfit');
  assert.doesNotMatch(css,/\.btx\[data-type=/,'removed variants cannot override Outfit through old CSS');

  const authorizedDecisions=englishData(beforeModel('COMPONENT_DECISIONS'));authorizedDecisions.buttons.border_variants=authorizedDecisions.buttons.border_variants.filter(v=>['none','hairline'].includes(v.value));
  authorizedDecisions.buttons.tracking_variants=[{value:'normal',label:'0 px / natural',letter_spacing_px:0}];
  authorizedDecisions.buttons.state_variants=JSON.parse(vm.runInContext('JSON.stringify(BUTTON_VARIANTS.state.slice(0,8))',context));
  authorizedDecisions.buttons.width_variants=[{value:'content',label:'Content width',min_width_px:null,block:false},{value:'wide',label:'Wide',min_width_px:175,block:false},{value:'full',label:'Full width',min_width_px:null,block:true}];
  const previousDecisions=JSON.parse(JSON.stringify(context.catalog.COMPONENT_DECISIONS));
  for(const key of ['fill','palette','tone','duration','shadow'])delete previousDecisions.buttons[key+'_variants'];
  assert.deepEqual(previousDecisions,authorizedDecisions,'unrelated decisions stay exact; approved visual metadata has its separate exact contract');
  assert.deepEqual(Array.from(AXES.find(a=>a.key==='tracking').options,o=>o[0]),['normal'],'natural0px is the only retained spacing');
  for(const tracking of ['tight','wide','ultra','normal',null,2]){assert.equal(safeConfig({...BASE,tracking}).tracking,'normal');assert.equal(context.catalog.buildAntdRecipe({...BASE,tracking}).button.styles.root.letterSpacing,'0px','AntD applies the same spacing decision');}
  assert.match(css,/--button-letter-spacing:0px/);assert.match(css,/--track:var\(--button-letter-spacing\)/);
  assert.doesNotMatch(css,/data-tracking=(?:tight|wide|ultra)/,'old desktop/mobile selectors cannot revive removed spacing');
  assert.deepEqual(JSON.parse(JSON.stringify(context.catalog.ARCHIVED_PRESETS)),beforeModel('ARCHIVED_PRESETS'),'all original preset data is preserved');
  assert.deepEqual(JSON.parse(JSON.stringify(AXES.find(a=>a.key==='radius').options.map(([v])=>v))),['0','3','5','pill'],'only four decided radius variants are allowed');
  for(const [input,expected] of [['0','0'],['3','3'],['5','5'],['pill','pill'],['100%','pill'],['square','0'],['1','0'],['2','3'],['4','5'],['6','5']])
    assert.equal(safeConfig({radius:input}).radius,expected,`legacy radius ${input}`);
  assert.equal(safeConfig({customRadius:4}).radius,'5');
  assert.equal(safeConfig({customRadius:4}).customRadius,undefined,'freeform radius cannot bypass the decision');
  assert.deepEqual(JSON.parse(JSON.stringify(context.catalog.COMPONENT_DECISIONS.buttons.opacity)),{normal:0.9,hover:1});
  assert.deepEqual(JSON.parse(JSON.stringify(context.catalog.COMPONENT_DECISIONS.buttons.size_variants?.map(v=>[v.value,v.height_px,v.padding_inline_px])||[])),[['compact',44,17],['normal',48,25],['large',56,30],['tall',64,24]]);
  assert.deepEqual(Array.from(context.catalog.COMPONENT_DECISIONS.buttons.shadow_variants,item=>item.value),['none','soft','ambient','longFlat','layeredFlat','layeredFlat8'],'only the explicitly approved shadows become decisions');
  for(const name of ['flatLayer','longFlat','layeredFlat']){const b=context.catalog.buttonFor({...BASE,shadow:name});assert.equal(b.dataset.shadow,name);assert.ok(b.style.values['--sh-pressed']);}
  for(const shadow of ['soft','contact','flatLayer','longFlat','layeredFlat']){
    const preview=context.catalog.buttonFor({...BASE,shadow});
    assert.equal(context.catalog.buildAntdRecipe({...BASE,shadow}).button.styles.root.boxShadow,preview.style.values['--sh'],'Ant Design mapping carries selected normal shadow');
    assert.equal(context.catalog.buildAntdRecipe({...BASE,shadow},'pressed').button.styles.root.boxShadow,preview.style.values['--sh-pressed'],'Ant Design mapping carries reduced pressed shadow');
  }
  assert.deepEqual(Array.from(context.catalog.COMPONENT_DECISIONS.buttons.state_variants,s=>s.value),['default','hover','pressed','disabled','loading','saving','syncing','queued']);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(BUTTON_EXPERIMENTS.state_variants.map(s=>s.value))',context)),['offline','warning','retry','success','error'],'unapproved states remain experiments');
  assert.deepEqual(JSON.parse(JSON.stringify(safeConfig({icon:{library:'unknown',name:'<script>',position:'diagonal',motion:'bounce'}}).icon)),{library:'phosphor',name:'none',position:'left',motion:'static'},'legacy/untrusted icon values cannot add arbitrary SVG or animation');
  assert.deepEqual(JSON.parse(JSON.stringify(context.catalog.COMPONENT_DECISIONS.buttons.border_variants?.map(v=>v.value)||[])),['none','hairline']);
  assert.deepEqual(JSON.parse(JSON.stringify(AXES.find(a=>a.key==='border').options.map(([v])=>v))),['none','hairline']);
});

test('button surfaces have no transform distortion, pattern or inset', () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const rootRule=rules.find(([,selector])=>selector.trim()===':root')[2];
  assert.match(rootRule,/--motion-easing:cubic-bezier\(\.65,0,\.35,1\)/,'one shared slow-start/slow-end curve');
  for(const [,selector,body] of rules)for(const [,property,value]of body.matchAll(/(?:^|;)\s*(transition|animation)\s*:\s*([^;]+)/g)){
    if(value.startsWith('none'))continue;
    for(const item of value.split(/,(?![^()]*\))/))assert.match(item,/var\(--(?:motion-easing|ease)\)/,`${selector} ${property}: ${item} must use the shared curve`);
  }
  assert.doesNotMatch(css,/data-easing=(?:linear|smooth)|--ease:linear|--ease:cubic-bezier/,'legacy selectors cannot override the common easing');
  const declarations=selector=>Object.fromEntries(rules.filter(([,s])=>s.trim()===selector).flatMap(([,s,body])=>body.split(';').filter(Boolean).map(d=>{const i=d.indexOf(':');return[d.slice(0,i).trim(),d.slice(i+1).trim()];})));
  const light=declarations(':root'),dark=declarations(':root[data-theme=dark]'),stage=declarations('.spec-stage.dark');
  const recipes=declarations('.btx,.shadow-swatch');
  assert.ok(recipes['--shadow-contact'],'shadow recipes resolve on the painted node, after inheriting surface tokens');
  for(const profile of [dark,stage]){
    assert.equal(profile['--shadow-ink'],'0,0,0','dark surfaces use black shadow ink');
    for(const name of ['contact','soft','diffuse','raised']){
      const alpha=Number(profile['--shadow-'+name+'-alpha']);
      assert.ok(alpha>=.28&&alpha<=.34,'dark blur stays restrained but visible');
      assert.ok(alpha*41*.9>8,'full-coverage channel change on the darkest canvas exceeds 8/255; this is arithmetic, not a visual pass');
    }
  }
  for(const selector of ['.spec-stage.warm,.spec-stage.cool,.spec-stage.paper']){
    const profile=declarations(selector);
    for(const key of Object.keys(dark).filter(k=>k.startsWith('--shadow-')))assert.equal(profile[key],light[key],'explicit light stages restore light tokens inside dark theme');
  }
  assert.equal(recipes['--shadow-ambient'],'0 2px 8px rgba(var(--shadow-accent-rgb),var(--shadow-ambient-alpha))','ambient shadow uses the selected palette');
  assert.match(css,/\.shadow-swatch\{[^}]*box-shadow:var\(--choice-shadow\)[^}]*pointer-events:none/);

  for (const [,selector,body] of rules) {
    if (selector.includes('.btx') && !selector.includes('::') && !selector.includes('.btx-progress'))
      assert.doesNotMatch(body, /(?:^|;)\s*transform\s*:|inset\s+0|background-image\s*:/, selector);
    if (selector.includes('.btx'))assert.doesNotMatch(body,/box-shadow\s*:\s*inset/);
  }
  assert.doesNotMatch(css, /clip-path\s*:|background-image\s*:|box-shadow\s*:\s*inset/);
});

test('shared opacity and visible keyboard focus preserve the flat button states', () => {
  const faces=[...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(m=>m[1]);assert.equal(faces.length,2,'Latin and Latin Extended font assets are both embedded');
  const source=JSON.parse(readFileSync(new URL('./outfit-woff2-source.json',import.meta.url),'utf8'));
  for(const [i,face] of faces.entries()){
  assert.match(face,/font-family:Outfit/);assert.match(face,/font-weight:100 900/);
  const embedded=face.match(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/)?.[1];assert.ok(embedded,'the standalone font stays available offline in WOFF2');
  const font=Buffer.from(embedded,'base64');assert.equal(font.toString('ascii',0,4),'wOF2');
  assert.equal(createHash('sha256').update(font).digest('hex'),source.assets[i].sha256,'embedded bytes match verified official glyph/weight assets');
  assert.ok(face.includes(source.assets[i].unicode_range),'subset boundaries match the official stylesheet');
  }
  assert.match(html,/SIL OPEN FONT LICENSE Version 1.1/,'the embedded stylesheet retains the redistribution license');
  assert.equal(BASE.type,'system');assert.equal(PRESETS[0].config.type,'system','default preset selects the Outfit option');
  assert.equal(context.catalog.buildAntdRecipe(BASE).font_loading_required.stylesheet_id,'atlas-styles');
  assert.match(script,/const css\s*=\s*document.querySelector\('style'\)\.textContent/,'standalone export copies the embedded font stylesheet');

  assert.match(css, /--opacity-rest\s*:\s*\.9\s*;/);
  assert.match(css, /--opacity-hover\s*:\s*1\s*;/);
  assert.match(css, /button\{[^}]*opacity:var\(--opacity-rest\)/);
  assert.match(css, /button:hover[^}]*opacity:var\(--opacity-hover\)/);
  assert.doesNotMatch(css, /data-force=focus|data-focus=double/);
  for(const [,selector,body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    if(!selector.includes(':focus'))continue;
    for(const [,value] of body.matchAll(/(?:^|;)\s*outline(?:-style)?\s*:\s*([^;]+)/g))
      assert.ok(['none','0'].includes(value.trim()),`surrounding focus outline: ${selector}`);
    assert.doesNotMatch(body, /(?:^|;)\s*border(?:-color)?\s*:/, 'focus must not change all four borders');
  }
  assert.match(css, /\.btx:focus-visible \.btx-label\{text-decoration:none\}/,
    'button label never gets a focus underline');
  assert.match(css, /\.btx:focus-visible \.btx-label::before\{[^}]*background:currentColor[^}]*pointer-events:none/,
    'keyboard focus keeps one side marker, including pressed simulations');
  assert.match(css, /@media\(forced-colors:active\)[\s\S]*\.btx:focus-visible \.btx-label::before\{background:ButtonText;forced-color-adjust:none/,
    'keyboard side marker survives system high contrast');
  assert.doesNotMatch(css,/--focus-indicator\s*:/,'old surrounding focus token must be removed at source');
  assert.ok(css.lastIndexOf('a:focus-visible')>css.indexOf('.jump a{'),
    'link focus must survive the later base decoration reset');
  assert.match(css, /@media\(forced-colors:active\)[\s\S]*background:Highlight;forced-color-adjust:none/,
    'form focus needs a visible marker even when system high contrast suppresses shadows');
  assert.match(html, /<label class="search-control"><input class="search" id="gallerySearch"/);
  assert.match(css, /data-detail=bottomedge[^}]*::after\{[^}]*background:var\(--lip-color,var\(--bd\)\)/);
  for(const palette of Object.keys(PALETTES)){
    const b=context.catalog.buttonFor({...BASE,palette}),dark=rgb(b.style.values['--bd']),lip=rgb(b.style.values['--lip-color']);
    assert.equal(b.style.values['--bc'],PALETTES[palette].color,'main surface color remains unchanged');
    assert.deepEqual(Array.from(lip),Array.from(dark,v=>Math.round(v*.88)),'upper and lower lips share a slightly darker hue');
  }
  assert.doesNotMatch(css, /data-detail=bottomedge[^}]*data-force=pressed[^}]* .btx-lip::after\{/,'ground must not slide on press');
  assert.equal(BASE.hover,'opacity');
  assert.equal(BASE.tone,'middle','legacy recipes default to the unchanged middle tone');
  assert.deepEqual(Array.from(AXES.find(a=>a.key==='tone')?.options||[],o=>o[0]),['dark','middle','light','pastel']);
  assert.equal(safeConfig({tone:'arbitrary'}).tone,'middle');
  assert.deepEqual(Array.from(context.catalog.COMPONENT_DECISIONS.buttons.tone_variants,item=>item.value),['dark','middle','light','pastel'],'the four screenshot tones are approved without altering their colors');
  const toneSource=JSON.parse(readFileSync(new URL('./tone-source.json',import.meta.url),'utf8'));
  const historicalPalettes=Object.keys(toneSource.fourToneCandidates);
  assert.deepEqual(historicalPalettes,['violet','blue','teal','moss','clay','coral','amber','graphite'],'the historical fixture retains all eight original palettes');
  for(const palette of historicalPalettes)for(const tone of ['dark','middle','light','pastel']){
    const b=context.catalog.buttonFor({...BASE,palette,tone}),expected=toneSource.fourToneCandidates[palette][tone];
    assert.equal(b.style.values['--bc'],expected,`${palette}/${tone} surface reaches renderer`);
    assert.equal(b.dataset.tone,tone);
    const antd=context.catalog.buildAntdRecipe({...BASE,palette,tone});
    assert.equal(antd.configProvider.theme.token.colorPrimary,expected);
    assert.equal(antd.button.props.color,'primary','palette-based solid export selects the primary color');
    assert.ok(contrast(antd.configProvider.theme.components.Button.primaryColor,expected)>=4.5,'light/pastel export carries readable primary text rather than default white');
  }

  assert.equal(PRESETS.find(p => p.name === 'Lower lip').config.press,'flatten');
  assert.doesNotMatch(css, /:root\[data-motion=off\][^{]*,\s*\.btx::after\s*\{/,
    'the reduced-motion opt-out must not disable every lip transition');
  assert.doesNotMatch(css, /@keyframes flash/,
    'animation must not override the hover opacity');
});

test('generated previews retain allowed choices and readable text', () => {
  assert.equal(typeof context.renders.renderDecisions,'function','decided components need an actual rendered section');
  context.renders.renderDecisions();
  context.renders.renderHero();context.renders.renderGallery();
  assert.equal(roots.get('heroBoard').children.length,4);assert.equal(roots.get('galleryGrid').children.length,1);
  let selectedState;context.renders.stateBar('testStates','default',s=>{selectedState=s;});
  const stateToggle=roots.get('testStates').children.find(n=>n.dataset.state==='saving');stateToggle.onclick();
  assert.equal(selectedState,'saving');assert.equal(stateToggle.attributes['aria-pressed'],'true');
  assert.equal(roots.get('testStates').children.find(n=>n.dataset.state==='saving'),stateToggle,'state toggle retains keyboard focus identity');
  context.renders.buildControls();
  assert.equal(roots.has('select-type'),false,'studio no longer renders the typography selector');
  assert.equal(roots.has('select-tracking'),false,'spacing uses decided options');
  assert.equal(roots.get('trackingChoices').children.length,1);assert.equal(roots.get('trackingChoices').children[0].dataset.tracking,'normal');
  const choices=roots.get('radiusChoices').children;
  assert.equal(choices.length,4);
  const borders=roots.get('borderChoices');assert.ok(borders,'border choices need their own controls');
  assert.equal(borders.children.length,2);
  borders.children.find(b=>b.dataset.border==='hairline').onclick();
  const pillChoice=choices.find(b=>b.dataset.radius==='pill');pillChoice.onclick();
  assert.equal(pillChoice.attributes['aria-pressed'],'true');
  assert.equal(choices.filter(b=>b.attributes['aria-pressed']==='true').length,1);
  assert.equal(roots.get('radiusChoices').children.find(b=>b.dataset.radius==='pill'),pillChoice,'choice keeps its DOM identity for keyboard focus');
  assert.equal(roots.get('liveStage').children[0].dataset.radius,'pill','studio consumes the same decided variant');
  assert.equal(roots.get('select-shape').value,'rect');
  assert.equal(roots.get('select-shape').children.find(o=>o.value==='tab').disabled,true,'tab cannot undo the full pill decision');
  assert.equal(roots.get('liveStage').children[0].dataset.border,'hairline','retained border choice reaches preview');
  context.renders.renderPrimitives();
  assert.equal(roots.has('axis-type'),false,'typography examples are absent');
  assert.equal(roots.get('axisJump').children.some(link=>link.href==='#axis-type'),false,'removed group has no jump link');
  context.renders.renderBehavior();
  context.renders.sampleSelection();context.renders.renderCompare();
  const buttonCount=node=>(node.className==='btx'?1:0)+node.children.reduce((sum,child)=>sum+buttonCount(child),0);
  assert.equal(buttonCount(roots.get('primitiveGrid')),AXES.reduce((sum,a)=>sum+a.options.length,0));
  context.document.querySelector=()=>({scrollIntoView(){}});
  vm.runInContext("studioState='pressed';",context);
  const softCell=roots.get('axis-shadow').querySelectorAll('.axis-example').find(n=>n.querySelector('.btx').dataset.shadow==='soft');
  softCell.querySelector('.axis-pick').onclick();
  assert.equal(roots.get('liveStage').children[0].dataset.force,'default','primitive shadow selection also reveals the normal shadow');
  vm.runInContext("search='middle';",context);context.renders.renderGallery();
  assert.equal(buttonCount(roots.get('galleryGrid')),1,'legacy presets are searchable by their rendered default Middle tone');
  vm.runInContext("search='';",context);context.renders.renderGallery();

  assert.equal(buttonCount(roots.get('behaviorGrid')),13);
  assert.equal(buttonCount(roots.get('compareGrid')),1);
  assert.equal(buttonCount(roots.get('decisionRadiusGrid')),4);
  assert.equal(buttonCount(roots.get('decisionOpacityGrid')),2);
  assert.ok(roots.get('decisionBorderGrid'),'decided border group must render');
  assert.equal(buttonCount(roots.get('decisionBorderGrid')),2);
  assert.equal(buttonCount(roots.get('decisionSizeGrid')),4);
  assert.equal(buttonCount(roots.get('decisionTrackingGrid')),1,'the explicit spacing decision has one example');
  assert.equal(buttonCount(roots.get('axis-tracking')),1,'other spacing examples are removed');
  assert.equal(buttonCount(roots.get('shadowTrialGrid')),20,'each shadow compares normal and pressed without inheriting the studio simulation');
  assert.equal(roots.get('toneChoices').children.length,4,'all four approved tones are selectable');
  vm.runInContext("studioState='pressed';",context);
  roots.get('shadowChoices').children.find(b=>b.dataset.shadow==='layeredFlat').onclick();
  assert.equal(roots.get('liveStage').children[0].dataset.force,'default','choosing a shadow reveals its normal state');
  assert.equal(roots.get('liveStage').children[0].dataset.shadow,'layeredFlat');
  const trialButtons=roots.get('shadowTrialGrid').querySelectorAll('.btx');
  assert.equal(trialButtons.filter(b=>b.dataset.force==='default').length,10);
  assert.equal(trialButtons.filter(b=>b.dataset.force==='pressed').length,10);
  roots.get('toneChoices').children.find(b=>b.dataset.tone==='pastel').onclick();
  assert.equal(roots.get('liveStage').children[0].dataset.tone,'pastel');
  assert.equal(context.renders.recipeFor({...BASE,tone:'light'}).renkler.color,'#ff7875','exports use the selected tone');

  assert.equal(buttonCount(roots.get('iconTrialGrid')),14,'both libraries have four placements and three motion examples');
  for(const library of ['phosphor','antd'])for(const position of ['left','right','top','bottom']){
    const b=context.catalog.buttonFor({...BASE,icon:{library,name:'arrowRight',position,motion:'static'}});
    const icon=b.querySelector('.btx-icon');assert.ok(icon,`${library} / ${position}`);
    assert.equal(icon.attributes['aria-hidden'],'true');assert.equal(icon.attributes.focusable,'false');
    assert.ok(icon.children.some(n=>n.tagName==='path'&&n.attributes.d),'official SVG paths render');
    assert.equal(b.dataset.iconPosition,position);assert.equal(icon.dataset.motion,'static');
  }
  const animated=context.catalog.buttonFor({...BASE,icon:{library:'phosphor',name:'loading',position:'right',motion:'spin'}});
  assert.equal(animated.querySelector('.btx-icon').dataset.motion,'spin');
  const busyIcon=context.catalog.buttonFor({...BASE,icon:{library:'antd',name:'check',position:'top',motion:'static'}},'loading');
  assert.equal(busyIcon.querySelector('.btx-icon').dataset.motion,'spin','busy states show an animated loader without moving the button');
  const stackedPill=context.catalog.buttonFor({...BASE,radius:'pill',icon:{library:'phosphor',name:'check',position:'top',motion:'static'}});
  assert.equal(stackedPill.style.values['--corner'],'9999px','pill backing follows actual content height when vertical icons expand it');
  for(const group of ['Library','Name','Position','Motion'])assert.ok(roots.get('icon'+group+'Choices')?.children.length,'icon options are actual studio controls');
  roots.get('iconNameChoices').children.find(n=>n.dataset.value==='check').onclick();
  roots.get('iconPositionChoices').children.find(n=>n.dataset.value==='bottom').onclick();
  assert.equal(roots.get('liveStage').children[0].dataset.iconName,'check');
  assert.equal(roots.get('liveStage').children[0].dataset.iconPosition,'bottom');
  const iconRecipe=context.renders.recipeFor({...BASE,icon:{library:'antd',name:'download',position:'right',motion:'static'}});
  assert.equal(iconRecipe.ikon.library,'antd');assert.equal(iconRecipe.ikon.name,'download');
  assert.equal(iconRecipe.antd.icon_mapping.component,'DownloadOutlined');
  assert.match(css,/\.btx-icon\[data-motion=spin\]/);assert.match(css,/\.btx-icon\[data-motion=pulse\]/);
  const shadows=roots.get('shadowChoices');assert.equal(shadows.children.length,10);
  for(const choice of shadows.children){
    const swatch=choice.querySelector('.shadow-swatch');assert.ok(swatch,'every sidebar shadow choice includes its own sample');
    assert.equal(swatch.tagName,'span');assert.equal(swatch.attributes['aria-hidden'],'true');
    vm.runInContext("studioState='pressed';",context);choice.onclick();
    const live=roots.get('liveStage').children[0];
    assert.equal(live.dataset.force,'default');assert.equal(live.dataset.shadow,choice.dataset.shadow);
    assert.equal(swatch.style.values['--choice-shadow'],live.style.values['--sh'],'sidebar sample and live preview share one recipe');
    assert.equal(swatch.style.values['--shadow-accent-rgb'],live.style.values['--shadow-accent-rgb'],'ambient sample follows the selected palette');
    assert.equal(shadows.children.find(b=>b===choice),choice,'selection keeps the focused control in place');
  }


  vm.runInContext("current={...current,customColors:{bg:'#123456'}};",context);context.renders.renderStudio();
  for(const choice of shadows.children)assert.equal(choice.querySelector('.shadow-swatch').style.values['--shadow-accent-rgb'],'18,52,86','direct custom-color changes refresh ambient sidebar samples');
  vm.runInContext('delete current.customColors;',context);context.renders.renderStudio();
  const sizes=roots.get('sizeChoices');assert.equal(sizes.children.length,4);
  shadows.children.find(b=>b.dataset.shadow==='antd').onclick();
  sizes.children.find(b=>b.dataset.size==='tall').onclick();
  assert.equal(roots.get('liveStage').children[0].dataset.shadow,'antd');
  assert.equal(roots.get('liveStage').children[0].style.values['--h'],'64px');
  for(const [size,h,pad] of [['compact',44,17],['normal',48,25],['large',56,30],['tall',64,24]]){
    const b=context.catalog.buttonFor({...BASE,size,shadow:'diffuse'});
    assert.equal(b.style.values['--h'],h+'px');assert.equal(b.style.values['--pad'],pad+'px');
    assert.ok(b.style.values['--sh'].startsWith('var(--shadow-'));
  }
  for(const state of ['loading','saving','syncing','queued','offline','warning','retry']){
    const b=context.catalog.buttonFor(BASE,state);
    assert.ok(b.children.find(n=>n.className==='btx-label').textContent);
    assert.equal(b.attributes['aria-busy'],['loading','saving','syncing'].includes(state)?'true':undefined);
    assert.equal(b.disabled,['queued','offline'].includes(state));
    assert.equal(b.attributes['aria-disabled'],['loading','saving','syncing','queued','offline'].includes(state)?'true':undefined);
    const recipe=context.catalog.buildAntdRecipe({...BASE,size:'tall'},state);
    assert.equal(recipe.button.props.size,undefined,'64px is a project style, not a fabricated antd size');
    assert.equal(recipe.button.props.loading,['loading','saving','syncing'].includes(state));
    assert.equal(recipe.button.styles.root.minHeight,64);
    assert.equal(recipe.configProvider.wave.disabled,true);
  }
  vm.runInContext("Math.random=()=>.999;"+randomizeSource,context);
  roots.get('randomize').onclick();
  assert.equal(roots.get('liveStage').children[0].dataset.radius,'pill');
  assert.equal(roots.get('liveStage').children[0].dataset.shape,'rect');
  assert.equal(roots.get('select-shape').value,'rect','randomization normalizes state and controls before rendering');
  assert.equal(typeof context.renders.bindOperationDemo,'function');
  context.document.getElementById('demoProcessingOn').checked=true;
  const demo=roots.get('liveStage').children[0],labelNode=demo.querySelector('.btx-label');
  demo.onkeydown({key:'Enter',repeat:false});demo.onclick();
  assert.equal(demo.dataset.force,'default','Enter must wait for key release');
  demo.onkeyup({key:'Enter'});
  assert.equal(demo.dataset.force,'loading');assert.equal(demo.attributes['aria-busy'],'true');
  assert.equal(demo.querySelector('.btx-label'),labelNode,'processing preserves the label and button DOM identity');
  const first=[...timers.values()].find(t=>t.ms===1200);assert.ok(first);first.fn();
  assert.equal(demo.dataset.force,'success');
  [...timers.values()].find(t=>t.ms===900).fn();assert.equal(demo.dataset.force,'default');
  demo.onclick();const stale=[...timers.values()].filter(t=>t.ms===1200).at(-1).fn;
  context.renders.cancelOperationDemo();stale();assert.notEqual(demo.dataset.force,'success','cancelled work cannot overwrite the new preview');
  context.renders.bindOperationDemo(demo);demo.onkeydown({key:'Enter',repeat:false});demo.onclick();demo.onblur();demo.onkeyup({key:'Enter'});
  assert.notEqual(demo.dataset.force,'loading','blur cancels a held activation');
  demo.onkeydown({key:' ',repeat:false});demo.onkeyup({key:' '});demo.onclick();
  assert.equal(demo.dataset.force,'loading','Space click after release starts the simulation');
  context.renders.cancelOperationDemo();
  demo.onkeydown({key:'Enter',repeat:false});demo.onclick();demo.onpointercancel();demo.onkeyup({key:'Enter'});
  assert.notEqual(demo.dataset.force,'loading','cancelled pointer/held activation cannot start processing');
  roots.get('demoProcessingOn').checked=false;demo.onclick();
  assert.notEqual(demo.dataset.force,'loading','demo toggle can disable the simulated operation');
  roots.get('demoProcessingOn').checked=true;demo.onclick();
  assert.equal(demo.dataset.force,'loading');context.renders.showTab('gallery');
  assert.equal(demo.dataset.force,'default','leaving the studio cancels its simulation');
  assert.equal(typeof context.renders.cancelHeldDemoKeys,'function');
  demo.onkeydown({key:'Enter',repeat:false});demo.onclick();context.renders.cancelHeldDemoKeys();
  assert.equal(demo.dataset.keyPressed,undefined,'window deactivation clears the held visual state');
  demo.onkeyup({key:'Enter'});demo.onclick({detail:0});
  assert.equal(demo.dataset.force,'default','a late keyboard click after deactivation is cancelled');
  const readoutButton=context.catalog.buttonFor(BASE);readoutButton.isConnected=true;readoutButton.getBoundingClientRect=()=>({width:121,height:48});
  context.getComputedStyle=(node,pseudo)=>node===readoutButton?(pseudo==='::before'?{backgroundColor:'rgb(207, 19, 34)'}:{color:'rgb(255, 255, 255)',backgroundColor:'rgba(0, 0, 0, 0)',opacity:'1',filter:'none'}):{backgroundColor:'rgb(238, 238, 232)'};
  context.renders.updatePreviewReadout(readoutButton);
  assert.ok(roots.get('contrastReadout').textContent.includes(contrast('#ffffff','#cf1322').toFixed(2)+':1'),'contrast readout measures the painted face rather than its transparent shell');
  vm.runInContext('this.readoutUpdates=0;updatePreviewReadout=()=>this.readoutUpdates++;',context);
  demo.onkeydown({key:'Enter',repeat:false});demo.onclick();demo.onkeyup({key:'Enter'});
  assert.equal(demo.dataset.force,'loading','a fresh key press still activates');
  assert.ok(context.readoutUpdates>0,'in-place demo transitions refresh live contrast and dimensions');
  const interimUpdates=context.readoutUpdates;
  assert.equal(typeof demo.ontransitionend,'function');
  demo.ontransitionend({target:demo,propertyName:'background-color'});
  assert.ok(context.readoutUpdates>interimUpdates,'contrast refreshes again after a color transition settles');
  context.renders.cancelOperationDemo();
  assert.doesNotMatch(html,/[İi]kon yok/,'copy must describe optional icons');
  assert.match(css,/\.btx\[data-busy=true\] \.btx-progress/,'busy states share the progress affordance');
  assert.match(script,/closest\('\.btx\[aria-disabled="true"\]'\)/,'busy controls are protected from keyboard and synthetic clicks');
  assert.match(html, /id="tab-decisions"[^>]*aria-selected="true"/);
  assert.match(html, /id="panel-decisions"[^>]*aria-labelledby="tab-decisions"/);
  assert.doesNotMatch(html,/id="custom(?:Radius|Border)(?:On|Value)?"/,'unapproved freeform sliders must be removed');
  const fullPill=context.catalog.buttonFor({...BASE,radius:'pill',shape:'tab'});
  assert.equal(fullPill.dataset.shape,'rect','full pill must keep all four rounded corners');
  assert.equal(fullPill.style.values['--r'],'9999px');
  assert.equal(context.catalog.buildAntdRecipe({...BASE,radius:'pill',shape:'tab'}).button.props.shape,'round');
  for(const [radius,cssValue] of [['0','0px'],['3','3px'],['5','5px'],['pill','9999px']])
    assert.equal(context.catalog.buttonFor({...BASE,radius}).style.values['--r'],cssValue);
  assert.match(css,/\.btx\[data-detail=bottomedge\]\[data-radius=pill\]\{--lip-track-height:100%;--top-lip-track-height:100%/,'pill backing layers follow the full actual button height');
  for (const preset of PRESETS) for (const axis of AXES)
    assert.ok(axis.options.some(([v]) => v === safeConfig(preset.config)[axis.key]), `${preset.name}: ${axis.key}`);
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9]|1[0-5])px|--fs:\s*(?:[0-9]|1[0-5])px/);
  assert.match(css, /font-family:Outfit,/);
  assert.match(css,/\.btx \.btx-label\{[^}]*min-width:0/,'long status labels may shrink and wrap inside the flex button');
  assert.match(css,/@media\(max-width:520px\)\{\.state-grid\{grid-template-columns:1fr/,'phone status previews retain approved padding and readable text');
  assert.doesNotMatch(script, /PRESETS\[27\]|PRESETS\[25\]/);
  for(const palette of Object.keys(PALETTES))for(const tone of ['dark','middle','light','pastel']){
    const b=context.catalog.buttonFor({...BASE,palette,tone}),p=context.catalog.paletteFor({...BASE,palette,tone});
    assert.ok(contrast(solidText(p.color),p.color)>=4.5,`${palette}/${tone} solid text`);
    assert.ok(contrast(b.style.values['--surface-ink'],p.tint)>=4.5,`${palette}/${tone} tint text`);
    assert.ok(contrast(b.style.values['--surface-ink'],'#ffffff')>=4.5,`${palette}/${tone} white text`);
  }
  const blend=(fg,bg)=>'#'+rgb(fg).map((v,i)=>Math.round(v*.9+rgb(bg)[i]*.1).toString(16).padStart(2,'0')).join('');
  for(const palette of Object.keys(PALETTES))for(const tone of ['dark','middle','light','pastel']) for(const bg of ['#eeeee8','#292e2a','#fffef9','#262d31','#eee6d8','#e5e9ef'])
    {const p=context.catalog.paletteFor({...BASE,palette,tone});assert.ok(contrast(blend(solidText(p.color),bg),blend(p.color,bg))>=4.5, `${palette}/${tone} on ${bg} at opacity .9`);}
});


test('rounded inner top lip mirrors the lower lip without moving text or hit area', () => {
  const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const declarations=selector=>{
    const entries=rules.filter(([,s])=>s.trim()===selector).flatMap(([,s,body])=>body.split(';').filter(Boolean).map(d=>{const i=d.indexOf(':');return[d.slice(0,i).trim(),d.slice(i+1).trim()];}));
    assert.ok(entries.length,`missing ${selector}`);return Object.fromEntries(entries);
  };
  const root=declarations(':root'),base=declarations('.btx'),lip=declarations('.btx[data-detail=bottomedge]');
  const active=declarations('.btx[data-detail=bottomedge]:is(:active,[data-force=pressed],[data-key-pressed=true])');
  const face=declarations('.btx[data-detail=bottomedge]::before');
  const lower=declarations('.btx[data-detail=bottomedge] .btx-lip');
  const lowerPaint=declarations('.btx[data-detail=bottomedge] .btx-lip::after');
  const hit=declarations('.btx[data-detail=bottomedge] .btx-hitarea');
  const value=(expression,vars)=>{
    let resolved=expression;
    for(let i=0;i<8&&resolved.includes('var(');i++)resolved=resolved.replace(/var\((--[a-z-]+)\)/g,(_,k)=>{assert.ok(vars[k]!==undefined,k);return vars[k];});
    resolved=resolved.replace(/calc\(/g,'(').replace(/max\(/g,'Math.max(').replace(/(?:px|ms)/g,'');
    assert.match(resolved.replace(/Math\.max/g,''),/^[\d.\s()+*/, -]+$/);return Function(`return (${resolved})`)();
  };
  const metric=(pressed,lines=1)=>{
    const vars={...root,...base,...lip,...(pressed?active:{})};
    const minimum=value(vars['min-height'],vars),paddingTop=value(vars['--button-padding-block'],vars),paddingBottom=value(vars['padding-bottom']||vars['--button-padding-block'],vars);
    const height=Math.max(minimum,lines*19.2+paddingTop+paddingBottom);
    const margin=0;
    const faceBottom=value(face['bottom'],vars),faceTop=value(face.top||'0px',vars);
    const stripBottom=value(lower['bottom'],vars);
    const translation=value(lowerPaint.transform.match(/translateY\((.*)\)/)[1],vars);
    return {height,extent:height+margin,label:margin+paddingTop+(height-paddingTop-paddingBottom)/2,faceTop:margin+faceTop,outerTop:margin,
      face:height-faceBottom-faceTop,faceBottom:margin+height-faceBottom,stripBottom:margin+height-stripBottom+translation,hitTop:margin+value(hit.top,vars),
      hitHeight:value(hit.height.replace('100%','100px'),vars)-100+height};
  };
  // Interpret 100% as the button's own block size; this is CSS arithmetic, not a browser layout test.
  const rest=metric(false),pressed=metric(true);
  const top=declarations('.btx[data-detail=bottomedge]::after');
  const topActive=declarations('.btx[data-detail=bottomedge]:is(:active,[data-force=pressed],[data-key-pressed=true])::after');
  const pressedVars={...root,...base,...lip,...active};
  assert.equal(value(root['--lip-height'],root),4,'bottom strip is 4px');
  assert.equal(lip['--edge'],'var(--lip-color,var(--bd))','border and depth share one color');
  assert.equal(face['border-radius'],'var(--inner-r)','face uses padding-box radius');
  for(const radius of [0,3,5])for(const border of [0,1]){
    const vars={...root,...base,...lip,'--corner':radius+'px','--edgew':border+'px'};
    const inner=value(lip['--inner-corner'],vars);
    assert.equal(inner,Math.max(0,radius-border),'inner radius accounts for real border width');
  }
  assert.equal(top.inset,'0 0 auto','upper layer spans the full button and stays inside its outline');
  assert.equal(top['border-radius'],'var(--inner-corner) var(--inner-corner) 0 0','upper corners mirror the rounded lower layer');
  assert.equal(value(root['--top-lip-height'],root),2,'upper exposed depth is 2px');
  assert.equal(value(top.height,pressedVars),value(root['--top-lip-height'],root)+value(base['--corner'],{...root,...base}),'upper layer overlaps behind face to prevent corner gaps');
  assert.equal(top.visibility,'hidden');assert.equal(topActive.visibility,'visible');
  assert.ok(!('transform' in top)&&!('transform' in topActive),'no detached strip above the button');
  assert.equal(value(active['--top-lip-delay'],pressedVars),50,'upper reveal waits for bottom closure');
  assert.equal(value(pressedVars['--depth-duration'],pressedVars),50);
  assert.equal(value(pressedVars['--top-duration'],pressedVars),30);
  assert.equal(value(pressedVars['--press-duration'],pressedVars),80);
  assert.equal(value(pressedVars['--release-duration'],pressedVars),140);
  assert.ok(Number(top['z-index'])<Number(face['z-index']),'top strip stays behind the face');
  assert.equal(top['pointer-events'],'none','top strip must not change the hit target');
  assert.match(top.transition,/visibility 0s var\(--ease\) var\(--top-duration\)/,'release hides strip after face covers it');
  assert.match(face.transition,/top var\(--top-duration\) var\(--ease\) var\(--top-lip-delay\)/,'top reveal is delayed independently of the bottom edge');
  assert.doesNotMatch(css,/\.btx\[data-border=(?:solid|bottom|left)\]/,'removed border variants have no active styles');
  assert.equal(rest.height,48);assert.equal(pressed.height,48,'button footprint stays 48px');
  assert.equal(rest.extent,pressed.extent,'surrounding layout stays fixed');
  assert.equal(rest.label,rest.height/2,'label is centered including the bottom4px layer');
  assert.equal(pressed.label,pressed.height/2,'label stays centered including the top2px layer');
  assert.equal(pressed.label,rest.label,'text stays fixed');
  assert.equal(pressed.outerTop,rest.outerTop,'outer top edge stays fixed');
  assert.equal(rest.faceTop,0);assert.equal(pressed.faceTop,2,'inner face exposes the rounded upper2px layer');
  assert.equal(rest.face,44);assert.equal(pressed.face,46);
  assert.equal(pressed.faceBottom-rest.faceBottom,4,'bottom still extends from44px to48px');
  assert.equal(rest.hitHeight,48);assert.equal(pressed.hitHeight,48,'lower-edge presses keep their hit target');
  assert.equal(rest.stripBottom,48);assert.equal(pressed.stripBottom,48,'ground stays stationary');
  assert.equal(pressed.faceBottom,pressed.stripBottom,'pressed face reaches the ground');
  assert.equal(rest.stripBottom-rest.faceBottom,4,'resting face is raised 4px');
  assert.equal(rest.hitTop,0);assert.equal(pressed.hitTop,0,'upper-edge presses retain their hit target');
  assert.equal(lower.overflow,'hidden','track clips the sliding lip');
  assert.equal(lower['border-radius'],'0 0 var(--inner-corner) var(--inner-corner)','lower corners use a scalar radius');
  assert.equal(declarations('.btx[data-shape=tab] .btx-lip')['border-radius'],'0','tab lower edge stays flat');
  const transparent=declarations('.btx[data-detail=bottomedge]:is([data-fill=outline],[data-fill=ghost])');
  assert.equal(value(transparent['--lip-track-height'],{...root,...base,...lip}),4,'transparent faces start with a 4px clipping track');
  assert.equal(value(transparent['--top-lip-track-height'],{...root,...base,...lip}),0,'transparent surface has no resting top band');
  assert.equal(value(transparent['--top-lip-track-height'],pressedVars),2,'transparent top band is confined to2px');
  for(const selector of ['.btx[data-press=ink]:is(:active,[data-force=pressed],[data-key-pressed=true])','.btx[data-status=success]','.btx[data-status=error]']){
    const state=declarations(selector);assert.ok(state['--state-bg']&&state['--state-fg'],'face and label share state colors');
  }
  assert.ok(Number(face['z-index'])>Number(lower['z-index']),'face occludes the lip');
  assert.equal(lowerPaint.opacity,'1','fixed lower layer stays opaque');
  assert.equal(value(transparent['--lip-track-height'],{...root,...base,...lip,...active}),0,'transparent track is fully clipped on press');
  assert.doesNotMatch(css,/(?:linear|radial|conic)-gradient\(/,'flat 2.0 uses no gradients');
  assert.equal(lip['--depth-duration'],'var(--release-duration)');
  assert.equal(active['--depth-duration'],'calc(var(--press-duration) * .625)');
  assert.equal(Number(root['--depth-press-scale']),.4);assert.equal(Number(root['--depth-release-scale']),.7);
  assert.equal(lip.overflow,'hidden','rounded outer silhouette clips every rear layer');assert.equal(hit['pointer-events'],'auto');
  assert.equal(hit.height,'100%');assert.equal(hit.top,'0px');
  assert.ok(!('margin-top' in lip)&&!('margin-bottom' in lip),'no margin moves the button');
  assert.match(css,/\.btx\[data-busy=true\] \.btx-hitarea\{pointer-events:none\}/,'hit target cannot reenable a loading control');
  assert.equal(face.background,'var(--state-bg,var(--bg))','state color overrides custom normal color');
  assert.equal(base.color,'var(--state-fg,var(--fg))','state label keeps its contrast');
  assert.match(css,/:root\[data-motion=off\] \.btx \.btx-lip::after\{animation:none!important;transition:none!important/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{[^}]*\.btx \.btx-lip::after\{animation:none!important;transition:none!important/);
  const longRest=metric(false,3),longPressed=metric(true,3);
  assert.equal(longRest.height,longPressed.height,'multiline text keeps its full content height');
  assert.equal(longRest.extent,longPressed.extent);assert.equal(longRest.label,longPressed.label);
  assert.equal(longRest.label,longRest.height/2,'multiline label keeps equal top and bottom space');
  assert.equal(longPressed.faceBottom-longRest.faceBottom,4);
  assert.equal(longPressed.faceTop-longRest.faceTop,2);
  const preview=context.catalog.buttonFor(PRESETS.find(p=>p.name==='Lower lip').config);
  for(const name of ['btx-hitarea','btx-lip'])assert.ok(preview.children.some(n=>n.className===name&&n.attributes['aria-hidden']==='true'));
  const customTab=context.catalog.buttonFor({...PRESETS.find(p=>p.name==='Lower lip').config,shape:'tab',customRadius:6});
  assert.equal(customTab.style.values['--r'],'5px 5px 0 0');assert.equal(customTab.style.values['--corner'],'5px');
  assert.equal(customTab.dataset.radius,'5');
  for(const detail of ['bottomedge','none']){const recipe=context.renders.recipeFor({...BASE,detail});
    assert.deepEqual(JSON.parse(JSON.stringify(recipe.kararlar)),JSON.parse(JSON.stringify(context.catalog.COMPONENT_DECISIONS.buttons)));
    assert.equal(recipe.gradient,false);
    assert.equal(recipe.antd.interaction_timing.easing,'var(--motion-easing)');
    assert.equal(recipe.antd.shared_motion_required.tokens['--motion-easing'],root['--motion-easing'],'JSON includes the actual embedded CSS token value');
    assert.match(recipe.antd.shared_motion_required.animated_descendants,/does not inherit/,'JSON calls out child loader animation timing');

    assert.equal(recipe.antd.button.styles.root.transitionTimingFunction,'var(--motion-easing)');
    assert.equal(recipe.etkilesim.gecis_egrisi,'var(--motion-easing)');assert.equal(recipe.etkilesim.govde_hareketi,false);
    assert.equal(recipe.etkilesim.basma_mesafesi_px,0);
    assert.equal(recipe.etkilesim.alt_kenar_uzamasi_px,detail==='bottomedge'?4:0);
    assert.equal(recipe.etkilesim.ust_kenar_sabit,true);assert.equal(recipe.etkilesim.metin_sabit,true);
    assert.equal(recipe.etkilesim.hover_hareketi,false);assert.equal(recipe.etkilesim.zemin_sabit,true);
    assert.equal(recipe.etkilesim.basili_ust_serit_px,detail==='bottomedge'?2:0);
  }
});
