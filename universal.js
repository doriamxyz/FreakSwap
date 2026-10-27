import {hasRaster,planRaster,composeRaster} from './native-sample.js?raster-20261026';
import {verifyUniversal} from './verify-universal.js?raster-20261026';
// One overlay ABI, conditional ownership and joint placement for the whole selection.
import {FLASH_BASE,META,hash,linkModule,branch,configurationBridge} from './compose.js?raster-20261026';
const enc=s=>new TextEncoder().encode(s),view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength),align=(n,a=4)=>Math.ceil(n/a)*a;
const error=(code,message,details={})=>{const e=new Error(message);e.code=code;e.details=details;throw e;};
const words=values=>{const b=new Uint8Array(values.length*4);values.forEach((n,i)=>view(b).setUint32(i*4,n,true));return b;};
const abiKey=a=>a.module+':'+(a.root_indices||[0,1,2,3]).join(',');
const same=(a,b)=>a.length===b.length&&a.every((n,i)=>n===b[i]);
export function universalAdapters(library){
 const rows=[];for(const [original,host] of Object.entries(library.hosts)){
  for(const e of Object.values(library.engines)){if(e.native_sample){if(original===e.original)rows.push({...host,...e,id:host.id,original,native_alias:false,portable:false});continue;}if(e.abi!==host.abi||e.object_bytes>host.object_limit||e.scratch_bytes>library.limits.arena_per_voice)continue;rows.push({...e,...host,original,native_alias:true,portable:true});}
  rows.push({...host,original,engine:'empty',variant:'normal',name:'Empty · release space',labels:['Empty','','',''],module:library.retirement_module,object_bytes:0,scratch_bytes:0,continuous_controls:true,reset_on_activation:false,native_alias:true,empty:true});
 }return rows;
}
export function universalSelection(library,recipe){
 if(!Array.isArray(recipe)||!recipe.length||recipe.length>library.limits.maximum_engines)error('selection','Choose at least one replacement.');
 const families=new Set(),originals=new Set(),available=universalAdapters(library);
 const selected=recipe.map(r=>{if(!r||Object.keys(r).sort().join(',')!=='engine,original,variant')error('selection','Invalid replacement selection.');if(originals.has(r.original)||(r.engine!=='empty'&&families.has(r.engine)))error('selection','Engines and originals cannot be repeated.');originals.add(r.original);if(r.engine!=='empty')families.add(r.engine);
  const a=available.find(a=>a.engine===r.engine&&a.original===r.original&&a.variant===r.variant);if(!a)error('selection','Unknown engine, variant or original.');return a;});
 return selected.sort((a,b)=>a.id-b.id);
}
export function poolRegions(library,selected){
 const retired=new Set(selected.map(a=>a.original)),native=selected.some(a=>a.native_sample),rows=[...library.regions.filter(r=>r.owners.every(k=>retired.has(k))&&!(native&&r.owners.includes('sample'))).map(r=>[r.start,r.end]),...(native?library.extensions.raster.windows.map(r=>[r.start,r.end]):[])].sort((a,b)=>a[0]-b[0]);const union=[];
 for(const [a,b] of rows){const last=union.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else union.push([a,b]);}return union;
}
function screenBridge(selected){
 const n=2+selected.length*6+2+4,b=new Uint8Array(align(n)+4),v=view(b);let at=0;v.setUint16(at,0xb200,true);at+=2;
 for(const a of selected){v.setUint16(at,0x2800|a.id,true);v.setUint16(at+2,0xbf08,true);v.setUint16(at+4,0x2000|(a.continuous_controls?9:10),true);at+=6;}
 v.setUint16(at,0x3801,true);at+=2;const literal=b.length-4,delta=literal-Math.floor((at+4)/4)*4;v.setUint16(at,0xf8df,true);v.setUint16(at+2,0xf000|delta,true);at+=4;if(at<literal)v.setUint16(at,0xbf00,true);v.setUint32(literal,0x0804df9b,true);return b;
}
export function planUniversal(library,recipe,modules,{searchLimit=1000000}={}){
 if(hasRaster(recipe))return planRaster(library,recipe,modules,{searchLimit},planUniversal,universalSelection);
 const selected=universalSelection(library,recipe),regions=poolRegions(library,selected),sections=[],moduleMaps={};
 function add(data,alignment=4,relocations=[]){const id=sections.length;sections.push({id,size:data.length,alignment,data:btoa(String.fromCharCode(...data)),relocations});return id;}
 const needed=[...new Set([...(selected.some(a=>a.twist)?[library.extensions.twist.module]:[]),...selected.flatMap(a=>[a.module,...(a.resources||[])]),library.bridge.module,...(selected.some(a=>a.retired_table)?[library.retirement_module]:[])])].sort();
 for(const id of needed){const m=modules[id];if(!m)error('module','Missing reusable module.');const offset=sections.length,map=t=>Object.hasOwn(t,'external')?{...t}:{...t,section:t.section+offset};moduleMaps[id]={offset,roots:m.roots.map(map)};for(const s of m.sections)sections.push({...s,id:s.id+offset,relocations:s.relocations.map(r=>({...r,target:map(r.target)}))});}
 const tableSections={},labelSections={};for(const a of selected)if(!Object.hasOwn(tableSections,abiKey(a)))tableSections[abiKey(a)]=add(new Uint8Array(16));
 for(const a of selected)labelSections[a.id]=add(enc(a.labels.join('\0')+'\0'),1);
 const twistLabelSections={};for(const a of selected)if(a.twist)twistLabelSections[a.id]=add(enc(a.twist.label+'\0'),1);
 const config=add(configurationBridge([...selected.map(a=>a.id),...(selected.some(a=>a.id===11)?[23]:[])],0)),screen=add(screenBridge(selected)),route=add(Uint8Array.from(library.bridge.route_hex.match(/../g),x=>parseInt(x,16)));
 const synthetic={format:'freakswap.arm-module',version:1,sections,roots:moduleMaps[library.bridge.module].roots},required=sections.reduce((n,s)=>n+s.size,0),available=regions.reduce((n,[a,b])=>n+b-a,0);
 if(!regions.length||required>available)error('space',`This selection needs ${required} bytes. Verified reusable space from the selected originals: ${available} bytes. Replacing a position does not always free code. Choose Empty for another original, or use fewer replacements.`,{required,available});
 let linked;try{linked=linkModule(synthetic,regions,{searchLimit});}catch(e){if(/budget/.test(e.message))error('search_budget','The placement search reached its limit. No firmware was generated; this does not prove the selection is impossible.',{required,available});error('fragmentation','The selected code does not fit the released regions. Choose Empty for another original to release more space.',{required,available});}
 const address=t=>Object.hasOwn(t,'external')?t.external:FLASH_BASE+linked.placements[t.section].start+t.value;
 return {selected,regions,required,available,linked,sections,moduleMaps,tableSections,labelSections,twistLabelSections,config,screen,route,address};
}
export async function composeUniversal(base,library,recipe,modules,options={}){
 if(hasRaster(recipe))return composeRaster(base,library,recipe,modules,options,planUniversal,composeUniversal,universalSelection);
 if(!(base instanceof Uint8Array)||base.length!==library.base.raw_size||await hash(base)!==library.base.raw_sha256)error('base','The raw official firmware is incorrect.');
 for(const id of new Set([...(universalSelection(library,recipe).some(a=>a.twist)?[library.extensions.twist.module]:[]),...universalSelection(library,recipe).flatMap(a=>[a.module,...(a.resources||[])]),library.bridge.module,library.retirement_module])){const m=modules[id];if(!m||await hash(enc(JSON.stringify(m,null,2)+'\n'))!==id)error('module','Module content failed verification.');}
 const p=planUniversal(library,recipe,modules,options),{linked,address,selected}=p,image=base.slice(),edits=[],links=[],spec=library.bridge,retired=new Set(selected.map(a=>a.original));
 for(const region of library.regions.filter(r=>r.owners.every(k=>retired.has(k))))if(await hash(base.slice(region.start,region.end))!==region.sha256)error('ownership','The retired code region does not match the ownership audit.');
 function chunkAt(raw,size){const c=linked.chunks.find(c=>raw>=c.start&&raw+size<=c.end);if(!c)error('bounds','Generated data is outside its placement.');return [c,raw-c.start];}
 function patchLinked(raw,data){const [c,o]=chunkAt(raw,data.length);c.data.set(data,o);}
 const moduleRoots=a=>(a.root_indices||[0,1,2,3]).map(i=>address(p.moduleMaps[a.module].roots[i]));
 const abi=a=>{const roots=moduleRoots(a);return words([roots[0]|1,(a.reset_on_activation?roots[1]:roots[2])|1,roots[3]|1,roots[1]|1]);};
 for(const [key,section] of Object.entries(p.tableSections))patchLinked(linked.placements[section].start,abi(selected.find(a=>abiKey(a)===key)));
 const roots=p.moduleMaps[spec.module].roots.map(address),bindingRaw=roots[spec.bindings_root]-FLASH_BASE,bindings=new Array(23).fill(0);
 for(const a of selected){const table=linked.placements[p.tableSections[abiKey(a)]].start;a.runtime_vtable=table;bindings[a.id]=FLASH_BASE+table;links.push({adapter:a,roots:moduleRoots(a),vtable:table,placements:linked.placements,chunks:[]});}
 const [bindingChunk,bindingOffset]=chunkAt(bindingRaw,92);if(bindingChunk.data.slice(bindingOffset,bindingOffset+92).some(x=>x))error('bridge','Shared binding data was not initially empty.');patchLinked(bindingRaw,words(bindings));
 const sixop=selected.some(a=>a.sixop_bank!==undefined)?library.extensions?.sixop:null;
 let sixopRoots=null;if(sixop){sixopRoots=p.moduleMaps[sixop.module].roots.map(address);const banks=new Array(23).fill(0);for(const a of selected)if(a.sixop_bank!==undefined){banks[a.id]=a.sixop_bank+1;a.runtime_boot=sixopRoots[sixop.boot_init_root];}const models=sixopRoots[sixop.models_root]-FLASH_BASE;for(const a of selected)if(a.sixop_bank!==undefined)a.runtime_models_raw=models;const [bc,bo]=chunkAt(models,92);if(bc.data.slice(bo,bo+92).some(x=>x))error('extension','Six-OP model bindings were not empty.');patchLinked(models,words(banks));const payloads=new Array(12).fill(0);for(const a of selected)if(a.sixop_bank!==undefined){const id=sixop.bank_modules[String(a.sixop_bank)],roots=p.moduleMaps[id].roots.map(address);for(let j=0;j<4;j++)payloads[a.sixop_bank*4+j]=roots[j];}const bankRaw=sixopRoots[sixop.banks_root]-FLASH_BASE;const [resourceChunk,resourceOffset]=chunkAt(bankRaw,48);if(resourceChunk.data.slice(resourceOffset,resourceOffset+48).some(x=>x))error('extension','Six-OP resource bindings were not empty.');patchLinked(bankRaw,words(payloads));}
 const twist=selected.some(a=>a.twist)?library.extensions.twist:null;let twistRoots=null;
 if(twist){
  twistRoots=p.moduleMaps[twist.module].roots.map(address);
  const models=new Array(69).fill(0);for(const a of selected)if(a.twist){models[a.id*3]=a.twist.index+1;models[a.id*3+1]=FLASH_BASE+linked.placements[p.labelSections[a.id]].start;models[a.id*3+2]=FLASH_BASE+linked.placements[p.twistLabelSections[a.id]].start;}
  const modelRaw=twistRoots[twist.models_root]-FLASH_BASE;const [mc,mo]=chunkAt(modelRaw,276);if(mc.data.slice(mo,mo+276).some(x=>x))error('extension','TWIST model bindings were not empty.');patchLinked(modelRaw,words(models));
  const next=sixop?[sixopRoots[sixop.boot_root],...sixop.hooks.slice(0,3).map(h=>sixopRoots[h.root]),sixopRoots[17],sixopRoots[18],sixopRoots[sixop.boot_init_root]]:new Array(7).fill(0);
  const nextRaw=twistRoots[twist.next_root]-FLASH_BASE;const [nc,no]=chunkAt(nextRaw,28);if(nc.data.slice(no,no+28).some(x=>x))error('extension','TWIST continuation bindings were not empty.');patchLinked(nextRaw,words(next));
  for(const a of selected)a.runtime_boot=twistRoots[14];
 }
 const routeRaw=linked.placements[p.route].start,routeBytes=Uint8Array.from(spec.route_hex.match(/../g),x=>parseInt(x,16));view(routeBytes).setUint32(spec.route_binding_offset,FLASH_BASE+bindingRaw,true);patchLinked(routeRaw,routeBytes);
 const configRaw=linked.placements[p.config].start;patchLinked(configRaw,configurationBridge([...selected.map(a=>a.id),...(retired.has('speech')?[23]:[])],configRaw));
 const screenRaw=linked.placements[p.screen].start;
 const vocoderGates=[0x28f50,0x28f5c,0x28f68,0x28fd8,0x2903e,0x29048];
 const allowed=[...p.regions,...(retired.has('vocoder')?[[0x2a86e,0x2a876],...vocoderGates.map(a=>[a,a+2])]:[]),[0x23ea4,0x23ea8],[0x41f96,0x41f9a],[0x5366c,0x5366e],[0x53450,0x53454],[spec.dispatch_hook,spec.dispatch_hook+4],[spec.init_hook,spec.init_hook+4],[spec.parameter_hook,spec.parameter_hook+4],...selected.flatMap(a=>[[META+a.id*28,META+(a.id+1)*28],...(a.retired_table?[[a.retired_table,a.retired_table+16]]:[])])];
 if(twist)allowed.push(...twist.hooks.map(h=>[h.raw,h.raw+4]),...twist.stack_words.map(a=>[a,a+4]),[twist.boot_call,twist.boot_call+4]);
 if(sixop)allowed.push(...sixop.hooks.map(h=>[h.raw,h.raw+4]),...sixop.stack_words.map(a=>[a,a+4]),[sixop.boot_call,sixop.boot_call+4]);
 const families=library.native_families.filter(f=>f.owners.every(k=>retired.has(k)));allowed.push(...families.map(f=>[f.render_cell,f.render_cell+4]));
 function replace(start,data,purpose){if(!data.length)return;if(!allowed.some(([a,b])=>start>=a&&start+data.length<=b)||edits.some(e=>start<e.end&&start+data.length>e.start))error('bounds','Firmware writes exceed the retired owners or overlap.');image.set(data,start);edits.push({start,end:start+data.length,purpose});}
 if(sixop&&!twist){for(const h of sixop.hooks){if(!same(base.slice(h.raw,h.raw+4),Uint8Array.from(h.expected.match(/../g),x=>parseInt(x,16))))error('extension','Six-OP hook does not match the official firmware.');replace(h.raw,branch(FLASH_BASE+h.raw,sixopRoots[h.root],true),'Six-OP UI/preset hook');}for(const a of sixop.stack_words){if(view(base).getUint32(a,true)!==0x20020000)error('extension','Six-OP stack reservation base changed.');replace(a,words([sixop.state_address]),'Six-OP state reservation');}if(!same(base.slice(sixop.boot_call,sixop.boot_call+4),branch(FLASH_BASE+sixop.boot_call,0x08025731)))error('extension','Six-OP boot call changed.');replace(sixop.boot_call,branch(FLASH_BASE+sixop.boot_call,sixopRoots[sixop.boot_root]),'Six-OP boot initialization');}
 if(twist){for(const h of twist.hooks){if(!same(base.slice(h.raw,h.raw+4),Uint8Array.from(h.expected.match(/../g),x=>parseInt(x,16))))error('extension','TWIST hook does not match official firmware.');replace(h.raw,branch(FLASH_BASE+h.raw,twistRoots[h.root],true),'TWIST UI/preset hook');}for(const a of twist.stack_words){if(view(base).getUint32(a,true)!==0x20020000)error('extension','TWIST stack reservation base changed.');replace(a,words([twist.state_address]),'TWIST state reservation');}if(!same(base.slice(twist.boot_call,twist.boot_call+4),branch(FLASH_BASE+twist.boot_call,0x08025731)))error('extension','TWIST boot call changed.');replace(twist.boot_call,branch(FLASH_BASE+twist.boot_call,twistRoots[twist.boot_root]),'TWIST boot initialization');}
 for(const c of linked.chunks)replace(c.start,c.data,'joint module placement');
 const stub=p.moduleMaps[library.retirement_module]?.roots.map(address);for(const a of selected)if(a.retired_table)replace(a.retired_table,words([stub[0]|1,stub[2]|1,stub[3]|1,stub[1]|1]),'retired original ABI');
 for(const f of families)replace(f.render_cell,words([f.idle_render]),'retired native family Render');
 for(const a of selected){const descriptor=base.slice(META+(a.continuous_controls?9:10)*28,META+(a.continuous_controls?10:11)*28);
  // Seed native per-engine memory; subsequent recall and presets remain native.
  if(a.sixop_bank!==undefined)[0,16384,16384].forEach((n,i)=>view(descriptor).setUint16(6+i*2,n,true));
  let offset=0;const labels=linked.placements[p.labelSections[a.id]].start;a.labels.forEach((s,i)=>{view(descriptor).setUint32(12+i*4,FLASH_BASE+labels+offset,true);offset+=enc(s).length+1;});replace(META+a.id*28,descriptor,'selected engine descriptor');}
 if(!same(base.slice(spec.dispatch_hook,spec.dispatch_hook+4),Uint8Array.from(spec.dispatch_expected.match(/../g),x=>parseInt(x,16))))error('hook','The native dispatch hook changed.');
 if(!same(base.slice(0x41f96,0x41f9a),Uint8Array.of(0,0xb2,1,0x38)))error('hook','The formatter dispatch hook changed.');
 if(retired.has('vocoder')){for(const raw of vocoderGates){if(!same(base.slice(raw,raw+2),Uint8Array.of(14,0x2b)))error('hook','The Vocoder CV exclusion gate changed.');replace(raw,Uint8Array.of(255,0x2b),'retired Vocoder CV exclusion');}if(!same(base.slice(0x2a86e,0x2a876),Uint8Array.from('c8f810290bf11c0b'.match(/../g),x=>parseInt(x,16))))error('hook','The Vocoder object-table constructor changed.');replace(0x2a86e,Uint8Array.from('0bf11c0bc8f810b9'.match(/../g),x=>parseInt(x,16)),'retired Vocoder object route');}
 replace(spec.dispatch_hook,branch(FLASH_BASE+spec.dispatch_hook,FLASH_BASE+routeRaw,true),'universal dispatch');replace(spec.init_hook,words([roots[0]|1]),'universal Init');replace(spec.parameter_hook,words([roots[1]|1]),'universal parameter');
 replace(0x23ea4,branch(FLASH_BASE+0x23ea4,FLASH_BASE+configRaw,true),'universal configuration');replace(0x41f96,branch(FLASH_BASE+0x41f96,FLASH_BASE+screenRaw,true),'universal formatter');
 if(retired.has('speech')){replace(0x5366c,Uint8Array.of(0,0xbf),'retired Speech route');if(selected.some(a=>a.engine==='phase_distortion'&&a.id===11)){const b=new Uint8Array(4);view(b).setFloat32(0,0.7,true);replace(0x53450,b,'Phase output gain');}}
 edits.sort((a,b)=>a.start-b.start);let cursor=0;for(const e of edits){if(!same(image.slice(cursor,e.start),base.slice(cursor,e.start)))error('preservation','An unselected region changed.');cursor=e.end;}if(!same(image.slice(cursor),base.slice(cursor)))error('preservation','An unselected region changed.');
 for(const a of selected){if(view(image).getUint32(a.runtime_vtable+8,true)!==(moduleRoots(a)[3]|1))error('dispatch','A module dispatch table is incorrect.');}
 const result={image,selected,edits,links,nativeBridge:{bindings,bindings_raw:bindingRaw,roots,route:routeRaw,screen:screenRaw,module:spec.module,overlay_group:'chords',preserves_native_vtables:!families.length,reclaimed_regions:p.regions,speech_retained:!retired.has('speech')},plan:{regions:p.regions,required:p.required,available:p.available,placements:linked.placements,section_layout:p.sections.map(s=>({id:s.id,start:linked.placements[s.id].start,size:s.size,alignment:s.alignment})),relocations:linked.relocationCount,all_modules_placed_jointly:true},extensions:(sixop||twist)?{...(twist?{twist:{roots:twistRoots,models_raw:twistRoots[twist.models_root]-FLASH_BASE,next_raw:twistRoots[twist.next_root]-FLASH_BASE,state_address:twist.state_address}}:{}),...(sixop?{sixop:{roots:sixopRoots,models_raw:sixopRoots[sixop.models_root]-FLASH_BASE,banks_raw:sixopRoots[sixop.banks_root]-FLASH_BASE,state_address:sixop.state_address}}:{})}:null,sha256:await hash(image),structuralVerified:false};
 result.independentVerification=verifyUniversal(base,library,result);result.structuralVerified=result.independentVerification.passed;return result;
}
