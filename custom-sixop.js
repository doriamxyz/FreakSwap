import {CUSTOM_RUNTIME} from './custom-sixop-runtime.js';
// Copyright 2021 Emilie Gillet.
//
// Author: Emilie Gillet (emilie.o.gillet@gmail.com)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
// 
// See http://creativecommons.org/licenses/MIT/ for more information.
//
// Voice-field unpacking adapted from Plaits fm::Patch::Unpack.
// Convert a Yamaha DX7 32-voice bulk dump to the existing Six-OP resource ABI.
export const CUSTOM_ENGINE='six_op_fm_custom';
const widths=[...Array.from({length:6},()=>[...Array(11).fill(7),2,2,3,2,3,7,1,5,7,4]).flat(),...Array(8).fill(7),5,3,1];
const encode=bytes=>btoa(String.fromCharCode(...bytes));
export function parseCustomBank(input){
 const bytes=new Uint8Array(input);
 if(bytes.length!==4104||bytes[0]!==0xf0||bytes[1]!==0x43||bytes[2]>15||bytes[3]!==9||bytes[4]!==0x20||bytes[5]!==0||bytes[4103]!==0xf7)throw new Error('Choose a DX7 .syx file containing one bank of 32 voices.');
 if(bytes.slice(6,4103).some(v=>v>127))throw new Error('This bank contains invalid SysEx data.');
 const voices=bytes.slice(6,4102);if((voices.reduce((sum,v)=>sum+v,0)+bytes[4102])%128)throw new Error('The bank checksum does not match. Try exporting the .syx again.');
 const bits=new Uint8Array(3009),controls=new Uint8Array(64),names=new Uint8Array(352),transpose=new Uint8Array(32),patchNames=[];
 for(let p=0;p<32;p++){
  const d=voices.subarray(p*128,(p+1)*128),unpacked=[];
  for(let o=0;o<6;o++){const s=d.subarray(o*17,o*17+17);unpacked.push(...s.slice(0,11).map(v=>Math.min(v,99)),s[11]&3,(s[11]>>2)&3,s[12]&7,s[13]&3,(s[13]>>2)&7,Math.min(s[14],99),s[15]&1,(s[15]>>1)&31,Math.min(s[16],99),Math.min(s[12]>>3,14));}
  unpacked.push(...d.slice(102,110).map(v=>Math.min(v,99)),d[110]&31,d[111]&7,(d[111]>>3)&1);
  let bit=p*94*8;unpacked.forEach((v,i)=>{for(let j=0;j<widths[i];j++,bit++)bits[bit>>3]|=((v>>j)&1)<<(bit&7);});
  controls[p*2]=d[110]&31;controls[p*2+1]=d[111]&7;transpose[p]=Math.min(d[117],48);
  // OLED strings must stay printable and NUL terminated.
  const name=Array.from(d.slice(118,128),v=>v>=32&&v<=126?v:32);names.set(name,p*11);patchNames.push(String.fromCharCode(...name).trim()||'Unnamed '+(p+1));
 }
 const module={format:'freakswap.arm-module',version:1,sections:[bits,controls,names,transpose].map((data,id)=>({id,size:data.length,alignment:1,data:encode(data),relocations:[]})),roots:[0,2,1,3].map(section=>({section,value:0}))};
 return {module,patchNames};
}
const identity=async module=>{const serialized=new TextEncoder().encode(JSON.stringify(module,null,2)+'\n'),digest=await crypto.subtle.digest('SHA-256',serialized),id=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');return {id,size:serialized.length,module};};
export async function customBank(input,name='Custom bank.syx',selection=null){
 const full=parseCustomBank(input),bytes=new Uint8Array(input).slice(),selected=selection===null?Array.from({length:32},(_,i)=>i):selection;
 if(!Array.isArray(selected)||selected.some(i=>!Number.isInteger(i)||i<0||i>31)||new Set(selected).size!==selected.length)throw new Error('Invalid preset selection.');
 const indices=[...selected].sort((a,b)=>a-b),count=indices.length,module=structuredClone(full.module);
 if(count!==32)for(const [i,stride] of [94,2,11,1].entries()){const source=Uint8Array.from(atob(full.module.sections[i].data),c=>c.charCodeAt(0)),data=new Uint8Array(count*stride+(i===0?1:0));indices.forEach((p,j)=>data.set(source.slice(p*stride,(p+1)*stride),j*stride));module.sections[i].size=data.length;module.sections[i].data=encode(data);}
 const runtimes=count>0&&count<32?await Promise.all([0,1,2].map(async slot=>{const runtime=structuredClone(CUSTOM_RUNTIME),root=runtime.roots[21],section=runtime.sections[root.section],data=Uint8Array.from(atob(section.data),c=>c.charCodeAt(0));new DataView(data.buffer).setUint32(root.value+slot*4,count,true);section.data=encode(data);return identity(runtime);})):null;
 return {...await identity(module),patchNames:indices.map(i=>full.patchNames[i]),allPatchNames:full.patchNames,selected:indices,count,runtimes,bytes,name:String(name).slice(0,160),sourceId:(await identity(full.module)).id};
}
export function customContext(base,modules,recipe,bank){
 if(!recipe.some(r=>r.engine===CUSTOM_ENGINE))return {library:base,modules};
 if(bank?.count===0)throw new Error('Select at least one preset to import.');
 if(!bank)throw new Error('Load a 32-voice .syx bank for 6-Op FM Custom.');
 const used=new Set(recipe.map(r=>Object.values(base.engines).find(e=>e.engine===r.engine)?.sixop_bank).filter(n=>n!==undefined)),slot=[0,1,2].find(n=>!used.has(n));
 if(slot===undefined)throw new Error('Six-OP supports three banks per firmware. Keep Custom and up to two of A, B and C.');
 const library=structuredClone(base),factory=Object.values(library.engines).find(e=>e.sixop_bank===slot);
 library.engines[CUSTOM_ENGINE]={...factory,engine:CUSTOM_ENGINE,name:'Six-OP FM Custom · '+bank.name+(bank.count<32?' · '+bank.count+' patches':''),labels:['Six-Op User',...factory.labels.slice(1)],resources:[bank.id]};
 library.extensions.sixop.bank_modules[String(slot)]=bank.id;
 library.modules[bank.id]={url:'modules/'+bank.id+'.json',size:bank.size,sha256:bank.id};
 const generated={...modules,[bank.id]:bank.module};if(bank.runtimes){const runtime=bank.runtimes[slot];for(const engine of Object.values(library.engines))if(engine.sixop_bank!==undefined)engine.module=runtime.id;library.extensions.sixop.module=runtime.id;library.modules[runtime.id]={url:'modules/'+runtime.id+'.json',size:runtime.size,sha256:runtime.id};generated[runtime.id]=runtime.module;}
 return {library,modules:generated};
}
