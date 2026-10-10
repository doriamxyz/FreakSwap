const FORMAT = 'microfreak.firmware-recipe';
const ENGINES = ['phase_distortion','classic_waves_vcf','swarm','inharmonic_string','particle_noise','filtered_noise','string_machine','chiptune','bass_drum','snare_drum','wave_terrain'];
const ORIGINALS = ['basic_waves','superwave','wavetable','harmonic','karplusstr','virtual_analog','waveshaper','two_op_fm','formant','chords','speech','modal','noise','bass','sawx','harm','user_wavetable','sample','scan_grains','cloud_grains','hit_grains','vocoder'];
function keys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...expected].sort().join(',');
}
export function normalizeRecipe(value, base) {
  if (!keys(value, ['format','version','firmware','replacements','preset_policy']) || value.format !== FORMAT || value.version !== 3 || !keys(value.firmware, ['version','sha256']) || value.firmware.version !== base.version || value.firmware.sha256 !== base.sha256 || !keys(value.preset_policy, ['mode']) || value.preset_policy.mode !== 'slot_occupant') throw new Error('This selection file is not compatible with firmware 5.0.0.2084.');
  if (!Array.isArray(value.replacements) || value.replacements.length > 22) throw new Error('The replacement list is invalid.');
  const originals = new Set(), engines = new Set();
  const rows = value.replacements.map(row => {
    if (!keys(row, ['original','engine','variant']) || !ORIGINALS.includes(row.original) || row.original === 'vocoder' || !ENGINES.includes(row.engine)) throw new Error('The selection contains an unknown engine or destination.');
    const variants = row.engine === 'wave_terrain' ? ['normal','aux'] : row.engine === 'filtered_noise' ? ['normal','dual_band'] : ['normal'];
    if (!variants.includes(row.variant) || originals.has(row.original) || engines.has(row.engine)) throw new Error('The selection contains invalid versions or duplicate replacements.');
    originals.add(row.original); engines.add(row.engine);
    return {original: row.original, engine: row.engine, variant: row.variant};
  }).sort((a,b) => ORIGINALS.indexOf(a.original) - ORIGINALS.indexOf(b.original));
  return {format: FORMAT, version: 3, firmware: {version: base.version, sha256: base.sha256}, replacements: rows, preset_policy: {mode: 'slot_occupant'}};
}
export function recipeKey(value, base) {
  return JSON.stringify(normalizeRecipe(value, base));
}
