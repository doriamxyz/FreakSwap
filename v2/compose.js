import {universalAdapters,universalSelection,composeUniversal} from './universal.js?type-preview-fix-20261021';
// Offline ARM module composition. No catalog of complete firmware is consulted.
export const FLASH_BASE=0x0800c000, META=0x564f4, POOL_END=0x6f366;
export const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
const fail=message=>{throw new Error(message);};
const uint=(n,max=0xffffffff)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const align=(n,a)=>Math.ceil(n/a)*a;
const bytes64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
const words=values=>{const b=new Uint8Array(values.length*4);values.forEach((n,i)=>view(b).setUint32(i*4,n,true));return b;};
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
export function branch(place,target,jump=false){
 const d=(target&~1)-(place+4);
 if(d%2||d<-(2**24)||d>=2**24)fail('ARM branch is outside its allowed range.');
 const n=d&0x1ffffff,s=(n>>>24)&1,i1=(n>>>23)&1,i2=(n>>>22)&1,j1=1^(i1^s),j2=1^(i2^s);
 const b=new Uint8Array(4);view(b).setUint16(0,0xf000|(s<<10)|((n>>>12)&1023),true);view(b).setUint16(2,(jump?0x9000:0xd000)|(j1<<13)|(j2<<11)|((n>>>1)&2047),true);return b;
}
function readBranch(b,off,place){const v=view(b),a=v.getUint16(off,true),z=v.getUint16(off+2,true),s=(a>>>10)&1;let n=(s<<24)|((1^((z>>>13)&1)^s)<<23)|((1^((z>>>11)&1)^s)<<22)|((a&1023)<<12)|((z&2047)<<1);if(n&0x1000000)n-=0x2000000;return place+4+n;}
function mov(b,off,n){const v=view(b),a=v.getUint16(off,true),z=v.getUint16(off+2,true);v.setUint16(off,(a&0xfbf0)|((n>>>12)&15)|(((n>>>11)&1)<<10),true);v.setUint16(off+2,(z&0x8f00)|(((n>>>8)&7)<<12)|(n&255),true);}
function readMov(b,off){const v=view(b),a=v.getUint16(off,true),z=v.getUint16(off+2,true);return ((a&15)<<12)|(((a>>>10)&1)<<11)|(((z>>>12)&7)<<8)|(z&255);}
export function validateModule(module){
 if(module?.format!=='freakswap.arm-module'||module.version!==1||!Array.isArray(module.sections)||!module.sections.length||module.sections.length>1024||!Array.isArray(module.roots)||module.roots.length!==4)fail('Invalid ARM module.');
 const externals=new Set([0x0807ece8,0x0807e8e4,0x0807d4e0,0x0807cacc,0x2000011c]);
 function target(t){if(!t||typeof t!=='object')fail('Invalid relocation target.');if(Object.hasOwn(t,'external')){if(Object.keys(t).length!==1||!externals.has(t.external))fail('Unresolved external symbol.');}else if(Object.keys(t).sort().join(',')!=='section,value'||!uint(t.section,module.sections.length-1)||!uint(t.value)||!module.sections[t.section]||t.value>module.sections[t.section].size)fail('Invalid section reference.');}
 module.sections.forEach((s,i)=>{
  if(s.id!==i||!uint(s.size,65536)||!uint(s.alignment,4096)||!s.alignment||(s.alignment&(s.alignment-1))||typeof s.data!=='string'||bytes64(s.data).length!==s.size||!Array.isArray(s.relocations))fail('Invalid module section.');
  const used=new Set();for(const r of s.relocations){if(![2,10,30,47,48].includes(r.type)||!uint(r.offset)||r.offset+4>s.size||r.offset%2||used.has(r.offset))fail('Unsupported or invalid relocation.');used.add(r.offset);target(r.target);}
 });module.roots.forEach(t=>{target(t);if(Object.hasOwn(t,'external'))fail('Module entry points must be defined in its own code.');});return module;
}
export function linkModule(module,windows,{searchLimit=200000}={}){
 validateModule(module);
 if(!Array.isArray(windows)||!windows.length||windows.some(([a,b])=>!uint(a)||!uint(b)||a>=b||b>473695))fail('Invalid code regions.');
 for(let i=0;i<windows.length;i++)for(let j=0;j<i;j++)if(windows[i][0]<windows[j][1]&&windows[i][1]>windows[j][0])fail('Code regions overlap.');
 const order=[...module.sections].sort((a,b)=>b.size-a.size||a.id-b.id);let cursor=windows.map(w=>w[0]),placements={},failed=false;
 for(const s of order){let found=false;for(let i=0;i<windows.length;i++){let start=align(FLASH_BASE+cursor[i],s.alignment)-FLASH_BASE;if(start+s.size<=windows[i][1]){placements[s.id]={start,region:i};cursor[i]=start+s.size;found=true;break;}}if(!found){failed=true;break;}}
 if(failed){let attempts=0;const seen=new Set();function search(index,positions){if(++attempts>searchLimit)fail('Placement search budget exceeded; no firmware generated.');if(index===order.length)return [];const sig=index+':'+positions.join(',');if(seen.has(sig))return null;const s=order[index];if(windows.reduce((n,w,i)=>n+w[1]-positions[i],0)<order.slice(index).reduce((n,s)=>n+s.size,0))return null;
  for(let i=0;i<windows.length;i++){const start=align(FLASH_BASE+positions[i],s.alignment)-FLASH_BASE;if(start+s.size>windows[i][1])continue;const next=[...positions];next[i]=start+s.size;const rest=search(index+1,next);if(rest)return [[s.id,{start,region:i}],...rest];}seen.add(sig);return null;}
  const result=search(0,windows.map(w=>w[0]));if(!result)fail('The module does not fit the verified code regions.');placements=Object.fromEntries(result);cursor=windows.map(w=>w[0]);for(const s of order){const p=placements[s.id];cursor[p.region]=Math.max(cursor[p.region],p.start+s.size);}}
 const chunks=windows.map(([start,end],i)=>({start,end:cursor[i],capacity:end,data:new Uint8Array(cursor[i]-start)}));
 for(const s of module.sections){const p=placements[s.id];chunks[p.region].data.set(bytes64(s.data),p.start-chunks[p.region].start);}
 const address=t=>Object.hasOwn(t,'external')?t.external:FLASH_BASE+placements[t.section].start+t.value;
 let relocationCount=0;
 for(const s of module.sections){const p=placements[s.id],chunk=chunks[p.region],buf=chunk.data;
  for(const r of s.relocations){const off=p.start-chunk.start+r.offset,place=FLASH_BASE+p.start+r.offset,n=address(r.target);let expected;
   if(r.type===2){view(buf).setUint32(off,n,true);expected=view(buf).getUint32(off,true);}
   else if(r.type===47||r.type===48){const value=r.type===47?n&65535:n>>>16;mov(buf,off,value);expected=readMov(buf,off);if(expected!==value)fail('ARM immediate verification failed.');expected=n;}
   else{buf.set(branch(place,n,r.type===30),off);expected=readBranch(buf,off,place);if(expected!==(n&~1))fail('ARM branch verification failed.');expected=n;}
   if(expected!==n)fail('ARM relocation verification failed.');relocationCount++;
  }}
 return {chunks,roots:module.roots.map(address),placements,relocationCount};
}
// Compatibility is computed from one engine ABI and independent host contracts.
export function availableAdapters(library){
 if(library.version===3)return universalAdapters(library);
 const result=[...library.adapters];
 for(const engine of Object.values(library.engines||{}))for(const [original,host] of Object.entries(library.hosts||{})){
  if(result.some(a=>a.engine===engine.engine&&a.original===original&&a.variant===engine.variant))continue;
  if(host.transport==='direct'&&engine.direct_hosts&&!engine.direct_hosts.includes(original))continue;
  if((engine.transports&&!engine.transports.includes(host.transport))||engine.abi!==host.abi||engine.object_bytes>host.object_limit||engine.scratch_bytes>library.limits.arena_per_voice)continue;
  result.push({...engine,...host,original,portable:true,native_alias:host.transport==='native-overlay'});
 }return result;
}
export function selectAdapters(library,recipe){
 if(library.version===3)return universalSelection(library,recipe);
 if(!Array.isArray(recipe)||!recipe.length||recipe.length>library.limits.maximum_engines)fail('Choose one to three replacement engines.');
 const engines=new Set(),originals=new Set();const selected=recipe.map(r=>{
  if(!r||Object.keys(r).sort().join(',')!=='engine,original,variant'||r.variant!=='normal')fail('Invalid replacement selection.');
  if(engines.has(r.engine)||originals.has(r.original))fail('Engines and originals cannot be repeated.');engines.add(r.engine);originals.add(r.original);
  const a=availableAdapters(library).find(a=>a.engine===r.engine&&a.original===r.original&&a.variant===r.variant);if(!a)fail('This adapter is not available in the prototype.');
  if(a.object_bytes>a.object_limit||a.scratch_bytes>library.limits.arena_per_voice)fail('The replacement exceeds the verified voice memory.');return a;
 });
 // Match the legacy builder's model order, without tying it to selection order.
 if(selected.some(a=>a.native_alias)&&!selected.some(a=>!a.native_alias))fail('Also replace Speech, Formant, Virtual Analog or another available direct host to make room.');
 const order=['phase_distortion','swarm','bass_drum','snare_drum'];selected.sort((a,b)=>order.indexOf(a.engine)-order.indexOf(b.engine));
 for(let i=0;i<selected.length;i++)for(let j=0;j<i;j++){const a=selected[i],b=selected[j];if(!a.native_alias&&!b.native_alias&&a.object_offset<b.object_offset+b.object_bytes&&a.object_offset+a.object_bytes>b.object_offset)fail('Voice objects overlap.');for(const [s,e] of a.windows)for(const [x,y] of b.windows)if(s<y&&e>x)fail('Code regions overlap.');}
 return selected;
}
export function configurationBridge(ids,raw){
 const b=new Uint8Array(align(ids.length*6+8,4)+4),v=view(b);let at=0;
 for(const id of ids){if(!uint(id,255))fail('Invalid model ID.');v.setUint16(at,0x2900|id,true);v.setUint16(at+2,0xbf08,true);v.setUint16(at+4,0x2109,true);at+=6;}
 v.setUint16(at,0xb410,true);v.setUint16(at+2,0x3906,true);const literal=b.length-4; // LDR uses Align(instruction address + 4, 4).
 const instruction=FLASH_BASE+raw+at+4,delta=FLASH_BASE+raw+literal-(Math.floor((instruction+4)/4)*4);
 if(delta<0||delta>4095)fail('Configuration bridge literal is out of range.');
 v.setUint16(at+4,0xf8df,true);v.setUint16(at+6,0xf000|delta,true);
 // The assembler emits a Thumb NOP when .balign 4 needs padding.
 if(at+8<literal)v.setUint16(at+8,0xbf00,true);v.setUint32(literal,0x0802fea9,true);return b;
}
export async function composeRaw(base,library,recipe,modules){
 if(library.version===3)return composeUniversal(base,library,recipe,modules);
 if(!(base instanceof Uint8Array)||base.length!==library.base.raw_size||await hash(base)!==library.base.raw_sha256)fail('The raw official firmware is incorrect.');
 const selected=selectAdapters(library,recipe),image=base.slice(),edits=[],links=[],tails=[];let speechCursor=0x6c838;
 function replace(start,data,purpose,allowed){if(!(data instanceof Uint8Array)||!data.length||!uint(start)||start+data.length>image.length||!allowed.some(([a,b])=>start>=a&&start+data.length<=b))fail('Write outside the selected adapter contract.');if(edits.some(e=>start<e.end&&start+data.length>e.start))fail('Firmware writes overlap.');image.set(data,start);edits.push({start,end:start+data.length,purpose});}
 const commonAllowed=[[0x23ea4,0x23ea8],[0x5366c,0x5366e],[0x53450,0x53454]];
 for(const a of selected.filter(a=>!a.native_alias)){const module=modules[a.module];if(!module||await hash(new TextEncoder().encode(JSON.stringify(module,null,2)+'\n'))!==a.module)fail('Module content failed verification.');const linked=linkModule(module,a.windows);links.push({adapter:a,...linked});const allowed=[...a.windows,[a.vtable,a.vtable+16],[META+a.id*28,META+(a.id+1)*28],[0x41fa4+(a.id-1)*2,0x41fa6+(a.id-1)*2],...commonAllowed];
  for(const c of linked.chunks)if(c.data.length)replace(c.start,c.data,a.engine+' code',allowed);
  let [init,reset,load,render]=linked.roots;replace(a.vtable,words([init|1,(a.reset_on_activation?reset:load)|1,render|1,reset|1]),a.engine+' ABI',allowed);
  const labelData=new TextEncoder().encode(a.labels.join('\0')+'\0');let region,labelStart;
  if(a.original==='speech'){speechCursor=a.windows[0][1];labelStart=speechCursor;}
  else{region=linked.chunks.find(c=>align(c.end,4)+labelData.length<=c.capacity);if(!region)fail('No space for engine labels.');labelStart=align(region.end,4);}
  const limit=a.original==='speech'?POOL_END:region.capacity;replace(labelStart,labelData,a.engine+' labels',[[labelStart,limit]]);
  const descriptor=base.slice(META+((a.id===11||a.continuous_controls)?9:a.id)*28,META+((a.id===11||a.continuous_controls)?10:a.id+1)*28);let offset=0;
  a.labels.forEach((s,i)=>{view(descriptor).setUint32(12+i*4,FLASH_BASE+labelStart+offset,true);offset+=new TextEncoder().encode(s).length+1;});replace(META+a.id*28,descriptor,a.engine+' metadata',allowed);
  if(a.configuration_remap){const cell=0x41fa4+(a.id-1)*2,t=a.continuous_controls?0x41fb4:0x41fb6;replace(cell,base.slice(t,t+2),a.engine+' UI',allowed);}
  else if(a.id===10&&a.continuous_controls)replace(0x41fb6,Uint8Array.of(0x17,0),a.engine+' UI',allowed);
  if(a.id===11)speechCursor+=labelData.length;else for(const c of linked.chunks)tails.push([c===region?labelStart+labelData.length:c.end,c.capacity]);
 }
 const speech=selected.some(a=>a.original==='speech'),remap=selected.filter(a=>a.configuration_remap||(!speech&&a.native_alias)).map(a=>a.id);
 if(speech||remap.length){const ids=speech?[11,23,...remap]:remap;let raw=speech?align(speechCursor,4):null;
  if(!speech){const size=configurationBridge(ids,0).length;raw=tails.map(([a,b])=>[align(a,4),b]).find(([a,b])=>a+size<=b)?.[0];}
  if(raw===null||raw===undefined)fail('No space for the configuration bridge.');const data=configurationBridge(ids,raw),end=speech?POOL_END:tails.find(([a,b])=>raw>=a&&raw<b)?.[1];replace(raw,data,'configuration bridge',[[raw,end]]);replace(0x23ea4,branch(FLASH_BASE+0x23ea4,FLASH_BASE+raw,true),'configuration hook',commonAllowed);}
 if(speech){replace(0x5366c,Uint8Array.of(0,0xbf),'Speech render route',commonAllowed);if(selected.some(a=>a.engine==='phase_distortion'&&a.id===11)){const f=new Uint8Array(4);view(f).setFloat32(0,0.7,true);replace(0x53450,f,'Phase output gain',commonAllowed);}}
 const aliases=selected.filter(a=>a.native_alias);let nativeBridge=null;
 if(aliases.length){
  const spec=library.bridge;if(!spec)fail('A verified shared native bridge is required.');
  // Pool only audited code belonging to explicit replacements. Native families stay intact.
  const candidates=[...(speech?[[0x6c838,POOL_END]]:[]),...selected.filter(a=>!a.native_alias).flatMap(a=>a.windows)].sort((a,b)=>a[0]-b[0]);
  const reclaimed=[];for(const [a,b] of candidates){const last=reclaimed.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else reclaimed.push([a,b]);}
  let free=reclaimed.map(w=>[...w]);
  const subtract=(start,end)=>{free=free.flatMap(([a,b])=>[[a,Math.min(b,start)],[Math.max(a,end),b]]).filter(([a,b])=>a<b);};
  for(const e of edits)subtract(e.start,e.end);
  function reserve(size,alignment=4){for(const [a,b] of free){const raw=align(a,alignment);if(raw+size<=b){subtract(raw,raw+size);return raw;}}fail('The portable engine and bridge do not fit the verified free space.');}
  const allowed=[...reclaimed,[0x27986,0x2798a],[0x68d20,0x68d24],[0x68d2c,0x68d30]];
  async function checkedModule(id){const m=modules[id];if(!m||await hash(new TextEncoder().encode(JSON.stringify(m,null,2)+'\n'))!==id)fail('Module content failed verification.');return m;}
  const bindings=new Array(23).fill(0);
  for(const a of aliases){
   const table=reserve(16),labelData=new TextEncoder().encode(a.labels.join('\0')+'\0'),labelStart=reserve(labelData.length);
   replace(labelStart,labelData,a.engine+' portable labels',allowed);
   const descriptor=base.slice(META+9*28,META+10*28);let offset=0;
   a.labels.forEach((label,i)=>{view(descriptor).setUint32(12+i*4,FLASH_BASE+labelStart+offset,true);offset+=new TextEncoder().encode(label).length+1;});
   replace(META+a.id*28,descriptor,a.engine+' portable metadata',[[META+a.id*28,META+(a.id+1)*28]]);
   const cell=0x41fa4+(a.id-1)*2;if(a.id>20&&!a.continuous_controls)fail('The native slot needs an unsupported discrete display formatter.');
   if(a.id<=20)replace(cell,base.slice(a.continuous_controls?0x41fb4:0x41fb6,(a.continuous_controls?0x41fb4:0x41fb6)+2),a.engine+' portable UI',[[cell,cell+2]]);
   const linked=linkModule(await checkedModule(a.module),free);
   for(const c of linked.chunks)if(c.data.length){replace(c.start,c.data,a.engine+' portable DSP',allowed);subtract(c.start,c.end);}
   const [init,reset,load,render]=linked.roots;replace(table,words([init|1,(a.reset_on_activation?reset:load)|1,render|1,reset|1]),a.engine+' portable ABI',allowed);
   bindings[a.id]=FLASH_BASE+table;links.push({adapter:a,...linked,vtable:table});
  }
  const bridge=linkModule(await checkedModule(spec.module),free),bindingAddress=bridge.roots[spec.bindings_root],bindingRaw=bindingAddress-FLASH_BASE;
  const bindingChunk=bridge.chunks.find(c=>bindingRaw>=c.start&&bindingRaw+92<=c.end);
  if(!bindingChunk||bindingRaw%4||bindingChunk.data.slice(bindingRaw-bindingChunk.start,bindingRaw-bindingChunk.start+92).some(x=>x))fail('The shared bridge binding table is invalid.');
  bindingChunk.data.set(words(bindings),bindingRaw-bindingChunk.start);
  for(const c of bridge.chunks)if(c.data.length){replace(c.start,c.data,'shared portable lifecycle bridge',allowed);subtract(c.start,c.end);}
  const route=Uint8Array.from(spec.route_hex.match(/../g),x=>parseInt(x,16));view(route).setUint32(spec.route_binding_offset,bindingAddress,true);const raw=reserve(route.length);replace(raw,route,'portable ID dispatch',allowed);
  if(!same(image.slice(spec.dispatch_hook,spec.dispatch_hook+4),Uint8Array.from(spec.dispatch_expected.match(/../g),x=>parseInt(x,16))))fail('The native dispatch hook does not match the verified base.');
  replace(spec.dispatch_hook,branch(FLASH_BASE+spec.dispatch_hook,FLASH_BASE+raw,true),'portable native route hook',allowed);
  replace(spec.init_hook,words([bridge.roots[0]|1]),'portable frontend init hook',allowed);
  replace(spec.parameter_hook,words([bridge.roots[1]|1]),'portable parameter hook',allowed);
  nativeBridge={bindings,bindings_raw:bindingRaw,route:raw,roots:bridge.roots,module:spec.module,overlay_group:'chords',preserves_native_vtables:true,reclaimed_regions:reclaimed,speech_retained:!speech};
  // Native family vtables remain authoritative for every unselected ID.
  for(const [a,b] of [[0x68d30,0x68f00]])if(!same(image.slice(a,b),base.slice(a,b)))fail('A retained native-family table changed.');
 }
 edits.sort((a,b)=>a.start-b.start);
 // Independently check preservation and every selected descriptor/vtable.
 let cursor=0;for(const e of edits){if(!same(image.subarray(cursor,e.start),base.subarray(cursor,e.start)))fail('An unselected region changed.');cursor=e.end;}if(!same(image.subarray(cursor),base.subarray(cursor)))fail('An unselected region changed.');
 for(const {adapter:a,roots,vtable} of links){const p=META+a.id*28;let pos=0;for(let i=0;i<4;i++){const addr=view(image).getUint32(p+12+i*4,true)-FLASH_BASE;if(addr<0||addr>=image.length)fail('Invalid UI string pointer.');const end=image.indexOf(0,addr);if(new TextDecoder().decode(image.subarray(addr,end))!==a.labels[i])fail('UI label verification failed.');pos++;}if(view(image).getUint32((vtable??a.vtable)+8,true)!==(roots[3]|1))fail('DSP dispatch verification failed.');}
 return {image,edits,selected,links,nativeBridge,sha256:await hash(image),structuralVerified:true};
}
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function archiveMembers(bytes){
 const v=view(bytes);let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===bytes.length){eocd=i;break;}if(eocd<0)fail('Invalid firmware ZIP.');
 const count=v.getUint16(eocd+10,true),size=v.getUint32(eocd+12,true),start=v.getUint32(eocd+16,true);if(v.getUint16(eocd+4,true)||v.getUint16(eocd+6,true)||v.getUint16(eocd+8,true)!==count||start+size!==eocd||count!==6)fail('Unsupported firmware ZIP layout.');
 const result=[];let at=start;for(let i=0;i<count;i++){
  if(at+46>eocd||v.getUint32(at,true)!==0x02014b50)fail('Invalid ZIP directory.');const flags=v.getUint16(at+8,true),method=v.getUint16(at+10,true),packed=v.getUint32(at+20,true),length=v.getUint32(at+24,true),n=v.getUint16(at+28,true),extra=v.getUint16(at+30,true),comment=v.getUint16(at+32,true),local=v.getUint32(at+42,true),name=new TextDecoder().decode(bytes.subarray(at+46,at+46+n));
  if(flags||method||packed!==length||local+30>start||v.getUint32(local,true)!==0x04034b50)fail('Unsupported ZIP member.');const ln=v.getUint16(local+26,true),le=v.getUint16(local+28,true),data=local+30+ln+le;
  if(data+length>start||!same(bytes.subarray(local+30,local+30+ln),bytes.subarray(at+46,at+46+n))||v.getUint32(local+18,true)!==length||v.getUint32(local+22,true)!==length||v.getUint32(local+14,true)!==v.getUint32(at+16,true)||crc32(bytes.subarray(data,data+length))!==v.getUint32(at+16,true))fail('ZIP member validation failed.');
  result.push({name,local,central:at,data,length});at+=46+n+extra+comment;
 }if(at!==eocd||new Set(result.map(e=>e.name)).size!==count)fail('Invalid ZIP entries.');return result;
}
export async function unpackOfficial(bytes,library){
 if(bytes.length!==library.base.size||await hash(bytes)!==library.base.sha256)fail('Choose the official MicroFreak 5.0.0.2084 firmware.');const members=archiveMembers(bytes),main=members.find(e=>e.name.startsWith('nanowave_main__'));if(!main||main.length!==library.base.raw_size+65)fail('Incorrect main firmware member.');const raw=bytes.slice(main.data+64,main.data+main.length-1);if(await hash(raw)!==library.base.raw_sha256)fail('Incorrect firmware image.');return {raw,main,members};
}
export async function packageFirmware(bytes,library,composition){
 const {main,members}=await unpackOfficial(bytes,library),out=bytes.slice(),v=view(out),raw=composition.image;
 if(!composition.structuralVerified||raw.length!==library.base.raw_size||await hash(raw)!==composition.sha256)fail('The composition changed after verification.');out.set(raw,main.data+64);let xor=0;for(const b of raw)xor^=b;out[main.data+1]=xor;out[main.data+main.length-1]=xor;const crc=crc32(out.subarray(main.data,main.data+main.length));v.setUint32(main.local+14,crc,true);v.setUint32(main.central+16,crc,true);
 const finalMembers=archiveMembers(out);for(const e of finalMembers)if(e.name!==main.name&&!same(bytes.subarray(e.data,e.data+e.length),out.subarray(e.data,e.data+e.length)))fail('An unrelated firmware member changed.');return {bytes:out,sha256:await hash(out)};
}
