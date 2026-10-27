// Local CLI uses the same composer, structural verifier and ARM checks as the app.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {composeRaw,unpackOfficial,packageFirmware,hash} from '../../compose.js';
import {checkComposition} from '../../arm-checks.js';
import {LIBRARY_SHA256} from '../../library-release.js';
const here=path.dirname(fileURLToPath(import.meta.url)),web=path.resolve(here,'../..'),[baseFile,out,recipeFile]=process.argv.slice(2),modules={};
if(!baseFile||!out)throw Error('build.mjs BASE.mff OUTPUT [RECIPE.json]');
const libBytes=fs.readFileSync(path.join(web,'library.json'));if(await hash(libBytes)!==LIBRARY_SHA256)throw Error('Library pin mismatch');const library=JSON.parse(libBytes);
for(const [id,asset] of Object.entries(library.modules)){const bytes=fs.readFileSync(path.join(web,asset.url));if(bytes.length!==asset.size||await hash(bytes)!==id)throw Error('Module pin mismatch');modules[id]=JSON.parse(bytes);}
const verifying=recipeFile==='--verify',prior=verifying?JSON.parse(fs.readFileSync(path.join(out,'build.json'))):null;
const recipe=verifying?prior.recipe:recipeFile?JSON.parse(fs.readFileSync(recipeFile)):[{engine:'raster',original:'sample',variant:'normal'}];if(!recipe.some(r=>r.engine==='raster'))throw Error('This builder requires Raster');
const rebuilt=fs.readFileSync(path.join(out,'module.json'));if(await hash(rebuilt)!==library.extensions.raster.module)throw Error('Rebuilt Raster module mismatch');
const original=new Uint8Array(fs.readFileSync(baseFile)),{raw}=await unpackOfficial(original,library),composition=await composeRaw(raw,library,recipe,modules);
globalThis.require=createRequire(import.meta.url);globalThis.__dirname=web;vm.runInThisContext(fs.readFileSync(path.join(web,'unicorn_arm.js'),'utf8'));const uc=await MUnicorn();
const checks=await checkComposition(uc,composition.image,composition.selected,console.log);if(!checks.passed)throw Error('ARM verification failed');
const archive=await packageFirmware(original,library,composition);const filename='CANDIDATE_MicroFreak_Raster_v1_1.mff';
if(verifying){if(prior.raw_sha256!==composition.sha256||prior.mff_sha256!==archive.sha256||await hash(fs.readFileSync(path.join(out,'raster.raw.bin')))!==composition.sha256||await hash(fs.readFileSync(path.join(out,filename)))!==archive.sha256)throw Error('Candidate artifacts differ from recomposition');console.log('Existing candidate verified:',archive.sha256);process.exit(0);}
fs.writeFileSync(path.join(out,'raster.raw.bin'),composition.image);fs.writeFileSync(path.join(out,filename),archive.bytes);
const report={status:'qualified-offline-candidate',recipe,raw_sha256:composition.sha256,mff_sha256:archive.sha256,module_sha256:library.extensions.raster.module,library_sha256:LIBRARY_SHA256,callbacks:{init:composition.nativeSample.roots[0],parameter:composition.nativeSample.roots[1],render:composition.nativeSample.roots[2],screen:composition.nativeSample.screen},state_bytes_per_voice:32,buffer_bytes_per_voice:1024,structural_verification:composition.independentVerification,checks,physical_validation:false,limits:['Physical CPU deadlines and stack high-water are not measured.','Synchronous synthetic PCM fixture in browser checks; native QSPI/cache modeled in separate evidence. Physical DMA completion timing remains unverified.','Finite samples and extreme pitch changes may run out before the next repeat.','No claim of MiniFreak Raster binary or sonic equivalence.']};
fs.writeFileSync(path.join(out,'build.json'),JSON.stringify(report,null,2)+'\n');console.log('Candidate verified:',filename,archive.sha256);
