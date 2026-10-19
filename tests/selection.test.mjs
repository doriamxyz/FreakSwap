import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(await readFile(path.join(root,'catalog.json')));
const code=await readFile(path.join(root,'selection-core.js'));
const {availableEngines,completionOptions,candidates,resolveSelection,orderedEngines,choicesFromRecipe,selectionFile,validateSelectionFile,selectionAvailable}=await import('data:text/javascript;base64,'+code.toString('base64'));
const keysFor=e=>orderedEngines(catalog,e.recipe.replacements.map(r=>r.engine));

test('all complete catalog entries are reachable by engine choices and sequential replacements',()=>{
  assert(catalog.combinations.length>=85);
  for(const entry of catalog.combinations){
    const keys=keysFor(entry);let selected=[],choices={};
    for(const key of keys){
      assert(availableEngines(catalog,selected).includes(key),entry.id+' add '+key);
      selected=[...selected,key];const r=resolveSelection(catalog,selected,choices);choices=r.choices;
      assert.deepEqual(r.engines,selected,'no unsolicited companions');
      assert(selectionAvailable(catalog,selected,{}));
    }
    for(const engine of keys){
      const target=entry.recipe.replacements.find(r=>r.engine===engine);
      let r=resolveSelection(catalog,selected,choices),row=r.rows.find(r=>r.engine===engine);
      assert(row.originals.some(o=>o.key===target.original),entry.id+' original '+engine);
      choices={...r.choices,[engine]:{...r.choices[engine],original:target.original}};
      r=resolveSelection(catalog,selected,choices);row=r.rows.find(r=>r.engine===engine);
      assert(row.variants.includes(target.variant),entry.id+' variant '+engine);
      choices={...r.choices,[engine]:{...r.choices[engine],variant:target.variant}};
      choices=resolveSelection(catalog,selected,choices).choices;
    }
    assert.equal(resolveSelection(catalog,selected,choices).entry?.id,entry.id);
  }
});

test('all eleven cards start available and additions have a whole-package witness',()=>{
  assert.equal(catalog.engines.length,11);
  assert.deepEqual(availableEngines(catalog),catalog.engines);
  for(const selected of [[],...catalog.engines.map(e=>[e])]){
    for(const engine of availableEngines(catalog,selected)) {
      if(selected.includes(engine))continue;
      assert(candidates(catalog,[...selected,engine],false).length);
    }
  }
});

test('an incomplete subset suggests explicit companions but never generates an unverified subset',()=>{
  const entry=catalog.combinations.find(e=>e.replacements.length>=4),all=keysFor(entry);
  const keys=all.filter(key=>key!=='phase_distortion'&&key!=='swarm');
  // Use a catalog containing just one complete configuration to isolate this boundary.
  const limited={...catalog,combinations:[entry]},r=resolveSelection(limited,keys);
  assert.equal(r.entry,null);assert.equal(r.canContinue,false);assert.deepEqual(r.rows,[]);assert.deepEqual(r.engines,keys);
  assert(selectionAvailable(limited,keys,{}));
  assert.deepEqual(completionOptions(limited,keys),[all]);
  assert(resolveSelection(limited,all,choicesFromRecipe(entry.recipe)).entry);
  assert.equal(resolveSelection(limited,[],{}).entry,null);
  assert.equal(selectionAvailable(limited,keys,{[keys[0]]:{original:'vocoder'}}),false);
});

test('all original individual firmware choices remain exactly unchanged',async()=>{
  const previous=JSON.parse(await readFile(path.join(root,'tests/fixtures/individual-results.json')));
  assert.equal(previous.combinations.length,38);
  for(const entry of previous.combinations)assert.deepEqual(((e)=>({id:e.id,result:e.result,patch:e.patch}))(catalog.combinations.find(e=>e.id===entry.id)),entry);
  assert.equal(new Set(catalog.combinations.flatMap(e=>e.replacements.map(r=>[r.original,r.engine,r.variant].join('/')))).size,67);
});

test('partial selections survive companion removal and do not retain removed choices',()=>{
  const entry=catalog.combinations.find(e=>e.replacements.length>=3),all=keysFor(entry),keys=all.slice(1);
  const r=resolveSelection(catalog,keys,choicesFromRecipe(entry.recipe));
  assert.deepEqual(r.engines,keys);assert(!Object.hasOwn(r.choices,all[0]));
  const saved=selectionFile(catalog,r.engines,r.choices);
  assert.deepEqual(validateSelectionFile(catalog,saved),saved);
});

test('every original and variant option has a full exact-package witness after earlier selections',()=>{
  for(const entry of catalog.combinations){const keys=keysFor(entry),r=resolveSelection(catalog,keys,choicesFromRecipe(entry.recipe));let prior={};
    for(const row of r.rows){
      const compatible=candidates(catalog,keys,true).filter(e=>Object.entries(prior).every(([engine,choice])=>{const r=e.recipe.replacements.find(r=>r.engine===engine);return r.original===choice.original&&r.variant===choice.variant;}));
      for(const o of row.originals)assert(compatible.some(e=>e.recipe.replacements.some(r=>r.engine===row.engine&&r.original===o.key)));
      for(const variant of row.variants)assert(compatible.some(e=>e.recipe.replacements.some(r=>r.engine===row.engine&&r.original===row.original&&r.variant===variant)));
      prior[row.engine]={original:row.original,variant:row.variant};
    }
  }
});

test('multiple options require a choice; a unique original and version resolve automatically',()=>{
  const phase=resolveSelection(catalog,['phase_distortion']);assert(phase.rows[0].originals.length>1);assert.equal(phase.choices.phase_distortion.original,null);assert.equal(phase.entry,null);
  const chip=resolveSelection(catalog,['chiptune']);assert.equal(chip.rows[0].originals.length,1);assert.equal(chip.entry.recipe.replacements[0].original,'chords');
  const terrain=resolveSelection(catalog,['wave_terrain'],{wave_terrain:{original:'formant',variant:null}});assert(terrain.rows[0].variants.length>1);assert.equal(terrain.choices.wave_terrain.variant,null);assert.equal(terrain.entry,null);
});

test('changing destination preserves a valid variant and clears an incompatible one',()=>{
  const r=resolveSelection(catalog,['phase_distortion'],{phase_distortion:{original:'wavetable',variant:'aux'}});
  assert(r.cleared.some(x=>x.field==='original'));assert(r.cleared.some(x=>x.field==='variant'));assert.equal(r.entry,null);
  const terrain=resolveSelection(catalog,['wave_terrain'],{wave_terrain:{original:'modal',variant:'aux'}});
  assert.equal(terrain.entry.recipe.replacements[0].variant,'aux');
});

test('partial selections roundtrip without pretending to be complete firmware recipes',()=>{
  const resolved=resolveSelection(catalog,['phase_distortion']);
  const draft=selectionFile(catalog,resolved.engines,resolved.choices);
  assert.deepEqual(validateSelectionFile(catalog,JSON.parse(JSON.stringify(draft))),draft);
  assert(selectionAvailable(catalog,draft.engines,draft.choices));assert.equal(resolved.entry,null);
});

test('unsupported but structurally valid selection stays distinguishable from invalid input',()=>{
  const value=selectionFile(catalog,['phase_distortion'],{phase_distortion:{original:'wavetable',variant:'normal'}});
  assert.deepEqual(validateSelectionFile(catalog,value),value);assert.equal(selectionAvailable(catalog,value.engines,value.choices),false);
  for(const bad of [{...value,engines:['unknown']},{...value,engines:['swarm','swarm']},{...value,choices:{phase_distortion:{original:'vocoder',variant:'normal'}}},{...value,extra:true}])assert.throws(()=>validateSelectionFile(catalog,bad));
});
