import {sha256} from './patch-core.js';
import {recipeKey, normalizeRecipe} from './recipe-core.js';
import {CATALOG_SHA256} from './release.js';
import {DESCRIPTIONS,VARIANT_NAMES,engineName,orderedEngines,availableEngines,resolveSelection,choicesFromRecipe,selectionFile,validateSelectionFile,selectionAvailable} from './selection-core.js';

const $ = id => document.getElementById(id);
const DRAFT_KEY = 'microfreak-public-lite-draft-v1';
const LEGACY_KEY = 'microfreak-public-lite-combination-v1';
const state = {catalog:null,names:{},engines:[],choices:{},resolved:null,step:1,selected:null,imported:null,file:null,worker:null,workerReject:null,controller:null,epoch:0,resultURL:null,busy:false};
const node = (tag,text='',className='') => {const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
function notice(message,error=false) {$('notice').textContent=message;$('notice').classList.toggle('error',error);}
function name(key) {return state.names[key] || key;}
function assetURL(path) {
  const url = new URL(path,location.href), root = new URL('./',location.href);
  if (typeof path !== 'string' || !path.startsWith('catalog/') || url.origin !== root.origin || !url.pathname.startsWith(root.pathname+'catalog/') || url.search || url.hash) throw new Error('Invalid file reference.');
  return url;
}
async function verifiedAsset(asset,signal) {
  const response=await fetch(assetURL(asset.url),{signal,cache:'no-store'});
  if (!response.ok) throw new Error('Could not download a file. Please try again.');
  const buffer=await response.arrayBuffer();
  if ((asset.size!==undefined && buffer.byteLength!==asset.size) || await sha256(buffer)!==asset.sha256) throw new Error('Could not verify the file. Please reload the page.');
  return buffer;
}
function resetResult() {
  state.epoch++;
  state.controller?.abort();state.controller=null;
  state.worker?.terminate();state.worker=null;
  state.workerReject?.(new Error('Preparation canceled.'));state.workerReject=null;
  if (state.resultURL) URL.revokeObjectURL(state.resultURL);
  state.resultURL=null;state.busy=false;
  $('result').hidden=true;$('progress').hidden=true;$('generate').hidden=false;
  syncButtons();
}
function syncButtons() {
  $('next-engines').disabled=!state.resolved?.canContinue;
  $('next-placements').disabled=!state.selected;
  $('clear-engines').disabled=!state.engines.length && !state.imported;
  $('generate').disabled=!state.selected || !state.file || state.busy;
  $('export-recipe').disabled=!state.engines.length && !state.imported;
  $('download-guide').disabled=!state.selected;
  $('download-recipe').disabled=!state.selected;
}
function saveDraft() {
  if (!state.catalog) return;
  try {localStorage.setItem(DRAFT_KEY,JSON.stringify({version:1,selection:selectionFile(state.catalog,state.engines,state.choices),step:state.step,unavailable:state.imported}));} catch {}
}
function updateResolution() {
  state.resolved=resolveSelection(state.catalog,state.engines,state.choices);
  state.engines=state.resolved.engines;state.choices=state.resolved.choices;state.selected=state.imported?null:state.resolved.entry;
  return state.resolved.cleared;
}
function renderEngines() {
  $('engine-count').textContent=state.engines.length ? 'One engine selected':'None selected';
  $('engine-cards').replaceChildren(...availableEngines(state.catalog,state.engines).map(key=>{
    const selected=state.engines.includes(key),card=node('article','',selected?'engine-card selected':'engine-card');card.dataset.engine=key;
    const heading=node('h3',name(key)),description=node('p',DESCRIPTIONS[key],'small'),button=node('button',selected?'Selected':'Choose','quiet');
    button.id='engine-'+key;button.type='button';button.setAttribute('aria-label',`${selected?'Selected':'Choose'} ${name(key)}`);button.setAttribute('aria-pressed',String(selected));button.dataset.engine=key;
    button.addEventListener('click',()=>changeEngines([key],button.id));
    card.append(heading,description,button);return card;
  }));

}
function renderPlacements() {
  $('placement-rows').replaceChildren(...state.resolved.rows.map(row=>{
    const card=node('div','','placement-row');card.dataset.engine=row.engine;
    const title=node('h3',name(row.engine));title.id='placement-title-'+row.engine;title.tabIndex=-1;card.append(title);
    const fields=node('div','','placement-fields');
    if (row.originals.length===1) {
      const text=node('p','Replaces ','fixed-placement'),strong=node('strong',row.originals[0].name);text.append(strong);text.dataset.original=row.original;fields.append(text);
    } else {
      const label=node('label','Replaces…'),select=document.createElement('select');select.id='placement-'+row.engine;label.htmlFor=select.id;select.dataset.engine=row.engine;
      select.setAttribute('aria-label','Original engine for '+name(row.engine));select.append(new Option('Choose an original engine…',''),...row.originals.map(o=>new Option(o.name,o.key)));select.value=row.original || '';
      select.addEventListener('change',()=>changeChoice(row.engine,'original',select.value || null,select.id));fields.append(label,select);
    }
    if (row.original && row.variants.length>1) {
      const label=node('label','Version'),select=document.createElement('select');select.id='variant-'+row.engine;label.htmlFor=select.id;select.dataset.engine=row.engine;
      select.setAttribute('aria-label','Version of '+name(row.engine));select.append(new Option('Choose a version…',''),...row.variants.map(v=>new Option(VARIANT_NAMES[v],v)));select.value=row.variant || '';
      select.addEventListener('change',()=>changeChoice(row.engine,'variant',select.value || null,select.id));fields.append(label,select);
    } else if (row.original && row.variant && row.variant!=='normal') fields.append(node('p',VARIANT_NAMES[row.variant],'small fixed-variant'));
    card.append(fields);return card;
  }));
}
function renderSummary() {
  $('replacements').replaceChildren(...(state.selected?.replacements || []).map(row=>{
    const li=node('li'),original=node('span',row.original_name),arrow=node('span','→','arrow'),engine=node('span',name(row.engine),'engine');arrow.setAttribute('aria-hidden','true');
    if (row.variant!=='normal') engine.append(node('small',VARIANT_NAMES[row.variant]));li.append(original,arrow,engine);return li;
  }));
}
function render(focusId=null) {
  renderEngines();renderPlacements();renderSummary();
  for (let step=1;step<=3;step++) {
    $('step-'+step).hidden=state.step!==step;
    const item=document.querySelector(`.wizard-nav [data-step="${step}"]`);item.classList.toggle('active',state.step===step);item.classList.toggle('done',state.step>step);
    if (state.step===step) item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
  }
  $('unpublished').hidden=!state.imported;syncButtons();saveDraft();
  if (focusId) {
    const target=$(focusId) || $('placement-title-'+focusId.replace(/^(placement|variant)-/,''));
    (target && !target.disabled ? target : $('engines-title')).focus({preventScroll:true});
  }
}
function changeEngines(engines,focusId=null) {
  resetResult();state.imported=null;state.choices=engines[0]===state.engines[0]?state.choices:{};state.engines=orderedEngines(state.catalog,engines);state.step=1;
  updateResolution();render(focusId);
  notice(state.engines.length?'Engine selected. Continue to choose which original to replace.':'Choose the new engine you want.');
}
function changeChoice(engine,field,value,focusId) {
  resetResult();state.imported=null;state.choices[engine]={...state.choices[engine],[field]:value};
  updateResolution();render(focusId);
  notice(state.selected?'Replacement selected. Continue to prepare your firmware.':'Choose an original engine and an available version.');
}
function setStep(step,focus=true) {
  if ((step===2&&!state.resolved?.canContinue)||(step===3&&!state.selected)) return;
  if (state.busy) resetResult();state.step=step;render();
  notice(step===1?'Choose the new engine you want.':step===2?'Choose which original engine to replace.':'Review your change and choose the official firmware.');
  if (focus) $({1:'engines-title',2:'placements-title',3:'firmware-title'}[step]).focus();
}
function download(buffer,filename,type) {
  const url=URL.createObjectURL(new Blob([buffer],{type})),link=node('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function exportRecipe() {
  if (!state.catalog) return;
  const value=state.imported || state.selected?.recipe || selectionFile(state.catalog,state.engines,state.choices);
  if (state.engines.length || state.imported) download(JSON.stringify(value,null,2)+'\n','microfreak-lite-selection.json','application/json');
}
async function documentDownload(field,filename,type) {
  const entry=state.selected,epoch=state.epoch;if (!entry) return;
  try {const bytes=await verifiedAsset(entry[field]);if (epoch===state.epoch&&entry===state.selected) download(bytes,filename,type);} catch(error) {if(epoch===state.epoch) notice(error.message,true);}
}
function validateUnavailable(value) {
  if(value?.format==='microfreak.lite-catalog-reference' && value.version===1 && /^[a-f0-9]{64}$/.test(value.id) && Object.keys(value).sort().join(',')==='format,id,version') return value;
  return validateSelectionFile(state.catalog,value);
}
function restoreRecipe(recipe) {
  state.engines=orderedEngines(state.catalog,recipe.replacements.map(r=>r.engine));state.choices=choicesFromRecipe(recipe);state.imported=null;updateResolution();state.step=3;
}
async function importRecipe(file) {
  if (!file) return;const epoch=state.epoch;
  try {
    if (file.size>262144) throw new Error('The selection file is too large.');
    const value=JSON.parse(await file.text());if(epoch!==state.epoch) return;
    let recipe=null,draft=null,entry=null;
    if (value.format==='microfreak.firmware-recipe') {
      recipe=normalizeRecipe(value,state.catalog.base);const key=recipeKey(recipe,state.catalog.base);entry=state.catalog.combinations.find(e=>recipeKey(e.recipe,state.catalog.base)===key);
    } else draft=validateUnavailable(value);
    resetResult();
    if (entry) {restoreRecipe(recipe);render();notice('Selection loaded. Review your change before preparing the firmware.');}
    else if (draft?.engines && (!draft.engines.length || selectionAvailable(state.catalog,draft.engines,draft.choices))) {
      state.engines=draft.engines;state.choices=draft.choices;state.imported=null;updateResolution();state.step=state.selected?3:state.resolved.canContinue?2:1;render();notice('Selection loaded. Continue where you left off.');
    } else {
      state.engines=[];state.choices={};state.imported=recipe || draft;state.step=1;updateResolution();render();notice('This selection is not available in this version. You can save it or choose another engine.');
    }
  } catch(error) {if(epoch===state.epoch) notice(error instanceof SyntaxError?'The file does not contain a valid JSON selection. Your choices have been kept.':error.message+' Your choices have been kept.',true);}
  finally {$('recipe-input').value='';}
}
async function prepareFirmware() {
  if (!state.selected||!state.file||state.busy) return;resetResult();
  const epoch=state.epoch,entry=state.selected,file=state.file;state.busy=true;syncButtons();$('generate').hidden=true;$('progress').hidden=false;state.controller=new AbortController();
  try {
    if (file.size!==entry.base.size) throw new Error('The file size does not match the official 5.0.0.2084 firmware.');
    const [base,patch]=await Promise.all([file.arrayBuffer(),verifiedAsset(entry.patch,state.controller.signal)]);if(epoch!==state.epoch) return;
    const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});state.worker=worker;
    const result=await new Promise((resolve,reject)=>{state.workerReject=reject;worker.onmessage=({data})=>{if(data.id===epoch) data.error?reject(new Error(data.error)):resolve(data.result);};worker.onerror=()=>reject(new Error('Could not start firmware preparation in your browser.'));worker.postMessage({id:epoch,base,patch,entry},[base,patch]);});
    if(epoch!==state.epoch||entry!==state.selected) return;
    worker.terminate();state.worker=null;state.workerReject=null;state.controller=null;state.busy=false;state.resultURL=URL.createObjectURL(new Blob([result],{type:'application/octet-stream'}));
    $('progress').hidden=true;$('result').hidden=false;$('generate').hidden=true;notice('Firmware ready to download.');syncButtons();
  } catch(error) {if(epoch===state.epoch){resetResult();notice(error.message,true);}}
}
$('next-engines').addEventListener('click',()=>setStep(2));$('next-placements').addEventListener('click',()=>setStep(3));
$('back-placements').addEventListener('click',()=>setStep(1));$('back-firmware').addEventListener('click',()=>setStep(2));$('edit-engines').addEventListener('click',()=>setStep(1));
$('clear-engines').addEventListener('click',()=>changeEngines([], 'clear-engines'));
$('recipe-input').addEventListener('change',()=>importRecipe($('recipe-input').files[0]));
$('firmware-input').addEventListener('change',()=>{
  resetResult();state.file=$('firmware-input').files[0] || null;$('file-label').textContent=state.file?state.file.name+' · '+(state.file.size/1024).toFixed(0)+' KB':'Your file is processed on this device.';
  if (state.file&&state.file.size!==state.catalog.base.size){notice('This file has a different size from the required official firmware.',true);state.file=null;}
  else if(state.file) notice('File selected. You can now prepare your firmware.');syncButtons();
});
$('export-recipe').addEventListener('click',exportRecipe);$('download-recipe').addEventListener('click',exportRecipe);
$('download-guide').addEventListener('click',()=>documentDownload('guide','INSTALLATION-GUIDE.md','text/markdown'));
$('generate').addEventListener('click',prepareFirmware);$('cancel').addEventListener('click',()=>{resetResult();notice('Preparation canceled. Your choices have been kept.');});
$('download-firmware').addEventListener('click',()=>{if(state.resultURL&&state.selected){const link=node('a');link.href=state.resultURL;link.download=state.selected.result.filename;document.body.append(link);link.click();link.remove();}});
window.addEventListener('pagehide',()=>{saveDraft();resetResult();state.file=null;});
async function init() {
  try {
    if(!crypto.subtle||!window.Worker) throw new Error('Use an up-to-date browser and open the tool from its website.');
    const response=await fetch('catalog.json',{cache:'no-store'});if(!response.ok) throw new Error('Could not load the engines.');
    const buffer=await response.arrayBuffer();if(await sha256(buffer)!==CATALOG_SHA256) throw new Error('Could not load the engines. Please reload the page.');
    const catalog=JSON.parse(new TextDecoder().decode(buffer));if(catalog.format!=='microfreak.public-lite-catalog'||catalog.version!==1||!catalog.combinations.length||catalog.combinations.some(e=>e.recipe.replacements.length!==1)) throw new Error('Could not load the engines.');
    state.catalog=catalog;for(const entry of catalog.combinations) normalizeRecipe(entry.recipe,catalog.base);
    state.names=Object.fromEntries(catalog.engines.map(key=>[key,engineName(catalog,key)]));
    let recovered=false,recoveryError=false;
    try {
      const raw=localStorage.getItem(DRAFT_KEY);
      if(raw){const saved=JSON.parse(raw);if(saved.version!==1) throw new Error('Invalid draft.');const draft=validateSelectionFile(catalog,saved.selection);
        if(!draft.engines.length||selectionAvailable(catalog,draft.engines,draft.choices)){state.engines=draft.engines;state.choices=draft.choices;updateResolution();state.step=[1,2,3].includes(saved.step)?saved.step:1;if(state.step===3&&!state.selected) state.step=state.resolved.canContinue?2:1;if(state.step===2&&!state.resolved.canContinue) state.step=1;recovered=Boolean(state.engines.length);} else {state.imported=draft;state.step=1;}
        if(saved.unavailable){state.imported=saved.unavailable.format==='microfreak.firmware-recipe'?normalizeRecipe(saved.unavailable,catalog.base):validateUnavailable(saved.unavailable);state.step=1;}
      } else {const entry=catalog.combinations.find(e=>e.id===localStorage.getItem(LEGACY_KEY));if(entry){restoreRecipe(entry.recipe);state.step=1;recovered=true;}else{const id=localStorage.getItem(LEGACY_KEY);if(id&&/^[a-f0-9]{64}$/.test(id))state.imported={format:'microfreak.lite-catalog-reference',version:1,id};}}
    } catch {recoveryError=true;state.engines=[];state.choices={};state.step=1;state.imported=null;}
    updateResolution();render();$('recipe-input').disabled=false;$('firmware-input').disabled=false;
    notice(recoveryError?'Could not restore your previous selection. Please choose an engine again.':state.imported?'This selection is not available in this version. You can save it or choose another engine.':recovered?'Your choices have been restored. You can keep editing them.':'Choose the new engine you want.');
  } catch(error) {notice(error.message || 'Could not start the tool.',true);}
}
init();
