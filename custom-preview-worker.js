importScripts('./unicorn_arm.js');
(async()=>{
 const {LIBRARY_SHA256}=await import('./library-release.js'),{hash}=await import('./compose.js'),{customBank}=await import('./custom-sixop.js'),{previewImage,renderCustomPreview}=await import('./custom-preview.js');
 let fixture=null,key=null,uc=null;
 self.onmessage=async({data})=>{const {id,bytes,patch}=data;try{
  const bank=await customBank(bytes);
  if(!fixture||key!==bank.id){
   const response=await fetch('./library.json',{cache:'no-store'}),raw=await response.arrayBuffer();if(!response.ok||await hash(raw)!==LIBRARY_SHA256)throw new Error('The engine library failed verification.');
   const library=JSON.parse(new TextDecoder().decode(raw)),asset=library.modules[library.extensions.sixop.module],r=await fetch('./'+asset.url),payload=await r.arrayBuffer();if(!r.ok||payload.byteLength!==asset.size||await hash(payload)!==asset.sha256)throw new Error('The preview engine failed verification.');
   fixture=previewImage(JSON.parse(new TextDecoder().decode(payload)),bank.module);key=bank.id;
   // A fresh interpreter prevents translated code from a previous bank surviving.
   uc=await MUnicorn();
  }
  const result=await renderCustomPreview(uc,fixture,patch,{onProgress:p=>self.postMessage({id,progress:p})});self.postMessage({id,wav:result.bytes.buffer,silent:result.silent},[result.bytes.buffer]);
 }catch(e){self.postMessage({id,error:e.message||'The preview could not be generated.'});}};
 self.postMessage({ready:true});
})().catch(e=>self.postMessage({startupError:e.message||'The preview could not start.'}));
