import {sha256} from './patch-core.js';
import {SIXOP_ENTRY_SHA256} from './sixop-release.js';
const $=id=>document.getElementById(id);
let entry,file,worker,controller,resultURL,epoch=0,busy=false;
const notice=(text,error=false)=>{$('notice').textContent=text;$('notice').classList.toggle('error',error);};
function sync(){ $('generate').hidden=Boolean(resultURL); $('generate').disabled=!entry||!file||busy; $('cancel').hidden=!busy; $('download-guide').disabled=!entry; }
function reset(){epoch++;controller?.abort();controller=null;worker?.terminate();worker=null;if(resultURL)URL.revokeObjectURL(resultURL);resultURL=null;$('result').hidden=true;$('download-firmware').removeAttribute('href');busy=false;sync();}
async function asset(metadata,signal){
 const root=new URL('./',location.href),url=new URL(metadata.url,root);
 if(typeof metadata.url!=='string'||!metadata.url.startsWith('catalog/sixop-abc/')||url.origin!==root.origin||!url.pathname.startsWith(root.pathname+'catalog/sixop-abc/')||url.search||url.hash)throw new Error('Invalid file reference.');
 const response=await fetch(url,{cache:'no-store',signal});if(!response.ok)throw new Error('Could not download a file. Please try again.');
 const data=await response.arrayBuffer();if(await sha256(data)!==metadata.sha256||(metadata.size!==undefined&&data.byteLength!==metadata.size))throw new Error('File verification failed. Please reload this page.');return data;
}
$('firmware-input').addEventListener('change',()=>{reset();file=$('firmware-input').files[0];$('file-label').textContent=file?.name||'Official firmware from Arturia';if(file&&file.size!==entry.base.size){file=null;notice('Choose the official 5.0.0.2084 firmware.',true);}else notice(file?'Ready to prepare Six-Op A/B/C.':'Choose the official firmware.');sync();});
$('generate').addEventListener('click',async()=>{
 if(!entry||!file||busy)return;reset();const id=epoch;busy=true;sync();notice('Preparing your firmware…');controller=new AbortController();
 try{
  const [base,patch]=await Promise.all([file.arrayBuffer(),asset(entry.patch,controller.signal)]);if(id!==epoch)return;
  worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{if(id!==epoch||data.id!==id)return;if(data.error){reset();notice(data.error,true);return;}worker.terminate();worker=null;controller=null;busy=false;resultURL=URL.createObjectURL(new Blob([data.result],{type:'application/octet-stream'}));$('download-firmware').href=resultURL;$('download-firmware').download=entry.result.filename;$('result').hidden=false;sync();notice('Firmware ready to download.');};
  worker.onerror=()=>{if(id===epoch){reset();notice('Could not prepare the firmware. Please try again.',true);}};
  worker.postMessage({id,base,patch,entry},[base,patch]);
 }catch(error){if(id===epoch){reset();notice(error.message,true);}}
});
$('cancel').addEventListener('click',()=>{reset();notice('Preparation canceled.');});
$('download-guide').addEventListener('click',async()=>{try{const data=await asset(entry.guide),url=URL.createObjectURL(new Blob([data],{type:'text/markdown'})),a=document.createElement('a');a.href=url;a.download='SixOp-ABC-INSTALLATION.md';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(error){notice(error.message,true);}});
window.addEventListener('pagehide',()=>{reset();file=null;});
try{
 if(location.protocol==='file:'||!crypto.subtle||!window.Worker)throw new Error('Open this page from its website in an up-to-date browser.');
 const response=await fetch('sixop-entry.json',{cache:'no-store'});if(!response.ok)throw new Error('Could not load Six-Op A/B/C.');const data=await response.arrayBuffer();if(await sha256(data)!==SIXOP_ENTRY_SHA256)throw new Error('Configuration verification failed. Please reload.');entry=JSON.parse(new TextDecoder().decode(data));$('firmware-input').disabled=false;notice('Choose the official firmware to continue.');sync();
}catch(error){notice(error.message,true);}
