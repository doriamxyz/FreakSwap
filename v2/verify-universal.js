// Independent ownership/preservation check. Does not trust the writer's edit list.
import {FLASH_BASE,META} from './compose.js';
const equal=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]),read=(b,p)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(p,true),assert=(ok,s)=>{if(!ok)throw new Error('Independent firmware verification failed: '+s);};
export function verifyUniversal(base,library,c){
 const {image,selected,nativeBridge}=c,retired=new Set(selected.map(a=>a.original)),pools=library.regions.filter(r=>r.owners.every(k=>retired.has(k))).map(r=>[r.start,r.end]).sort((a,b)=>a[0]-b[0]);
 const merged=[];for(const [a,b] of pools){const last=merged.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else merged.push([a,b]);}pools.splice(0,pools.length,...merged);
 const allowed=[...pools,[0x23ea4,0x23ea8],[0x41f96,0x41f9a],[library.bridge.dispatch_hook,library.bridge.dispatch_hook+4],[library.bridge.init_hook,library.bridge.init_hook+4],[library.bridge.parameter_hook,library.bridge.parameter_hook+4],...selected.flatMap(a=>[[META+a.id*28,META+(a.id+1)*28],...(a.retired_table?[[a.retired_table,a.retired_table+16]]:[])])];
 if(retired.has('speech'))allowed.push([0x5366c,0x5366e],...(selected.some(a=>a.id===11&&a.engine==='phase_distortion')?[[0x53450,0x53454]]:[]));
 if(retired.has('vocoder'))allowed.push([0x2a86e,0x2a876],...[0x28f50,0x28f5c,0x28f68,0x28fd8,0x2903e,0x29048].map(p=>[p,p+2]));
 for(const f of library.native_families)if(f.owners.every(k=>retired.has(k)))allowed.push([f.render_cell,f.render_cell+4]);
 assert(image.length===base.length,'image length');for(let i=0;i<image.length;i++)if(image[i]!==base[i])assert(allowed.some(([a,b])=>i>=a&&i<b),'changed byte outside explicitly retired owners at '+i);
 for(const [original,h] of Object.entries(library.hosts))if(!retired.has(original)){assert(equal(image.slice(META+h.id*28,META+(h.id+1)*28),base.slice(META+h.id*28,META+(h.id+1)*28)),'retained descriptor');if(h.retired_table)assert(equal(image.slice(h.retired_table,h.retired_table+16),base.slice(h.retired_table,h.retired_table+16)),'retained ABI');}
 const occupied=[];
 for(const a of selected){assert(a.object_bytes<=336&&a.scratch_bytes<=16384,'per-voice bounds');const table=a.runtime_vtable;assert(pools.some(([x,y])=>table>=x&&table+16<=y),'module table outside retired code');assert(read(image,nativeBridge.bindings_raw+a.id*4)===FLASH_BASE+table,'wrong per-ID binding');
  for(let j=0;j<4;j++){const target=read(image,table+j*4);assert((target&1)&&pools.some(([x,y])=>(target&~1)>=FLASH_BASE+x&&(target&~1)<FLASH_BASE+y),'module entry outside retired code');const ptr=read(image,META+a.id*28+12+j*4)-FLASH_BASE;assert(ptr>=0&&ptr<image.length,'invalid label pointer');const end=image.indexOf(0,ptr);assert(end>=ptr&&new TextDecoder().decode(image.slice(ptr,end))===a.labels[j],'wrong label');}
 }
 for(let id=0;id<23;id++)if(!selected.some(a=>a.id===id))assert(read(image,nativeBridge.bindings_raw+id*4)===0,'unrequested ID intercepted');
 for(const f of library.native_families){const start=f.render_cell-36;for(let i=start;i<start+52;i++)if(image[i]!==base[i])assert(f.owners.every(k=>retired.has(k))&&i>=f.render_cell&&i<f.render_cell+4,'retained native family changed');}
 for(const p of c.plan.section_layout){assert(Number.isSafeInteger(p.start)&&p.size>=0&&Number.isInteger(p.alignment)&&p.alignment>0&&(FLASH_BASE+p.start)%p.alignment===0,'invalid section placement');assert(pools.some(([a,b])=>p.start>=a&&p.start+p.size<=b),'section outside retired code');assert(!occupied.some(q=>p.start<q.start+q.size&&p.start+p.size>q.start),'overlapping sections');occupied.push(p);}
 assert(equal(image.slice(0,0x400),base.slice(0,0x400)),'boot vectors changed');assert(equal(image.slice(0x56410,0x56428),base.slice(0x56410,0x56428)),'Type order changed');
 return {passed:true,ownership_recomputed:true,writer_edit_list_trusted:false,retained_descriptors_and_abis_preserved:true,retained_native_families_preserved:true,all_binding_targets_in_retired_code:true,voice_bounds_verified:true};
}
