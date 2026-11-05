import {audioFixture} from './arm-checks.js?raster-20261026';
export function checkPerformanceControls(uc,image,spec,selected=[]){
 const f=audioFixture(uc,image),{e,call,put32,hook,r,w}=f,STATE=spec.stateAddress,INPUT=0x2001db0c,M=0x20003704,K=0x20003778,A=0x20000c98;
 const ensure=(ok,s)=>{if(!ok)throw new Error('Performance control check: '+s);};
 const mode=()=>e.mem_read(STATE+4,1)[0],edge=(t,down,c=0x804)=>{put32(0x2001e1d8,t*10);call(down?0x0804347c:0x08043494,[INPUT,c,12]);};
 const encode=(c,value)=>{call(0x08021a8c,[0x21007000,255,0,c],100000,[value]);return e.mem_read(0x21007000,6)[5];};
 try {
  const boot=selected.find(a=>a.runtime_boot)?.runtime_boot;if(boot)call(boot);
  hook(0x08021414,()=>{w('R0',0);w('PC',r('LR'));});
  call(0x0803b760,[M]);put32(0x2000371c,M);call(0x08043b00,[INPUT]);
  ensure(mode()===0,'initial mode');
  for(const [ms,down] of [[0,1],[50,0],[120,1],[170,0]])edge(ms,down);
  ensure(e.mem_read(M,1)[0]===1&&encode(0x805,0)===255,'double tap and Shift light');
  edge(500,1);edge(550,0);ensure(e.mem_read(M,1)[0]===0&&encode(0x805,255)===0,'unlock');
  f.set('Gen.Parafon',32767);f.set('Gen.Chord',0);
  call(0x08025874,[A]);call(0x080482b0,[K]);put32(K,0x20004384);call(0x0804d928,[0x20004384]);call(0x08049a98,[K,4]);
  e.mem_write(M,Uint8Array.of(0,1));e.mem_write(K+0x1ba,Uint8Array.of(1));e.mem_write(K+0x1bb,Uint8Array.of(1));e.mem_write(K+0x1bc,Uint8Array.of(3,3));e.mem_write(K+0x1c0,Uint8Array.of(3));e.mem_write(K+0x2df,Uint8Array.of(8));
  for(const n of [60,64,67])call(0x08025d78,[A,0x90|(n<<8)|(100<<16)]);
  const chord=t=>{edge(t,1);edge(t+10,1,0x1100);edge(t+20,0,0x1100);edge(t+30,0);};
  chord(1000);ensure(mode()===1&&e.mem_read(M,1)[0]===0,'free play entry after real release');ensure(encode(0x1108,0)===255,'initial Hold light');
  call(0x08025a08,[A,1]);ensure(mode()===1&&encode(0x1108,255)===0,'free play blink off');call(0x08025a08,[A,1]);ensure(encode(0x1108,0)===255,'free play blink on');
  chord(1100);ensure(mode()===2&&encode(0x1108,0)===255,'edit mode');call(0x08025a08,[A,1]);ensure(encode(0x1108,0)===255,'steady edit light');
  chord(1200);ensure(mode()===1&&e.mem_read(M,1)[0]===0,'return to free without accidental latch');
  return {passed:true,nativeButtons:true,doubleTap:true,freeEdit:true,holdBlink:true,stateAddress:STATE};
 } finally { f.close(); }
}
