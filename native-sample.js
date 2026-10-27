// Raster retains native Sample DSP and its buffers. It never enters the Plaits overlay.
import {FLASH_BASE,META,hash,linkModule,branch} from './compose.js?raster-20261026';
import {verifyUniversal} from './verify-universal.js?raster-20261026';
const enc=s=>new TextEncoder().encode(s),dv=b=>new DataView(b.buffer,b.byteOffset,b.byteLength),same=(a,b)=>a.length===b.length&&a.every((n,i)=>n===b[i]);
const ensure=(v,s)=>{if(!v)throw new Error('Native Sample contract: '+s);};
const word=n=>{const b=new Uint8Array(4);dv(b).setUint32(0,n,true);return b;};
const unhex=s=>Uint8Array.from(s.match(/../g),x=>parseInt(x,16));
export const hasRaster=recipe=>recipe.some(a=>a.engine==='raster');
function contract(library){
 const spec=library.extensions?.raster;
 ensure(spec&&spec.id===19&&spec.original==='sample'&&spec.state_bytes===32&&spec.buffer_bytes===1024&&spec.object_bytes===148,'unknown ABI bounds');
 ensure(JSON.stringify(spec.windows.map(r=>[r.start,r.end]))==='[[43116,44590],[149732,149814]]','unknown retirement windows');
 ensure(spec.reload.raw===0xae58&&spec.reload.expected==='16d0'&&spec.reload.replacement==='16e0','unknown reload ownership');
 ensure(JSON.stringify(spec.callbacks.map(h=>h.raw))==='[429776,429788,429800]','unknown callback cells');
 ensure(JSON.stringify(spec.callbacks.map(h=>h.expected))==='[134415989,134416613,134416761]','unknown native callbacks');
 return spec;
}
function mixedScreen(raster,fallback){
 // Native formatter ABI: r0 model, r4 destination, r5 parameter. No new frame.
 const b=unhex('00b2132802d100bfdff804f0dff804f00000000000000000');
 dv(b).setUint32(16,raster|1,true);dv(b).setUint32(20,fallback|1,true);return b;
}
export function planRaster(library,recipe,modules,options,regularPlan,selection){
 const spec=contract(library),selected=selection(library,recipe),raster=selected.find(a=>a.native_sample),rest=recipe.filter(a=>a.engine!=='raster');
 ensure(raster&&raster.module===spec.module&&selected.filter(a=>a.native_sample).length===1,'one Raster in Sample is required');
 const other=rest.length?regularPlan(library,rest,modules,options):null,source=modules[raster.module];ensure(source,'missing Raster module');
 const module=structuredClone(source),screenSection=other?module.sections.length:null;
 if(other)module.sections.push({id:screenSection,size:24,alignment:4,data:btoa(String.fromCharCode(...mixedScreen(0,0))),relocations:[]});
 const regions=spec.windows.map(r=>[r.start,r.end]);
 // Distinct ABI domains are linked separately; the pools must be disjoint.
 if(other)for(const [a,b] of regions)ensure(!other.regions.some(([x,y])=>a<y&&b>x),'Plaits placement would reclaim native Sample code');
 const linked=linkModule(module,regions,options),address=t=>Object.hasOwn(t,'external')?t.external:FLASH_BASE+linked.placements[t.section].start+t.value;
 const required=module.sections.reduce((n,s)=>n+s.size,0)+(other?.required||0),available=regions.reduce((n,[a,b])=>n+b-a,0)+(other?.available||0);
 return {selected,regions:[...(other?.regions||[]),...regions],required,available,rasterPlan:{spec,module,linked,address,screenSection},other};
}
export async function composeRaster(base,library,recipe,modules,options,regularPlan,regularCompose,selection){
 const plan=planRaster(library,recipe,modules,options,regularPlan,selection),{spec,module,linked,address,screenSection}=plan.rasterPlan,raster=plan.selected.find(a=>a.native_sample);
 ensure(base.length===library.base.raw_size&&await hash(base)===library.base.raw_sha256,'wrong official firmware');
 ensure(await hash(enc(JSON.stringify(modules[raster.module],null,2)+'\n'))===raster.module,'module hash mismatch');
 for(const r of spec.windows)ensure(await hash(base.slice(r.start,r.end))===r.sha256,'retirement window differs from audit');
 for(const h of spec.callbacks)ensure(dv(base).getUint32(h.raw,true)===h.expected,'original callback differs');
 ensure(same(base.slice(spec.reload.raw,spec.reload.raw+2),unhex(spec.reload.expected)),'reload branch differs');
 const rest=recipe.filter(a=>a.engine!=='raster'),other=rest.length?await regularCompose(base,library,rest,modules,options):null,image=(other?.image||base).slice(),edits=[...(other?.edits||[])],roots=module.roots.map(address);
 const screenRaw=screenSection===null?roots[3]-FLASH_BASE:linked.placements[screenSection].start;
 const fallback=other?FLASH_BASE+other.nativeBridge.screen:0;
 if(other){const c=linked.chunks.find(c=>screenRaw>=c.start&&screenRaw+24<=c.end);ensure(c,'mixed formatter placement missing');c.data.set(mixedScreen(roots[3],fallback),screenRaw-c.start);}
 const nativeEdits=[];
 function replace(raw,data,purpose){ensure(!nativeEdits.some(e=>raw<e.end&&raw+data.length>e.start),'overlapping native writes');image.set(data,raw);nativeEdits.push({start:raw,end:raw+data.length,purpose});}
 for(const c of linked.chunks)if(c.data.length)replace(c.start,c.data,'native Sample module');
 spec.callbacks.forEach((h,i)=>replace(h.raw,word(roots[i]|1),'native Sample callback'));
 replace(spec.reload.raw,unhex(spec.reload.replacement),'Raster owns metadata reload');
 replace(0x41f96,branch(FLASH_BASE+0x41f96,FLASH_BASE+screenRaw,true),'native Sample formatter');
 const descriptor=base.slice(META+19*28,META+20*28);[0,16384,0].forEach((n,i)=>dv(descriptor).setUint16(6+i*2,n,true));
 const label=module.sections.find(s=>atob(s.data)==='Raster\0');ensure(label,'Raster title missing');
 dv(descriptor).setUint32(12,FLASH_BASE+linked.placements[label.id].start,true);dv(descriptor).setUint32(20,0x08062f88,true);dv(descriptor).setUint32(24,0x08062f90,true);
 replace(META+19*28,descriptor,'Raster Sample descriptor');
 raster.runtime_native_roots=roots;raster.runtime_native_screen=FLASH_BASE+screenRaw;
 // Keep the actual mixed placement used by the regular compositor (no search assumption).
 const result={image,selected:[...(other?.selected||[]),raster].sort((a,b)=>a.id-b.id),edits:[...edits.filter(e=>e.start!==0x41f96),...nativeEdits].sort((a,b)=>a.start-b.start),links:[...(other?.links||[]),{adapter:raster,roots,placements:linked.placements}],nativeBridge:other?.nativeBridge||null,extensions:other?.extensions||null,nativeSample:{module:raster.module,roots,screen:FLASH_BASE+screenRaw,fallback,other,native_layout:module.sections.map(s=>({id:s.id,start:linked.placements[s.id].start,size:s.size,alignment:s.alignment}))},plan:{regions:plan.regions,required:plan.required,available:plan.available,section_layout:[...(other?.plan.section_layout||[]),...module.sections.map(s=>({id:'native-'+s.id,start:linked.placements[s.id].start,size:s.size,alignment:s.alignment}))],all_modules_placed_jointly:false,disjoint_abi_domains:true},sha256:await hash(image),structuralVerified:false};
 result.independentVerification=verifyRaster(base,library,result);result.structuralVerified=true;return result;
}
export function verifyRaster(base,library,c){
 const spec=contract(library),{image,nativeSample:n}=c,a=c.selected.find(a=>a.native_sample),pools=spec.windows.map(r=>[r.start,r.end]);
 ensure(a&&a.original==='sample'&&a.id===19&&a.object_bytes===148&&a.scratch_bytes===1056,'per-voice bounds');
 const allowed=[...pools,[0xae58,0xae5a],[0x41f96,0x41f9a],[META+19*28,META+20*28],...spec.callbacks.map(h=>[h.raw,h.raw+4])];
 // Rebuild the pre-Raster view from official bytes and the verified regular formatter.
 // No writer edit list and no claimed intermediate image is used for preservation.
 const regular=image.slice();for(const [x,y] of allowed)regular.set(base.slice(x,y),x);
 const others=c.selected.filter(a=>!a.native_sample);
 if(others.length){ensure(n.other&&n.other.selected.length===others.length&&n.fallback===FLASH_BASE+n.other.nativeBridge.screen,'formatter continuation');regular.set(branch(FLASH_BASE+0x41f96,n.fallback,true),0x41f96);verifyUniversal(base,library,{...n.other,image:regular,selected:others});}
 else ensure(same(regular,base),'unrequested changes outside native Sample ownership');
 for(let i=0;i<image.length;i++)if(image[i]!==regular[i])ensure(allowed.some(([x,y])=>x<=i&&i<y),'native write outside ownership');
 ensure(same(image.slice(0xae58,0xae5a),unhex('16e0')),'retired length helper reachable');
 ensure(same(image.slice(0xae30,0xae58),base.slice(0xae30,0xae58))&&same(image.slice(0xae5a,0xbbba),base.slice(0xae5a,0xbbba)),'native Sample renderer changed');
 const grainsRetired=['cloud_grains','hit_grains','scan_grains'].every(k=>others.some(a=>a.original===k));
 if(!grainsRetired)ensure(same(image.slice(0x68e7c,0x68eb0),base.slice(0x68e7c,0x68eb0)),'retained Grains callbacks changed');
 const occupied=[];for(const s of n.native_layout){ensure(pools.some(([x,y])=>s.start>=x&&s.start+s.size<=y),'native section outside control pool');ensure((FLASH_BASE+s.start)%s.alignment===0&&!occupied.some(q=>s.start<q.start+q.size&&s.start+s.size>q.start),'native section overlap/alignment');occupied.push(s);}
 function target(t){return (t&1)&&n.native_layout.some(s=>(t&~1)>=FLASH_BASE+s.start&&(t&~1)<FLASH_BASE+s.start+s.size);}
 spec.callbacks.forEach((h,i)=>ensure(dv(image).getUint32(h.raw,true)===(n.roots[i]|1)&&target(n.roots[i]|1),'native callback routing'));
 ensure(target(n.roots[3]|1)&&same(image.slice(0x41f96,0x41f9a),branch(FLASH_BASE+0x41f96,n.screen,true)),'native formatter routing');
 if(others.length)ensure(same(image.slice(n.screen-FLASH_BASE,n.screen-FLASH_BASE+24),mixedScreen(n.roots[3],n.fallback)),'mixed formatter chain');else ensure(n.screen===n.roots[3],'standalone formatter');
 const off=META+19*28;ensure(same(image.slice(off,off+6),base.slice(off,off+6)),'native Sample output configuration changed');
 [0,16384,0].forEach((v,i)=>ensure(dv(image).getUint16(off+6+i*2,true)===v,'Raster default'));
 for(let i=0;i<4;i++){const ptr=dv(image).getUint32(off+12+i*4,true)-FLASH_BASE,end=image.indexOf(0,ptr);ensure(ptr>=0&&end>=ptr&&new TextDecoder().decode(image.slice(ptr,end))===a.labels[i],'Raster control label');}
 return {passed:true,writer_edit_list_trusted:false,native_sample_abi:true,buffer_bytes:1024,state_bytes:32,disjoint_abi_domains:true,native_sample_renderer_preserved:true,grains_callbacks_preserved:!grainsRetired,regular_composition_verified:!!others.length};
}
