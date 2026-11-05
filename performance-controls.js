// A UI-only layer applied after independent engine composition verification.
import {FLASH_BASE,hash,branch} from './compose.js?raster-20261026';
import {CONTROLS_SHA256} from './controls-release.js';
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const unhex=s=>Uint8Array.from(s.match(/../g)||[],x=>parseInt(x,16));
const read=(b,p)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(p,true);
const word=n=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,true);return b;};
const ensure=(ok,text)=>{if(!ok)throw new Error('Performance controls: '+text);};
export async function applyPerformanceControls(base,composition,asset,{enabled=true}={}){
 ensure(typeof enabled==='boolean','invalid option');
 if(!enabled)return composition;
 ensure(await hash(new TextEncoder().encode(JSON.stringify(asset,null,2)+'\n'))===CONTROLS_SHA256,'package verification failed');
 ensure(asset.format==='freakswap.performance-controls'&&asset.version===1,'unknown package');
 ensure(await hash(base)===asset.baseSHA256,'official base changed');
 ensure(composition.structuralVerified&&await hash(composition.image)===composition.sha256,'engine composition is unverified or changed');
 const runtime=composition.extensions?.twist||composition.extensions?.sixop;
 const name=runtime?'shared':'plain',spec=asset.variants[name],before=composition.image,image=before.slice(),writes=[];
 const selected=composition.selected||[],twist=selected.some(a=>a.twist),sixop=selected.some(a=>a.sixop_bank!==undefined);
 ensure(!!runtime===(twist||sixop),'unknown engine memory contract');
 const loadRaw=0x48e08,loadTarget=runtime?runtime.roots[twist?8:12]:null;
 if(runtime)ensure(Number.isInteger(loadTarget)&&same(before.slice(loadRaw,loadRaw+4),branch(FLASH_BASE+loadRaw,loadTarget,true)),'preset continuation differs from the verified engine hook');
 function write(raw,data){ensure(Number.isSafeInteger(raw)&&raw>=0&&raw+data.length<=image.length,'invalid write');ensure(!writes.some(w=>raw<w.end&&raw+data.length>w.raw),'overlapping writes');image.set(data,raw);writes.push({raw,end:raw+data.length});}
 for(const w of spec.windows){const expected=unhex(w.expected);ensure(same(before.slice(w.raw,w.raw+expected.length),expected),'UI code region already occupied');write(w.raw,Uint8Array.from(atob(w.data),c=>c.charCodeAt(0)));}
 for(const e of spec.edits){const expected=unhex(e.expected),data=unhex(e.data);
  if(e.raw===0x53884){const sp=read(before,e.raw);ensure(sp===(runtime?(twist?0x2001ff00:0x2001ff80):0x20020000),'unexpected existing RAM reservation');write(e.raw,word(spec.state));}
  else {ensure((runtime&&e.raw===loadRaw)||same(before.slice(e.raw,e.raw+expected.length),expected),'UI hook already occupied');write(e.raw,data);}
 }
 if(runtime){ensure(same(image.slice(spec.loadContinuation,spec.loadContinuation+4),unhex(spec.loadExpected)),'load trampoline changed');image.set(branch(FLASH_BASE+spec.loadContinuation,loadTarget,true),spec.loadContinuation);}
 // Recompute preservation independently of the composition writer's edits.
 const allowed=[...spec.windows.map(w=>[w.raw,w.raw+unhex(w.expected).length]),...spec.edits.map(e=>[e.raw,e.raw+unhex(e.data).length])];
 for(let i=0;i<image.length;i++)if(image[i]!==before[i])ensure(allowed.some(([a,b])=>i>=a&&i<b),'write outside UI ownership');
 ensure(same(image.slice(0,0x1ec),before.slice(0,0x1ec)),'engine vector table changed');
 ensure(!runtime||spec.state+spec.stateBytes<=Math.min(...[composition.extensions?.twist?.state_address,composition.extensions?.sixop?.state_address].filter(Number.isInteger)),'RAM overlap');
 return {...composition,image,sha256:await hash(image),performanceControls:{enabled:true,version:2,variant:name,stateAddress:spec.state,stateBytes:spec.stateBytes,symbols:spec.symbols,loadContinuation:loadTarget,assetSHA256:CONTROLS_SHA256,independentPreservationVerified:true},structuralVerified:true};
}
