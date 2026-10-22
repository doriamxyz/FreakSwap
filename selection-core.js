export const DESCRIPTIONS = {
  phase_distortion:'Phase distortion for sounds ranging from smooth to gritty.',
  classic_waves_vcf:'Classic waveforms with a filter.', swarm:'A swarm of detuned oscillators.',
  inharmonic_string:'Strings with metallic, inharmonic resonances.',
  particle_noise:'Noise particles and resonances.', filtered_noise:'Noise shaped by filters.',
  string_machine:'Chords and string synthesizer textures.', chiptune:'Video game-style waveforms and arpeggios.',
  bass_drum:'Synthesized bass drum.', snare_drum:'Synthesized snare drum.', wave_terrain:'Explore five wave terrains to shape your sound.'
};
export const VARIANT_NAMES = {normal:'Main',aux:'Alternative (AUX)',dual_band:'Two-band (AUX)'};
const VARIANT_ORDER = ['normal','aux','dual_band'];
export function engineName(catalog, key) {
  const row = catalog.combinations.flatMap(e => e.replacements).find(r => r.engine === key);
  return row?.engine_name.replace(' · 5 terrains','').replace(' v2','') || key;
}
export function orderedEngines(catalog, engines) {
  if (!Array.isArray(engines) || new Set(engines).size !== engines.length || engines.some(e => !catalog.engines.includes(e))) throw new Error('The selection contains unknown or duplicate engines.');
  return catalog.engines.filter(e => engines.includes(e));
}
export function candidates(catalog, engines, exact = true) {
  const keys = orderedEngines(catalog,engines);
  return catalog.combinations.filter(entry => (!exact || entry.recipe.replacements.length === keys.length) && keys.every(key => entry.recipe.replacements.some(r => r.engine === key)));
}
export function availableEngines(catalog, engines = []) {
  const keys = orderedEngines(catalog,engines);
  return catalog.engines.filter(key => keys.includes(key) || candidates(catalog,[...keys,key],false).length > 0);
}
export function completionOptions(catalog, engines) {
  const keys = orderedEngines(catalog,engines);
  if (!keys.length) return [];
  const seen = new Set();
  return candidates(catalog,keys,false).map(entry => orderedEngines(catalog,entry.recipe.replacements.map(r=>r.engine)))
    .filter(group => group.length > keys.length)
    .sort((a,b)=>a.length-b.length || a.join(',').localeCompare(b.join(',')))
    .filter(group => {const id=group.join(',');if(seen.has(id))return false;seen.add(id);return true;});
}
export function resolveSelection(catalog, engines, previous = {}) {
  const keys = orderedEngines(catalog,engines), exact = keys.length ? candidates(catalog,keys,true) : [];
  const retained = Object.fromEntries(keys.filter(key=>previous[key]).map(key=>[key,previous[key]]));
  if (!exact.length) return {engines:keys,choices:retained,rows:[],cleared:[],entry:null,canContinue:false};
  let pool = exact;
  const choices = {}, rows = [], cleared = [];
  for (const engine of keys) {
    const getRow = entry => entry.recipe.replacements.find(r => r.engine === engine);
    const originals = catalog.originals.filter(o => pool.some(e => getRow(e).original === o.key));
    const old = previous[engine] || {};
    let original = originals.some(o => o.key === old.original) ? old.original : null;
    if (old.original && !original) cleared.push({engine,field:'original'});
    if (!original && originals.length === 1) original = originals[0].key;
    if (original) pool = pool.filter(e => getRow(e).original === original);
    const variants = VARIANT_ORDER.filter(v => pool.some(e => getRow(e).variant === v));
    let variant = original && variants.includes(old.variant) ? old.variant : null;
    if (old.variant && !variant) cleared.push({engine,field:'variant'});
    if (original && !variant && variants.length === 1) variant = variants[0];
    if (variant) pool = pool.filter(e => getRow(e).variant === variant);
    choices[engine] = {original,variant};
    rows.push({engine,originals,variants,original,variant});
  }
  const complete = Boolean(keys.length && exact.length && keys.every(e => choices[e].original && choices[e].variant));
  return {engines:keys,choices,rows,cleared,entry:complete ? pool[0] || null : null,canContinue:Boolean(keys.length && exact.length)};
}
export function choicesFromRecipe(recipe) {
  return Object.fromEntries(recipe.replacements.map(r => [r.engine,{original:r.original,variant:r.variant}]));
}
export function selectionFile(catalog, engines, choices) {
  return {format:'microfreak.lite-selection',version:1,firmware:{version:catalog.base.version,sha256:catalog.base.sha256},engines:orderedEngines(catalog,engines),choices};
}
export function validateSelectionFile(catalog, value) {
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  const keys = (v,names) => object(v) && Object.keys(v).sort().join(',') === [...names].sort().join(',');
  if (!keys(value,['format','version','firmware','engines','choices']) || value.format !== 'microfreak.lite-selection' || value.version !== 1 || !keys(value.firmware,['version','sha256']) || value.firmware.version !== catalog.base.version || value.firmware.sha256 !== catalog.base.sha256 || !object(value.choices)) throw new Error('The file does not contain a valid MicroFreak Lite selection.');
  const engines = orderedEngines(catalog,value.engines);
  if (Object.keys(value.choices).some(e => !engines.includes(e))) throw new Error('The selection contains replacements for engines that were not selected.');
  const choices = {};
  for (const engine of engines) {
    const row = Object.prototype.hasOwnProperty.call(value.choices,engine) ? value.choices[engine] : {original:null,variant:null};
    const variants = engine === 'wave_terrain' ? ['normal','aux'] : engine === 'filtered_noise' ? ['normal','dual_band'] : ['normal'];
    if (!keys(row,['original','variant']) || (row.original !== null && !catalog.originals.some(o => o.key === row.original && o.key !== 'vocoder')) || (row.variant !== null && !variants.includes(row.variant))) throw new Error('The selection contains an invalid replacement or version.');
    choices[engine] = {original:row.original,variant:row.variant};
  }
  return selectionFile(catalog,engines,choices);
}
export function selectionAvailable(catalog, engines, choices) {
  return engines.length > 0 && candidates(catalog,engines,false).some(entry => engines.every(engine => {
    const row = entry.recipe.replacements.find(r => r.engine === engine), selected = choices[engine] || {};
    return (!selected.original || selected.original === row.original) && (!selected.variant || selected.variant === row.variant);
  }));
}
