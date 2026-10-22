// Tab-local audition state. Bank bytes and generated WAVs never leave the browser.
export class CustomAudition {
 constructor(getBank){this.getBank=getBank;this.patch=0;this.cache=new Map();this.silent=new Set();this.bankId=null;this.worker=null;this.audio=null;this.busy=false;this.message='';this.buttons=new Set();this.statuses=new Set();this.request=0;}
 button(compact=false){const button=document.createElement('button');button.type='button';button.className=compact?'quiet listen-button icon-button':'quiet';button.dataset.customPlay='';button.dataset.compact=String(compact);button.addEventListener('click',()=>this.play());this.buttons.add(button);this.refresh();return button;}
 status(compact=false){const status=document.createElement('span');status.className=compact?'audio-status':'custom-preview-status';status.setAttribute('role','status');status.hidden=!this.message;status.textContent=this.message;this.statuses.add(status);return status;}
 refresh(){for(const button of this.buttons){const active=this.busy||Boolean(this.audio&&!this.audio.paused),label=this.busy?'Cancel preview generation':active?'Stop custom preview':'Play custom patch '+(this.patch+1);button.textContent=button.dataset.compact==='true'?(this.busy?'…':active?'■':'▶'):(this.busy?'Cancel':active?'Stop':'Listen');button.disabled=!this.getBank();button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-busy',String(this.busy));}for(const status of this.statuses){status.textContent=this.message;status.hidden=!this.message;}}
 announce(message){this.message=message;this.refresh();}
 stop(){this.request++;this.worker?.terminate();this.worker=null;this.busy=false;if(this.audio){this.audio.pause();this.audio.remove();this.audio=null;}this.announce('');this.buttons=new Set([...this.buttons].filter(b=>b.isConnected));this.statuses=new Set([...this.statuses].filter(s=>s.isConnected));}
 resetBank(){this.stop();this.patch=0;this.bankId=null;for(const url of this.cache.values())URL.revokeObjectURL(url);this.cache.clear();this.silent.clear();}
 setPatch(patch){this.stop();this.patch=patch;this.refresh();}
 async playURL(url,silent=false){
  const request=this.request,audio=document.createElement('audio');audio.hidden=true;audio.src=url;audio.volume=.65;document.body.append(audio);this.audio=audio;
  audio.addEventListener('play',()=>this.refresh());audio.addEventListener('pause',()=>this.refresh());audio.addEventListener('ended',()=>this.announce(''));audio.addEventListener('error',()=>this.announce('Audio unavailable. Try again.'));
  try{await audio.play();if(request!==this.request)return;this.announce(silent?'This patch is silent at the preview settings.':'');}catch{if(request!==this.request)return;this.announce('Preview ready. Press play to listen.');}
 }
 async play(){
  if(this.busy||this.audio&&!this.audio.paused){this.stop();return;}
  const bank=this.getBank();if(!bank)return;
  this.stop();if(this.bankId!==bank.id){for(const url of this.cache.values())URL.revokeObjectURL(url);this.cache.clear();this.silent.clear();this.bankId=bank.id;}
  document.querySelectorAll('audio').forEach(audio=>audio.pause());
  const key=bank.id+':'+this.patch,cached=this.cache.get(key);if(cached){await this.playURL(cached,this.silent.has(key));return;}
  this.busy=true;this.announce('Generating preview…');const id=++this.request,worker=new Worker('./custom-preview-worker.js?custom-play-20261022');this.worker=worker;
  const fail=message=>{if(id!==this.request)return;worker.terminate();this.worker=null;this.busy=false;this.announce(message);};
  worker.onmessage=async({data})=>{
   if(id!==this.request)return;
   if(data.startupError){fail(data.startupError);return;}
   if(data.ready){worker.postMessage({id,bytes:bank.bytes,patch:this.patch});return;}
   if(data.id!==id)return;
   if(data.error){fail(data.error);return;}
   if(data.wav){worker.terminate();this.worker=null;this.busy=false;const url=URL.createObjectURL(new Blob([data.wav],{type:'audio/wav'}));this.cache.set(key,url);if(data.silent)this.silent.add(key);if(this.cache.size>8){const oldest=this.cache.keys().next().value;URL.revokeObjectURL(this.cache.get(oldest));this.cache.delete(oldest);this.silent.delete(oldest);}await this.playURL(url,data.silent);}
  };
  worker.onerror=()=>fail('The preview could not be generated. Try again.');
 }
}
