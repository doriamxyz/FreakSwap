// Execute native firmware routines under the ARM interpreter in a Worker.
// This is a bounded test harness, not a device/boot/interrupt simulation.
import {FLASH_BASE,hash} from './compose.js?portable-20261020';
const STOP=0x0800b000,CONTROLLER=0x2001c898,OWNER=0x20004830,COMMON=0x2000484c,STRIDE=0x59e4;
const BUFFER=0x21005000,ALLOCATOR=0x20004384,KEYBOARD=0x20003778;
const assert=(ok,message)=>{if(!ok)throw new Error('ARM verification failed: '+message);};
const u8=n=>Uint8Array.of(n),u16=n=>{const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,n,true);return b;};
function bytes32(n){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,true);return b;}
function f32(n){const b=new Uint8Array(4);new DataView(b.buffer).setFloat32(0,n,true);return b;}
export function armMachine(uc,image){
 const e=new uc.Unicorn(uc.ARCH_ARM,uc.MODE_THUMB|uc.MODE_MCLASS);
 assert(typeof e.ctl_set_cpu_model==='function','Cortex-M4 model control is required');e.ctl_set_cpu_model(uc.CPU_ARM_CORTEX_M4);
 e.mem_map(0x08000000,0x80000,uc.PROT_ALL);e.mem_map(0x20000000,0x20000,uc.PROT_ALL);e.mem_write(FLASH_BASE,image);
 e.reg_write_i32(uc.ARM_REG_C1_C0_2,0xf00000);e.reg_write_i32(uc.ARM_REG_FPEXC,0x40000000);
 const read32=p=>new DataView(e.mem_read(p,4).buffer).getUint32(0,true),put32=(p,n)=>e.mem_write(p,bytes32(n));
 const r=n=>e.reg_read_i32(uc['ARM_REG_'+n])>>>0,w=(n,v)=>e.reg_write_i32(uc['ARM_REG_'+n],v|0);
 function call(fn,args=[],count=100000,stackArgs=[]){args.forEach((v,i)=>w('R'+i,v));w('SP',0x2001e000);stackArgs.forEach((v,i)=>put32(0x2001e000+i*4,v));w('LR',STOP|1);e.emu_start(fn|1,STOP,0,count);assert(r('PC')===STOP,'native function did not return');return r('R0');}
 const hooks=[];function hook(address,fn){hooks.push(e.hook_add(uc.HOOK_CODE,(engine,at)=>fn(Number(at)),{},address,address));}
 function hookRead(address,length,fn){hooks.push(e.hook_add(uc.HOOK_MEM_READ,(engine,type,at,size,value)=>fn(Number(at),size),{},address,address+length-1));}
 function close(){for(const h of hooks)e.hook_del(h);e.close();}
 return {e,read32,put32,r,w,call,hook,hookRead,close};
}
export function audioFixture(uc,image){
 const m=armMachine(uc,image),{e,read32,put32,r,w,call,hook}=m;
 e.mem_write(0x20000000,image.slice(0x7375c,0x7375c+0x2f4));e.mem_write(0x20000004,f32(55/48000));put32(0x2000011c,0x21);
 e.mem_map(0x21000000,0x10000,uc.PROT_ALL);e.mem_write(CONTROLLER+0x1400,new Uint8Array(32).fill(0xc7));
 assert(call(0x0800eb10,[CONTROLLER])===CONTROLLER,'controller construction');
 const locations={};for(let groupId=0;groupId<read32(CONTROLLER+0x24c);groupId++){
  const namePointer=call(0x080111f0,[CONTROLLER,groupId]),group=new TextDecoder().decode(e.mem_read(namePointer,4)).split('\0')[0],count=e.mem_read(0x20000408+groupId,1)[0],names=read32(0x200003a8+groupId*4),values=read32(CONTROLLER+0x2c+groupId*4),descs=read32(CONTROLLER+0x8c+groupId*4);
  for(let i=0;i<count;i++){const name=new TextDecoder().decode(e.mem_read(names+i*8,8)).split('\0')[0];locations[group+'.'+name]={id:(groupId<<8)|i,address:values+i*2,description:descs+i*2};}
 }
 put32(CONTROLLER+0x10,0x21000500);put32(0x21000500,0x21000510);put32(0x21000510,0x08009081);e.mem_write(0x08009080,Uint8Array.of(0x70,0x47));
 hook(0x0802e744,()=>w('PC',r('LR')));
 call(0x08037c90,[OWNER],20000000);
 e.mem_map(0x22000000,0x1000,uc.PROT_ALL);put32(0x20004598,0x22000000);e.mem_write(BUFFER,new Uint8Array(80));e.mem_write(BUFFER+0x48,u8(32));
 for(const a of [0x0802340c,0x08023324,0x08023368,0x080233a0])hook(a,()=>w('PC',r('LR')));
 const set=(key,value)=>{assert(locations[key],'unknown parameter '+key);const ret=call(0x08023c40,[CONTROLLER,locations[key].id,value,1]);assert(ret===0||ret===1,'parameter setter');};
 const render=()=>call(0x08036b38,[OWNER+0x18,BUFFER],1000000);
 return {...m,locations,set,render};
}
export async function checkComposition(uc,image,selected,onProgress=()=>{}){
 const start=performance.now(),f=audioFixture(uc,image),{e,read32,put32,r,w,call,set,render,hook}=f;
 const rows=[],dispatch=[],parameterReads=[],live={capture:false,object:0,objects:new Set(),coefficients:[]};hook(0x0805f6a6,()=>{dispatch.push({object:r('R0'),entry:r('R7')&~1});const pv=new DataView(e.mem_read(r('R1'),24).buffer);parameterReads.push({object:r('R0'),note:pv.getFloat32(4,true),controls:[8,12,16].map(off=>pv.getFloat32(off,true))});if(live.capture)live.object=r('R0');});
 try{
  // Native note allocator and its actual keyboard dependency.
  call(0x0804d928,[ALLOCATOR]);call(0x080482b0,[KEYBOARD]);put32(KEYBOARD,ALLOCATOR);
  call(0x0803ef68,[0x2001c894,0x21006000]);w('R0',OWNER);e.emu_start(0x08038b03,0x08038b58,0,200000);assert(r('PC')===0x08038b58,'native note binding');
  for(let i=0;i<4;i++)assert(read32(COMMON+i*STRIDE+0x50b4)===ALLOCATOR+2+12*i,'voice note binding');
  const activeModels=[...selected.map(a=>({id:a.id,registry:a.registry,name:a.labels[0]}))];
  // Include the original frontends retained in the seven-slot family.
  for(const [id,registry] of [[6,0],[7,1],[8,2],[9,3],[10,4],[11,5],[12,6]])if(!selected.some(a=>a.id===id))activeModels.push({id,registry,name:'Retained original '+id});
  for(const model of activeModels){
   onProgress('Checking '+model.name+'…');call(0x0804d928,[ALLOCATOR]);set('Gen.Chord',0);set('Gen.Parafon',0);for(let i=0;i<3;i++)render();
   set('VCO.Type',Math.floor((model.id*32767+11)/22));for(let i=1;i<=3;i++)set('VCO.Param'+i,[8192,12288,20480][i-1]);set('Gen.Parafon',32767);set('Gen.Chord',0);for(let i=0;i<3;i++)render();call(0x08049a98,[KEYBOARD,4]);
   for(const [source,note] of [[4,48],[1,55],[2,60],[5,67]])call(0x0804da80,[ALLOCATOR,0x90|(note<<8)|(100<<16),0,0]);
   const active=[];for(let i=0;i<4;i++){const b=e.mem_read(ALLOCATOR+2+i*12,12);if(b[0]===1)active.push(b[2]);}assert(JSON.stringify(active)==='[48,55,60,67]','four independent note allocations');
   for(let i=0;i<8;i++)render();
   const expected=[];for(let i=0;i<4;i++){const common=COMMON+i*STRIDE,wrapper=read32(common+0x50ac),aggregate=read32(wrapper+0x5c),voice=aggregate+0x28,obj=read32(voice+0x6e4+model.registry*4),target=read32(read32(obj)+8)&~1;
    assert(e.mem_read(common+0x50a8,1)[0]===model.id,'selected ID per voice');assert(read32(aggregate+0x1c)===model.registry,'selected DSP registry');const pitch=new DataView(e.mem_read(aggregate,4).buffer).getFloat32(0,true);assert(Math.abs(pitch-[48,55,60,67][i])<0.1,'pitch per voice');expected.push({object:obj,entry:target});
   }
   const before=dispatch.length,paramBefore=parameterReads.length,samples=[];for(let b=0;b<8;b++){put32(0x22000024,b);render();const v=new DataView(e.mem_read(BUFFER,64).buffer);for(let i=0;i<32;i++)samples.push(v.getInt16(i*2,true));}
   const observed=dispatch.slice(before);
   // The retained Modal frontend can skip a silent voice; native Unicorn
   // produces 24 calls here. Selected adapters must dispatch all four.
   if(model.id===12&&!selected.some(a=>a.id===12)){assert(observed.length>0&&observed.length<=32,'retained Modal dispatch count');for(const d of observed)assert(expected.some(x=>x.object===d.object&&x.entry===d.entry),'retained Modal dispatch target');}
   else{assert(observed.length===32,'four DSP calls per block');for(let i=0;i<observed.length;i++)assert(observed[i].object===expected[i%4].object&&observed[i].entry===expected[i%4].entry,'DSP dispatch uses the selected module');}
   for(const p of parameterReads.slice(paramBefore)){const i=expected.findIndex(x=>x.object===p.object);assert(i>=0&&Math.abs(p.note-[48,55,60,67][i])<0.1,'DSP receives the note belonging to its own voice');assert(p.controls.every((v,j)=>Math.abs(v-[12288,20480,8192][j]/32768)<1e-5),'DSP receives all three current controls: '+JSON.stringify(p.controls));}
   assert(samples.some(x=>Math.abs(x)>1),'non-silent native audio');assert(e.mem_read(CONTROLLER+0x1400,32).every(x=>x===0xc7),'preset memory guard');
   rows.push({id:model.id,voices:4,blocks:8,dispatch_count:observed.length,output_sha256:await hash(new Int16Array(samples)),peak:Math.max(...samples.map(Math.abs))});
  }
  // The complete logical keyboard callback, with explicit internal-only routes.
  call(0x08048304,[KEYBOARD,ALLOCATOR,0x20000c98,0x20003c8c],100000,[0x20003a88,0x20003a64,0x20003cdc,0x200035f8,0x2000181c,0x20003704,0x20001834,0x20003b00,0x20000eec]);call(0x08028c88,[0x20003a88]);call(0x0800e168,[0x20001834]);e.mem_write(KEYBOARD+0x2dc,new Uint8Array(8).fill(8));
  const note=(source,key,on=true)=>assert(call(0x08048524,[KEYBOARD,(on?0x90:0x80)|(key<<8)|((on?100:64)<<16),source,0],100000,[0,1])===1,'logical keyboard note callback');
  const records=()=>Array.from({length:4},(_,i)=>e.mem_read(ALLOCATOR+2+i*12,12));
  f.hookRead(0x20000004,4,()=>{if(live.capture&&live.object){live.objects.add(live.object);live.coefficients.push(new DataView(e.mem_read(0x20000004,4).buffer).getFloat32(0,true));}});
  const unisonCases=[],rateCases=[],paraphonicHistory=[],lifecycleCases=[];
  for(const a of selected){
   onProgress('Checking unison and note changes: '+a.labels[0]+'…');call(0x0804d928,[ALLOCATOR]);set('Gen.Chord',0);set('Gen.Parafon',32767);set('VCO.Type',Math.floor((a.id*32767+11)/22));for(let i=0;i<4;i++)render();call(0x08049a98,[KEYBOARD,4]);set('Gen.Chord',32767);set('Gen.UniCnt',32767);set('Gen.UniSprd',12000);for(let i=0;i<3;i++)render();call(0x08049a98,[KEYBOARD,4]);note(5,60);for(let i=0;i<8;i++)render();assert(records().every(b=>b[0]===1&&b[2]===60),'four unison allocations');
   const pitches=Array.from({length:4},(_,i)=>new DataView(e.mem_read(read32(read32(COMMON+i*STRIDE+0x50ac)+0x5c),4).buffer).getFloat32(0,true));assert(new Set(pitches).size===4&&pitches.every(p=>Math.abs(p-60)<3),'native unison spread');note(5,60,false);assert(records().every(b=>b[0]===0),'unison note-off releases every voice');unisonCases.push({id:a.id,voices:4,pitches,note_off_released:true});
   set('Gen.Chord',0);for(let i=0;i<4;i++)render();
   for(const rate of [48000,32000,96000,48000]){
    call(0x0802ff0c,[0,rate]);for(const key of [60,48,60,84,60]){note(4,key);for(let block=0;block<4;block++){live.capture=true;live.object=0;live.objects.clear();live.coefficients=[];render();live.capture=false;assert(live.objects.size===4,'live pitch coefficient read by all four voices');assert(live.coefficients.every(v=>Math.abs(v/(55/rate)-1)<1e-5),'current sample-rate coefficient');}
     const rr=records();assert(rr.filter(b=>b[0]).length===1&&rr.find(b=>b[0])[2]===key,'note history allocation');for(let i=0;i<4;i++)if(rr[i][0]){const aggregate=read32(read32(COMMON+i*STRIDE+0x50ac)+0x5c),pitch=new DataView(e.mem_read(aggregate,4).buffer).getFloat32(0,true);assert(Math.abs(pitch-key)<0.1,'note history pitch');}note(4,key,false);assert(records().every(b=>b[0]===0),'note-off releases every allocation');rateCases.push({id:a.id,rate,key,voices_reading_live_coefficient:4});
    }
   }
  }
  for(const a of selected){
   call(0x0804d928,[ALLOCATOR]);set('Gen.Chord',0);set('Gen.Parafon',32767);set('VCO.Type',Math.floor((a.id*32767+11)/22));for(let i=0;i<4;i++)render();call(0x08049a98,[KEYBOARD,4]);
   const held=new Set();
   for(const [key,on] of [[48,true],[55,true],[60,true],[67,true],[55,false],[36,true],[60,false],[84,true],[48,false],[67,false],[36,false],[84,false]]){
    note(4,key,on);if(on)held.add(key);else held.delete(key);const before=parameterReads.length;
    for(let i=0;i<4;i++)render();const rr=records(),active=rr.filter(b=>b[0]).map(b=>b[2]).sort((x,y)=>x-y);
    assert(JSON.stringify(active)===JSON.stringify([...held].sort((x,y)=>x-y)),'held paraphonic notes follow note-on/off history');
    for(let i=0;i<4;i++)if(rr[i][0]){const aggregate=read32(read32(COMMON+i*STRIDE+0x50ac)+0x5c),voice=aggregate+0x28,obj=read32(voice+0x6e4+a.registry*4),seen=parameterReads.slice(before).filter(p=>p.object===obj);assert(seen.length===4&&seen.every(p=>Math.abs(p.note-rr[i][2])<0.1),'paraphonic DSP note follows its own allocation after another voice changes');}
    paraphonicHistory.push({id:a.id,key,on,active_notes:active,voice_notes_verified:true});
   }
   if(a.native_alias){
    for(let i=0;i<4;i++){
     const common=COMMON+i*STRIDE,wrapper=read32(common+0x50ac),aggregate=read32(wrapper+0x5c),voice=aggregate+0x28,arena=common+0x34,init=read32(read32(wrapper)+12);
     call(init,[wrapper,a.id,arena,16384],1000000);const table=read32(voice),expected=e.mem_read(arena,a.scratch_bytes);
     for(const other of [10,6,10]){
      call(init,[wrapper,other,arena,16384],1000000);assert(read32(voice)===0x08078578,'normal Chords object table restored when leaving an alias');
      e.mem_write(arena,new Uint8Array(16384).fill(0x55));call(init,[wrapper,a.id,arena,16384],1000000);
      assert(read32(voice)===table&&read32(aggregate+0x1c)===4,'native ID returns to its own module');assert(e.mem_read(arena,a.scratch_bytes).every((x,n)=>x===expected[n]),'native alias scratch restored after a different engine');
      lifecycleCases.push({id:a.id,voice:i,previous_id:other,scratch_restored:true,normal_table_restored:true});
     }
     call(init,[wrapper,10,arena,16384],1000000);assert(read32(voice)===0x08078578,'final Chords restoration');
    }
   }
  }
  return {passed:true,scope:'Native constructors, parameter setters, four-note allocation, paraphonic Common/audio dispatch, retained Plaits frontends, four-voice unison, logical note-on/off, DSP-level note/control ownership, multi-note paraphonic histories, native-overlay restoration and late sample-rate changes. Boot, interrupts, physical CPU and hardware audio are not emulated.',cases:rows,unison_cases:unisonCases,live_rate_cases:rateCases,paraphonic_history:paraphonicHistory,native_lifecycle_cases:lifecycleCases,elapsed_ms:Math.round(performance.now()-start),hardware_verified:false};
 }finally{f.close();}
}
