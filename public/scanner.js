export function parsePayload(value) {
  if (typeof value !== 'string' || value.length > 80) return null;
  const s = value.trim();
  return s === 'TEST WAND' || /^Ghost ([1-9]|1[0-8])$/.test(s) || /^Player (Red|Green|Blue|Yellow|White|Black)$/.test(s) ? s : null;
}
export function createScanner(onScan, clock = () => performance.now()) {
  let buffer = '', last = 0;
  return event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) { buffer = ''; return; }
    const now = clock();
    if (now - last > 1000) buffer = '';
    last = now;
    if (event.key === 'Enter') {
      const payload = parsePayload(buffer); buffer = ''; event.preventDefault?.();
      if (payload) onScan(payload, now);
    } else if (event.key.length === 1) {
      buffer += event.key;
      if (buffer.length > 80) buffer = '';
    }
  };
}
