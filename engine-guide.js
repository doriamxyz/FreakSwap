// Public model names follow Plaits Palette; resource IDs and firmware labels stay stable.
// Reference: https://www.rubato.audio/plaits-palette/
const ENGINE_NAMES={
 raster:'Raster',
 phase_distortion:'Phase Distortion',classic_waves_vcf:'VA + VCF',swarm:'Swarm',
 inharmonic_string:'Inharmonic String',particle_noise:'Particle Noise',filtered_noise:'Filtered Noise',
 string_machine:'String Machine',chiptune:'Chiptune',bass_drum:'Analog Bass Drum',snare_drum:'Analog Snare',
 wave_terrain:'Wave Terrain',six_op_fm_a:'6-Op FM Bank A',six_op_fm_b:'6-Op FM Bank B',six_op_fm_c:'6-Op FM Bank C',
 six_op_fm_custom:'6-Op FM Custom'
};
export function engineName(engine){
 const entry=typeof engine==='string'?{engine}:engine;
 if(entry?.engine==='six_op_fm_custom')return ENGINE_NAMES[entry.engine]+(entry.name?.match(/^(?:Six-OP|6-Op) FM Custom(.*)$/)?.[1]||'');
 return ENGINE_NAMES[entry?.engine]||entry?.name||entry?.engine||'';
}
// Sound descriptions are editorial guidance; DSP identities remain in library.json.
export const ENGINE_GUIDE={
 raster:{character:'Repeating sample slices with rhythmic cuts and controlled position changes.',uses:'Wave chooses the start position, Timbre sets divisions from 1/2 to 1/32, and Shape adds position variation. Uses your loaded samples and the existing sample selector. Replaces Sample; Cloud, Hit and Scan remain available. Repeats follow transport while it runs and return to free repetition when it stops.'},
 phase_distortion:{character:'Sharp, animated digital tones that move from rounded to biting.',uses:'Basses, leads and metallic textures.'},
 classic_waves_vcf:{character:'Classic oscillator shapes through a resonant filter, with extra drive on Shift + Type.',uses:'Basses, filter sweeps and warm leads.'},
 swarm:{character:'A moving cloud of small oscillator grains, from focused to widely spread.',uses:'Dense drones, animated pads and buzzing leads.'},
 inharmonic_string:{character:'A struck string model with resonances that can become bell-like or metallic.',uses:'Plucks, bells and unusual acoustic textures.'},
 particle_noise:{character:'Small bursts of noise that scatter into a diffuse cloud.',uses:'Crackles, granular percussion and textured drones.'},
 filtered_noise:{character:'Noise shaped by resonant filters, from soft air to narrow, pitched bands.',uses:'Wind, noise sweeps and noisy percussion.'},
 string_machine:{character:'Layered string-style oscillators with chord and ensemble controls.',uses:'Sustained chords, ensemble pads and retro string textures.'},
 chiptune:{character:'Stepped digital waveforms with chord, arpeggio and register choices.',uses:'Game-style melodies, arpeggios and bright digital basses.'},
 bass_drum:{character:'A synthesized kick with attack, tone, decay and pitch-envelope punch.',uses:'Kick drums, low percussion and pitched drum lines.'},
 snare_drum:{character:'A synthesized snare combining resonant shell tones and noise.',uses:'Snare hits and tuned, noisy percussion.'},
 wave_terrain:{character:'A moving path across five digital landscapes produces changing waveforms.',uses:'Evolving textures, digital drones and unusual leads.'},
 six_op_fm_a:{character:'Six-operator FM with 32 named patches in bank A.',uses:'Explore the bank with Wave, then adjust brightness and envelope.'},
 six_op_fm_b:{character:'Six-operator FM with 32 named patches in bank B.',uses:'Explore the bank with Wave, then adjust brightness and envelope.'},
 six_op_fm_c:{character:'Six-operator FM with 32 named patches in bank C.',uses:'Explore the bank with Wave, then adjust brightness and envelope.'}
};
export function audioKey(engine,variant='normal'){
 return engine+(variant==='normal'?'':'_'+variant);
}
export function summarizeSelection(library,rows){
 const engines=Object.values(library.engines),replaced=[],empty=[];
 let pending=0;
 for(const row of rows){
  const host=library.hosts[row.original],variant=row.variant||'normal';
  const engine=engines.find(e=>e.engine===row.engine&&e.variant===variant);
  if(!host||(!engine&&row.engine!=='empty')){pending++;continue;}
  if(row.engine==='empty')empty.push({original:row.original,name:host.name});
  else replaced.push({original:row.original,from:host.name,to:engineName(engine),engine:row.engine,variant});
 }
 const changed=new Set([...replaced,...empty].map(r=>r.original));
 const kept=Object.entries(library.hosts).filter(([key])=>!changed.has(key)).map(([key,h])=>({original:key,name:h.name}));
 return {replaced,empty,kept,pending};
}
