import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import postcss from 'postcss';

const path=new URL('../../dist/buton-atlasi.html', import.meta.url);
const html=readFileSync(path,'utf8');
const before=readFileSync(new URL('./before-form-components.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
// Node DOM simulation only: no resource loader, server, browser or layout engine.
function setup(t){
  const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://atlas.test/'});
  dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  dom.window.ResizeObserver=class {observe(){} unobserve(){} disconnect(){}};
  // Geometry/scrolling are deliberately not asserted in this non-rendering harness.
  dom.window.HTMLElement.prototype.scrollTo=function(){};
  dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  const getStyle=dom.window.getComputedStyle.bind(dom.window);
  dom.window.getComputedStyle=node=>getStyle(node);
  vm.runInContext(script,dom.getInternalVMContext());
  t.after(()=>{vm.runInContext('if(typeof formDropdowns!=="undefined")formDropdowns.forEach(dropdown=>dropdown.destroy())',dom.getInternalVMContext());dom.window.close();});
  const doc=dom.window.document;
  doc.getElementById('tab-forms')?.click();
  const required=id=>{const node=doc.getElementById(id);assert.ok(node,`missing working component ${id}`);return node;};
  const click=id=>required(id).click();
  const change=node=>node.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  const key=(node,value)=>node.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
  return {dom,doc,required,click,change,key,read:code=>vm.runInContext(code,dom.getInternalVMContext())};
}

test('form appearance is shared, preserves user values/focus and never adds decisions',t=>{
  const {required,doc,click,read}=setup(t);
  const decisionsBefore=read('JSON.stringify(COMPONENT_DECISIONS)');
  const field=required('ff-text');field.value='İstanbul, uzun Türkçe örnek';field.focus();
  click('ff-radius-pill');click('ff-size-tall');click('ff-tone-pastel');click('ff-surface-filled');
  assert.equal(required('ff-text'),field,'appearance must not replace live controls');
  assert.equal(field.value,'İstanbul, uzun Türkçe örnek');
  assert.equal(doc.activeElement,field,'programmatic appearance updates preserve current focus');
  assert.equal(required('formLab').dataset.radius,'pill');
  assert.equal(required('formLab').dataset.size,'tall');
  assert.equal(required('formLab').dataset.tone,'pastel');
  assert.equal(read('JSON.stringify(COMPONENT_DECISIONS)'),decisionsBefore,'form interactions cannot mutate the approved decisions');
  assert.equal(required('panel-forms').getAttribute('aria-labelledby'),'tab-forms');
});

test('input actions preserve focus; errors, readonly and disabled states are semantic',t=>{
  const {required,doc,click,read}=setup(t);
  const password=required('ff-password');password.value='Örnek 123';password.focus();
  click('ff-password-toggle');assert.equal(password.type,'text');assert.equal(password.value,'Örnek 123');
  assert.equal(doc.activeElement,password);assert.equal(required('ff-password-toggle').getAttribute('aria-pressed'),'true');
  const search=required('ff-search');search.value='Ankara';click('ff-search-clear');
  assert.equal(search.value,'');assert.equal(doc.activeElement,search);
  assert.equal(required('ff-readonly').readOnly,true);assert.equal(required('ff-disabled').disabled,true);
  const invalid=required('ff-invalid');assert.equal(invalid.getAttribute('aria-invalid'),'true');
  assert.ok(doc.getElementById(invalid.getAttribute('aria-describedby')));
  const email=required('ff-email');email.value='yanlış';click('ff-validate');
  assert.equal(email.getAttribute('aria-invalid'),'true');
  email.value='ornek@example.com';click('ff-validate');assert.equal(email.getAttribute('aria-invalid'),null);
  assert.match(required('ff-form-status').textContent,/valid/i);
  assert.equal(read('FORM_EXPERIMENTS.input_variants.length')>=9,true);
});

test('checkbox group select-all uses real mixed state and disabled controls remain unchanged',t=>{
  const {required,click}=setup(t);const all=required('ff-check-all');
  assert.equal(all.indeterminate,true);
  click('ff-check-all');assert.equal(all.indeterminate,false);
  for(const id of ['ff-check-email','ff-check-sms'])assert.equal(required(id).checked,true);
  click('ff-check-sms');assert.equal(all.indeterminate,true);
  const disabled=required('ff-check-disabled-on');disabled.click();assert.equal(disabled.checked,true);
  assert.equal(required('ff-check-mixed').indeterminate,true);
});

test('radio groups are isolated native radios with correctly scoped labels',t=>{
  const {required,click,doc}=setup(t);
  click('ff-radio-standard-1');click('ff-radio-segmented-2');
  assert.equal(required('ff-radio-standard-1').checked,true);
  assert.equal(required('ff-radio-segmented-2').checked,true);
  assert.notEqual(required('ff-radio-standard-1').name,required('ff-radio-segmented-2').name);
  for(const node of doc.querySelectorAll('#formLab input[type=radio]')){
    assert.ok(node.labels.length,'every radio has an associated label');
  }
});

test('switch exposes boolean semantics and blocks pending/disabled toggles',t=>{
  const {required,click}=setup(t);const control=required('ff-switch-basic');
  assert.equal(control.getAttribute('role'),'switch');assert.equal(control.checked,false);
  assert.equal(required(control.getAttribute('aria-labelledby')).textContent,'Automatic sync','switch name stays stable while its state changes');
  click('ff-switch-basic');assert.equal(control.checked,true);
  assert.match(required('ff-switch-basic-state').textContent,/on/i);
  for(const id of ['ff-switch-loading','ff-switch-disabled-on','ff-switch-disabled-off']){
    const node=required(id),value=node.checked;node.click();assert.equal(node.checked,value);assert.equal(node.disabled,true);
  }
  assert.equal(required('ff-switch-loading').getAttribute('aria-busy'),'true');
});

test('all component families and surface variants are rendered with unique IDs and associated help',t=>{
  const {required,doc,read}=setup(t);
  for(const kind of ['inputs','dropdowns','checkboxes','radios','switches'])assert.ok(required('ff-'+kind).children.length);
  for(const [grid,model,surfaces]of [['input','input',true],['dropdown','dropdown',true],['checkbox','checkbox',false],['radio','radio',false],['switch','switch',false]]){
    assert.equal(required('ff-'+grid+'-grid').children.length,read(`FORM_EXPERIMENTS.${model}_variants.length`)+(surfaces?read('FORM_EXPERIMENTS.surfaces.length'):0),'every declared '+model+' variant is rendered');
  }
  const ids=[...doc.querySelectorAll('[id]')].map(node=>node.id);
  assert.equal(new Set(ids).size,ids.length,'no duplicate live controls');
  for(const id of ['ff-input-outlined','ff-input-filled','ff-input-borderless','ff-input-underlined'])required(id);
  for(const node of doc.querySelectorAll('#formLab [aria-describedby]')){
    for(const id of node.getAttribute('aria-describedby').split(/\s+/))assert.ok(doc.getElementById(id),`missing help ${id}`);
  }
  assert.equal(read('FORM_EXPERIMENTS.dropdown_variants.length')>=8,true);
  assert.doesNotMatch(read('standaloneButton()'),/ff-control|ff-menu|AtlasDropdowns/,'single-button export excludes unrelated form resources');
  assert.equal(doc.querySelectorAll('#formLab select:not([aria-hidden=true])').length,0,'new dropdowns never open an OS menu');
});

const tick=()=>new Promise(resolve=>setTimeout(resolve,35));
test('integrated dropdown selection, search and tab changes keep state and ARIA linked',async t=>{
  const {required,doc,key,read,dom}=setup(t);await tick();
  const trigger=required('ff-select-single-trigger');
  assert.equal(trigger.getAttribute('aria-labelledby'),'ff-select-single-label');
  trigger.focus();key(trigger,'ArrowDown');await tick();
  assert.equal(trigger.getAttribute('aria-expanded'),'true');
  const list=required(trigger.getAttribute('aria-controls'));
  assert.equal(list.hidden,false);assert.equal(list.getAttribute('role'),'listbox');
  key(list,'End');await tick();
  assert.match(list.getAttribute('aria-activedescendant'),/izmir$/,'disabled final option is skipped');
  key(list,'Enter');await tick();
  assert.equal(trigger.getAttribute('aria-expanded'),'false');
  assert.match(trigger.textContent,/İzmir/);assert.equal(doc.activeElement,trigger);
  trigger.click();await tick();read("showTab('studio',true)");await tick();
  assert.equal(doc.activeElement,required('tab-studio'),'closing a hidden dropdown cannot steal tab focus');
  read("showTab('studio');showTab('forms')");await tick();assert.equal(required('ff-select-single-trigger'),trigger);assert.match(trigger.textContent,/İzmir/);
  const search=required('ff-select-search-multiple-input');search.focus();search.value='İz';search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));await tick();
  const searchList=required('ff-select-search-multiple-listbox');
  assert.equal(searchList.querySelectorAll('[role=option]').length,1);
  assert.match(searchList.textContent,/İzmir/);key(search,'ArrowDown');key(search,'Enter');await tick();
  assert.deepEqual(Array.from(read('formDropdowns[3].getValue()')),['izmir']);
  assert.equal(doc.activeElement,search);assert.equal(search.getAttribute('aria-expanded'),'true');
  key(search,'Escape');await tick();assert.equal(search.getAttribute('aria-expanded'),'false');
  required('themeToggle').click();assert.deepEqual(Array.from(read('formDropdowns[3].getValue()')),['izmir']);
});

test('a fixed sample surface remains independent of the shared appearance',t=>{
  const {required,click,dom}=setup(t);click('ff-surface-underlined');
  const sample=required('ff-input-filled').closest('.ff-sample');
  assert.equal(dom.window.getComputedStyle(sample).getPropertyValue('--ff-field-surface'),'var(--ff-neutral-fill)');
});

test('switch thumb contrast and field/focus aliases follow their actual palette scope',t=>{
  const {read,required}=setup(t);
  const css=postcss.parse(html.match(/<style id="atlas-styles">([\s\S]*?)<\/style>/)[1]);
  const valueFor=(selector,property)=>{let value;css.walkRules(rule=>{if(rule.parent.type==='root'&&rule.selector===selector)rule.walkDecls(property,decl=>value=decl.value);});return value;};
  const defaults=new Map();css.walkRules(rule=>{if(rule.selector===':root')rule.walkDecls(decl=>defaults.set(decl.prop,decl.value));});
  const thumb=valueFor('.ff-toggle>input:checked+.ff-switch-track::after','background')||valueFor('.ff-switch-track::after','background');
  assert.ok(thumb,'painted thumb must have a background');
  const resolve=value=>value.replace(/var\((--[\w-]+)\)/g,(_,name)=>resolve(required('formLab').style.getPropertyValue(name)||defaults.get(name)||''));
  for(const palette of read('Object.keys(PALETTES)'))for(const tone of ['dark','middle','light','pastel']){
    read(`formAppearance.palette=${JSON.stringify(palette)};formAppearance.tone=${JSON.stringify(tone)};applyFormAppearance()`);
    const fill=required('formLab').style.getPropertyValue('--ff-fill'),foreground=resolve(thumb);
    assert.ok(read(`contrast(${JSON.stringify(fill)},${JSON.stringify(foreground)})`)>=3,`${palette}/${tone}: thumb must contrast with track`);
  }
  assert.equal(valueFor('.form-lab','--ff-focus-color'),'var(--ff-focus-light)','focus alias resolves where the palette is applied');
  assert.equal(valueFor(':root[data-theme=dark] .form-lab','--ff-focus-color'),'var(--ff-focus-dark)');
  assert.equal(valueFor('.ff-field[data-status=warning]','--ff-field-border'),'var(--ff-warning)','warning boundary resolves on the warning field');
});
