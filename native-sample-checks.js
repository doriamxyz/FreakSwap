// Sample storage reads are synchronous synthetic PCM fixtures here. Native DSP,
// selector, note allocator and audio coordinator execute unchanged.
import {audioFixture} from './arm-checks.js?raster-20261026';
import {hash} from './compose.js?raster-20261026';
const OWNER=0x20004830,COMMON=0x2000484c,STRIDE=0x59e4,KEYBOARD=0x20003778,ALLOCATOR=0x20004384,BUFFER=0x21005000,STORAGE=0x200018b8,CLOCK=0x20003cdc;
const ensure=(v,s)=>{if(!v)throw new Error('Native Sample audio check: '+s);};
const u16=n=>{const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,n,true);return b;};
export async function checkNativeSample(uc,image,selected,onProgress=()=>{}){
 const f=audioFixture(uc,image),{e,read32,put32,call,hook,r,w,set,render}=f,a=selected.find(a=>a.native_sample),boot=selected.find(a=>a.runtime_boot)?.runtime_boot;
 try{
  if(boot)call(boot);
  const samples=16384,pcm=new Uint8Array(samples*2),v=new DataView(pcm.buffer);for(let i=0;i<samples;i++)v.setInt16(i*2,Math.trunc(18000*Math.sin(2*Math.PI*i/97)+6000*Math.sin(2*Math.PI*i/43)),true);
  for(let slot=0;slot<128;slot++){const d=STORAGE+0x1010+slot*24;put32(d,0x300000);put32(d+4,pcm.length);e.mem_write(d+8,u16(slot+1));e.mem_write(d+23,Uint8Array.of(0));}
  put32(STORAGE+0x1c54,0);e.mem_write(CLOCK+0x210,u16(13500));
  let reads=0,dispatch=0;
  hook(0x08045890,()=>{const dest=r('R1'),off=r('R2'),packed=r('R3'),length=packed&65535,slot=(packed>>>16)&255;ensure(length===256&&slot<128,'bounded resource read');ensure(dest>=0x20000000&&dest+length<=0x20020000,'read destination');const b=new Uint8Array(length);if(off<pcm.length)b.set(pcm.slice(off,Math.min(off+length,pcm.length)));e.mem_write(dest,b);reads++;w('R0',1);w('PC',r('LR'));});
  hook(a.runtime_native_roots[2]&~1,()=>dispatch++);
  call(0x0804d928,[ALLOCATOR]);call(0x080482b0,[KEYBOARD]);put32(KEYBOARD,ALLOCATOR);call(0x0803ef68,[0x2001c894,0x21006000]);w('R0',OWNER);e.emu_start(0x08038b03,0x08038b58,0,200000);ensure(r('PC')===0x08038b58,'native note binder');
  call(0x08048304,[KEYBOARD,ALLOCATOR,0x20000c98,0x20003c8c],100000,[0x20003a88,0x20003a64,0x20003cdc,0x200035f8,0x2000181c,0x20003704,0x20001834,0x20003b00,0x20000eec]);call(0x08028c88,[0x20003a88]);call(0x0800e168,[0x20001834]);e.mem_write(KEYBOARD+0x2dc,new Uint8Array(8).fill(8));
  const note=(key,on=true,source=4)=>{const result=call(0x08048524,[KEYBOARD,(on?0x90:0x80)|(key<<8)|((on?100:64)<<16),source,0],100000,[0,1]);ensure(result===1,'logical note callback key '+key+' result '+result+' models '+Array.from({length:4},(_,i)=>e.mem_read(COMMON+i*STRIDE+0x50a8,1)[0]));};
  const records=()=>Array.from({length:4},(_,i)=>e.mem_read(ALLOCATOR+2+i*12,12));
  const cores=()=>Array.from({length:4},(_,i)=>read32(read32(COMMON+i*STRIDE+0x50ac)+0x5c));
  const states=()=>cores().map(c=>read32(c+0x18)+1024);
  const checkRanges=()=>cores().forEach(c=>{const start=read32(c+0x70),end=read32(c+0x74);ensure(start<end&&end<samples,'slice range');});
  const select=id=>{set('Gen.Chord',0);set('VCO.Type',Math.floor((id*32767+11)/22));for(let i=0;i<4;i++)render();};
  select(19);set('Gen.Parafon',32767);set('VCO.Param1',8192);set('VCO.Param2',32767);set('VCO.Param3',0);for(let i=0;i<4;i++)render();call(0x08049a98,[KEYBOARD,4]);
  [48,55,60,67].forEach((n,i)=>note(n,true,[4,1,2,5][i]));
  for(let i=0;i<4;i++)render();ensure(records().every(b=>b[0]===1),'four allocated voices');
  const guards=states();guards.forEach(s=>e.mem_write(s+32,new Uint8Array(32).fill(0xc5)));let pcmOut=[];
  onProgress('Checking Raster: four voices and sample playback…');
  for(let i=0;i<160;i++){render();const d=new DataView(e.mem_read(BUFFER,64).buffer);for(let j=0;j<32;j++)pcmOut.push(d.getInt16(j*2,true));checkRanges();}
  ensure(pcmOut.some(x=>Math.abs(x)>1)&&reads>0&&dispatch>=640,'native Sample audio and dispatch');guards.forEach(s=>ensure(e.mem_read(s+32,32).every(v=>v===0xc5),'per-voice scratch guard'));
  const phase=[];e.mem_write(CLOCK+0x20c,Uint8Array.of(1));e.mem_write(CLOCK+0x1bc,Uint8Array.of(0));put32(CLOCK+0x1c4,0);
  for(const tick of [0,1,59,60,61,119,120,120]){put32(CLOCK+0x1c4,tick);const before=states().map(s=>read32(s+16));render();const after=states().map(s=>read32(s+16));const expected=[0,60,120].includes(tick)&&!(tick===120&&phase.at(-1)?.tick===120);ensure(after.every((v,i)=>v-before[i]===(expected?1:0)),'shared clock grid');phase.push({tick,onsets:after});}
  e.mem_write(CLOCK+0x20c,Uint8Array.of(0));set('Arp.Enable',0);const counts=states().map(s=>read32(s+16));for(let i=0;i<190;i++)render();ensure(states().every((s,i)=>read32(s+16)>=counts[i]+3),'leaving arp/transport restores continuous repeats');
  // Sample selection still uses native parameter 9. Each change must prepare
  // metadata before Sample's real renderer sees the first new slice.
  const changes=[];
  for(const slot of [1,127,0,2,0]){set('VCO.SmpIdx',slot*256);render();checkRanges();cores().forEach(c=>ensure(e.mem_read(c+0x90,1)[0]===slot&&new DataView(e.mem_read(c+0x84,2).buffer).getUint16(0,true)===slot+1,'first changed sample metadata'));changes.push(slot);}
  [48,55,60,67].forEach((n,i)=>note(n,false,[4,1,2,5][i]));
  onProgress('Checking Raster: unison and note changes…');
  set('Gen.Chord',32767);set('Gen.UniCnt',32767);set('Gen.UniSprd',12000);for(let i=0;i<4;i++)render();call(0x08049a98,[KEYBOARD,4]);note(60,true,5);for(let i=0;i<8;i++)render();ensure(records().every(b=>b[0]===1&&b[2]===60),'four unison voices');
  const pitches=cores().map(c=>read32(c+4));ensure(JSON.stringify(pitches)==='[11211042,12732656,10745488,10745488]','unison pitch increments must match the stock Sample fixture: '+JSON.stringify(pitches));note(60,false,5);ensure(records().every(b=>b[0]===0),'unison release');
  set('Gen.Chord',0);for(let i=0;i<4;i++)render();
  const history=[],held=new Set();for(const [key,on] of [[48,true],[55,true],[60,true],[67,true],[55,false],[84,true],[48,false],[60,false],[67,false],[84,false]]){note(key,on);if(on)held.add(key);else held.delete(key);for(let i=0;i<4;i++)render();const active=records().filter(b=>b[0]).map(b=>b[2]).sort((a,b)=>a-b);ensure(JSON.stringify(active)===JSON.stringify([...held].sort((a,b)=>a-b)),'paraphonic note history');checkRanges();history.push({key,on,active});}
  // Return from every retained sample/granular frontend to Raster.
  const lifecycle=[];for(const id of [20,21,22,6,19]){select(id);select(19);ensure(states().every(s=>read32(s)===0x52535431),'Raster state restored after other engine');lifecycle.push(id);}
  const host=read32(COMMON+0x50ac),out=0x21008000;e.mem_write(STORAGE+0x1010+23,Uint8Array.of(255));call(a.runtime_native_roots[1],[host,9,0]);e.mem_write(out,new Uint8Array(64).fill(0x55));call(a.runtime_native_roots[2],[host,out]);ensure(e.mem_read(out,64).every(x=>x===0),'invalid sample silence');
  return {passed:true,voices:4,synthetic_pcm_sha256:await hash(pcm),output_sha256:await hash(new Int16Array(pcmOut)),peak:Math.max(...pcmOut.map(Math.abs)),resource_reads:reads,native_dispatches:dispatch,free_repeats_after_transport:true,phase,sample_changes:changes,unison_pitch_increments:pitches,paraphonic_history:history,lifecycle_ids:lifecycle,scope:'Native Sample DSP/coordinator, selector, notes, four voices, unison, scratch bounds and grid. Sample resource reads are synchronous synthetic PCM; clock fields are explicit fixtures. Separate Python suite executes native realtime clock and QSPI/cache path. Physical timing/CPU/DMA are not verified.',hardware_verified:false};
 }finally{f.close();}
}
