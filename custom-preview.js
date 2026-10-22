// Audition the unchanged ARM DSP in an isolated synthetic memory image.
// No official firmware is needed, assembled or exported by this renderer.
import {FLASH_BASE,linkModule} from './compose.js';
import {armMachine} from './arm-checks.js';
const RATE=48000,OBJ=0x20006000,ALLOC=0x20007000,ARENA=0x20008000,PARAM=0x2000d000,OUT=0x2000d100,AUX=0x2000d200,ENV=0x2000d300;
const words=values=>{const b=new Uint8Array(values.length*4),v=new DataView(b.buffer);values.forEach((n,i)=>v.setUint32(i*4,n,true));return b;};
const floats=values=>{const b=new Uint8Array(values.length*4),v=new DataView(b.buffer);values.forEach((n,i)=>v.setFloat32(i*4,n,true));return b;};
export function previewImage(dsp,bank){
 const offset=dsp.sections.length,resource=bank.sections.map(s=>({...s,id:s.id+offset})),linked=linkModule({...dsp,sections:[...dsp.sections,...resource],roots:dsp.roots.slice(0,4)},[[0x30000,0x60000]]),image=new Uint8Array(0x74000);
 for(const c of linked.chunks)image.set(c.data,c.start);
 const address=t=>FLASH_BASE+linked.placements[t.section].start+t.value,roots=dsp.roots.map(address),bankRoots=bank.roots.map(t=>address({...t,section:t.section+offset}));
 image.set(words([1]),roots[6]-FLASH_BASE);image.set(words(bankRoots),roots[20]-FLASH_BASE);
 // Source tables are mathematical sine/pitch ratios, generated independently.
 image.set(floats(Array.from({length:1025},(_,i)=>Math.sin(i*2*Math.PI/1024))),0x0807d4e0-FLASH_BASE);
 image.set(floats(Array.from({length:257},(_,i)=>i===256?0:2**(i/(256*12)))),0x0807e8e4-FLASH_BASE);
 image.set(floats(Array.from({length:257},(_,i)=>i===256?0:2**((i-128)/12))),0x0807ece8-FLASH_BASE);
 // Minimal unmodulated model/Wave getters for the existing macro callback.
 image.set([0,0x20,0x70,0x47],0x0800e644-FLASH_BASE);
 image.set([0,0x48,0x70,0x47,0,0,0,0],0x08023c2c-FLASH_BASE);
 return {image,roots};
}
export async function renderCustomPreview(uc,fixture,patch,{seconds=2.4,patchCount=32,onProgress=()=>{}}={}){
 if(!Number.isInteger(patch)||patch<0||patch>=patchCount||!Number.isInteger(patchCount)||patchCount<1||patchCount>32||seconds<=0||seconds>3.2)throw new Error('Choose a patch from 1 to 32.');
 const {image,roots}=fixture,m=armMachine(uc,image),{e,call,read32}=m;
 try{
  e.mem_write(0x20000004,floats([55/RATE]));e.mem_write(0x08023c30,words([Math.floor((patch+.5)*32768/patchCount)]));
  call(roots[13]);e.mem_write(ALLOC,words([ARENA,ARENA,16384,16384]));call(roots[0],[OBJ,ALLOC],2000000);
  const gate=read32(OBJ+20);if(gate!==OBJ+0x668)throw new Error('The preview voice could not initialize.');
  const frames=Math.floor(seconds*RATE/16)*16,pcm=new Float32Array(frames);
  for(let block=0;block<frames/16;block++){
   const time=block*16/RATE,local=time%.8,held=local<.56,params=new Uint8Array(24),v=new DataView(params.buffer);
   params[0]=held?4:0;[([48,55,60][Math.floor(time/.8)%3]),.5,.5,(patch+.5)/patchCount,.8].forEach((n,i)=>v.setFloat32(4+i*4,n,true));
   e.mem_write(gate,Uint8Array.of(Number(held)));e.mem_write(PARAM,params);e.mem_write(ENV,Uint8Array.of(0));
   call(roots[3],[OBJ,PARAM,OUT,AUX],2000000,[16,ENV]);
   const result=new DataView(e.mem_read(OUT,64).buffer);
   for(let i=0;i<16;i++){const n=result.getFloat32(i*4,true);if(!Number.isFinite(n))throw new Error('This patch could not be rendered.');pcm[block*16+i]=n;}
   if(block%128===0){onProgress(block*16/frames);await new Promise(resolve=>setTimeout(resolve,0));}
  }
  return encodePreview(pcm,RATE);
 }finally{m.close();}
}
export function encodePreview(pcm,rate=RATE){
 const mean=pcm.reduce((s,v)=>s+v,0)/pcm.length;let sum=0,peak=0;for(let i=0;i<pcm.length;i++){pcm[i]-=mean;sum+=pcm[i]*pcm[i];peak=Math.max(peak,Math.abs(pcm[i]));}
 const rms=Math.sqrt(sum/pcm.length),gain=peak?Math.min(.12/(rms||1),.5/peak,8):1,bytes=new Uint8Array(44+pcm.length*2),v=new DataView(bytes.buffer),text=(at,s)=>{for(let i=0;i<s.length;i++)bytes[at+i]=s.charCodeAt(i);};
 text(0,'RIFF');v.setUint32(4,bytes.length-8,true);text(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,pcm.length*2,true);
 for(let i=0;i<pcm.length;i++)v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,pcm[i]*gain*Math.min(1,i/(rate*.008),(pcm.length-1-i)/(rate*.03))))*32767),true);
 return {bytes,silent:peak<1e-5,rate,frames:pcm.length};
}
