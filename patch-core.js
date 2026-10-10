export async function sha256(buffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('');
}

export function applyRanges(base, patch) {
  const bytes = new Uint8Array(patch);
  if (bytes.length < 16 || new TextDecoder().decode(bytes.subarray(0, 8)) !== 'MFLP0001') throw new Error('The patch format is invalid.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = view.getUint32(8, true), count = view.getUint32(12, true);
  if (base.byteLength !== size || count > size) throw new Error('The patch size does not match the firmware.');
  const result = new Uint8Array(base.slice(0));
  let cursor = 16, previous = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 8 > bytes.length) throw new Error('The patch is truncated.');
    const offset = view.getUint32(cursor, true), length = view.getUint32(cursor + 4, true);
    cursor += 8;
    if (!length || offset < previous || offset + length > size || cursor + length > bytes.length) throw new Error('The patch contains invalid ranges.');
    result.set(bytes.subarray(cursor, cursor + length), offset);
    cursor += length; previous = offset + length;
  }
  if (cursor !== bytes.length) throw new Error('The patch contains trailing data.');
  return result.buffer;
}

export async function generate(base, patch, entry) {
  if (base.byteLength !== entry.base.size || await sha256(base) !== entry.base.sha256) throw new Error('Choose the official 5.0.0.2084 firmware. This file does not match the required base.');
  if (patch.byteLength !== entry.patch.size || await sha256(patch) !== entry.patch.sha256) throw new Error('The patch failed verification. Please reload the page.');
  const result = applyRanges(base, patch);
  if (result.byteLength !== entry.result.size || await sha256(result) !== entry.result.sha256) throw new Error('The result does not match the expected firmware. Download has been blocked.');
  return result;
}
