import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {composeRaw,unpackOfficial,hash} from '../v2/compose.js';
import {planUniversal} from '../v2/universal.js';
import {verifyUniversal} from '../v2/verify-universal.js';
import {armMachine} from '../v2/arm-checks.js';
const require=createRequire(import.meta.url);
const library=JSON.parse(await fs.readFile(new URL('../v2/library.json',import.meta.url)));
const baseline=JSON.parse(await fs.readFile(new URL('./fixtures/v4-legacy-library.json',import.meta.url)));
const modules={};for(const [id,m] of Object.entries(library.modules))modules[id]=JSON.parse(await fs.readFile(new URL('../v2/'+m.url,import.meta.url)));
const official=process.env.FREAKSWAP_FIRMWARE?new Uint8Array(await fs.readFile(process.env.FREAKSWAP_FIRMWARE)):null;
const raw=official?(await unpackOfficial(official,library)).raw:null;
const row=(engine,original='speech',variant='normal')=>({engine,original,variant});
const mixed=[row('six_op_fm_a','two_op_fm'),row('six_op_fm_b','formant'),row('six_op_fm_c','chords'),row('phase_distortion')];

test('eleven documented Palette controls cover twelve audible output variants',()=>{
 const engines=Object.values(library.engines).filter(e=>e.twist);
 assert.equal(engines.length,12);assert.equal(new Set(engines.map(e=>e.engine)).size,11);
 for(const e of engines){assert(e.twist.index>=0&&e.twist.index<11);assert.equal(e.twist.default,16384);assert(e.twist.description.length>20);assert(e.twist.label.length<=13);assert(e.object_bytes<=336);}
 assert(!library.engines.filtered_noise_dual_band.twist);
 assert.match(library.engines.filtered_noise_dual_band.twist_note,/OUT only/);
 assert.equal(library.engines.filtered_noise_dual_band.module,baseline.engines.filtered_noise_dual_band.module);
});

test('Six-OP definitions, resources, runtime and source identity are unchanged',async()=>{
 assert.deepEqual(library.extensions.sixop,baseline.extensions.sixop);
 for(const bank of 'abc')assert.deepEqual(library.engines['six_op_fm_'+bank],baseline.engines['six_op_fm_'+bank]);
 const identity=JSON.parse(await fs.readFile(new URL('../tools/sixop/source-identity.json',import.meta.url)));
 assert(identity);
 for(const id of [baseline.extensions.sixop.module,...Object.values(baseline.extensions.sixop.bank_modules)])assert.equal(await hash(new TextEncoder().encode(JSON.stringify(modules[id],null,2)+'\n')),id);
});

test('TWIST runtime is linked only when the selected audible output supports it',()=>{
 const mid=library.extensions.twist.module;
 assert(planUniversal(library,[row('phase_distortion')],modules).moduleMaps[mid]);
 assert(!planUniversal(library,[row('six_op_fm_a')],modules).moduleMaps[mid]);
 assert(!planUniversal(library,[row('filtered_noise','speech','dual_band')],modules).moduleMaps[mid]);
});

test('Six-OP alone and Filtered Noise AUX reproduce the previous full binary',{skip:!raw},async()=>{
 for(const recipe of [[row('six_op_fm_a')],[row('filtered_noise','speech','dual_band')]]){
  const now=await composeRaw(raw,library,recipe,modules),old=await composeRaw(raw,baseline,recipe,modules);
  assert.deepEqual(now.image,old.image);assert(!now.extensions?.twist);
 }
});

test('mixed selections bind an isolated TWIST block and chain the unchanged Six-OP callbacks',{skip:!raw},async()=>{
 const c=await composeRaw(raw,library,mixed,modules),v=new DataView(c.image.buffer),tw=c.extensions.twist,sf=c.extensions.sixop;
 assert.equal(v.getUint32(0,true),0x2001ff00);assert.equal(sf.state_address,0x2001ff80);
 assert.deepEqual(Array.from({length:7},(_,i)=>v.getUint32(tw.next_raw+i*4,true)),[sf.roots[7],sf.roots[8],sf.roots[9],sf.roots[10],sf.roots[17],sf.roots[18],sf.roots[13]]);
 assert(verifyUniversal(raw,library,c).passed);
 for(const address of [tw.models_raw+11*12,tw.next_raw+16,0x36bc8,0x53884]){const bad={...c,image:c.image.slice()};bad.image[address]^=1;assert.throws(()=>verifyUniversal(raw,library,bad));}
});

function machine(uc,c){
 const m=armMachine(uc,c.image),{e,call,put32,r,w}=m,roots=c.extensions.twist.roots;
 let model=11;const texts=[];
 const ret=()=>w('PC',r('LR'));
 m.hook(0x0800e644,()=>{w('R0',model);ret();});
 m.hook(0x08023c2c,()=>{w('R0',0);ret();});
 m.hook(0x0805488c,ret);
 // Native OLED encoding is independently exercised by the recorded Python
 // qualification; this small unit fixture isolates callback/codec semantics.
 m.hook(0x080557e8,()=>{if(r('R1'))texts.push(Buffer.from(e.mem_read(r('R1'),r('R2'))).toString('ascii'));ret();});
 m.hook(0x0805579c,ret);
 call(roots[14]);
 return {...m,roots,texts,setModel:n=>model=n};
}

test('native encoder clamps signed extremes, requires physical Shift, and preserves native controls',{skip:!raw},async()=>{
 const c=await composeRaw(raw,library,[row('phase_distortion')],modules),uc=await require('../v2/unicorn_arm.js')(),m=machine(uc,c),{e,call,put32,roots}=m;
 try{
  const state=0x2001ff00,value=()=>new DataView(e.mem_read(state+4,2).buffer).getUint16(0,true);
  assert.equal(value(),16384);assert.equal(call(roots[9],[0,0,1]),0);assert.equal(value(),16384);
  put32(0x20003728,2);assert.equal(call(roots[9],[0,1,1]),0);assert.equal(value(),16384);
  assert.equal(call(roots[9],[0,0,0]),1);assert.equal(value(),16384);
  assert.equal(call(0x08042bc8,[0,0,0x7fffffff]),0);assert.equal(value(),32767);
  call(0x08042bc8,[0,0,0x80000000]);assert.equal(value(),0);
  m.setModel(12);assert.equal(call(roots[9],[0,0,1]),0);assert.equal(value(),0);
 }finally{m.close();}
});

test('TW4 codecs roundtrip every family, reject malformed fields, reset old presets and fail capacity safely',{skip:!raw},async()=>{
 const c=await composeRaw(raw,library,[row('phase_distortion')],modules),uc=await require('../v2/unicorn_arm.js')(),m=machine(uc,c),{e,call,roots}=m,b=0x20008000,state=0x2001ff00;
 try{
  const expected=Buffer.alloc(22);for(let i=0;i<11;i++)expected.writeUInt16LE(i*2901,i*2);e.mem_write(state+4,expected);
  e.mem_write(b,new Uint8Array(2048));const end=call(roots[12],[0,b,32]);assert.equal(end,109);
  const valid=new Uint8Array(e.mem_read(b,2048));call(roots[3]);call(roots[13],[0,b,2048]);assert.deepEqual(Buffer.from(e.mem_read(state+4,22)),expected);
  for(const offset of [37,40,41,43,47]){e.mem_write(b,valid);const broken=valid.slice();broken[offset]^=0x80;e.mem_write(b,broken);call(roots[13],[0,b,2048]);assert.deepEqual(Array.from(new Uint16Array(e.mem_read(state+4,22).buffer)),new Array(11).fill(16384));}
  e.mem_write(b+32,Uint8Array.of(0x20));call(roots[13],[0,b,2048]);assert.deepEqual(Array.from(new Uint16Array(e.mem_read(state+4,22).buffer)),new Array(11).fill(16384));
  assert.equal(call(roots[12],[0,b,2000]),0xffffffff);
 }finally{m.close();}
});
