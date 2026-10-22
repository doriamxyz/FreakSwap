import {WEBSITE_ID} from './analytics-config.js';

// Analytics must never block firmware preparation or receive user files.
const enabled = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(WEBSITE_ID)
  && location.protocol === 'https:' && location.hostname === 'doriamxyz.github.io'
  && location.pathname.startsWith('/FreakSwap/')
  && navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl;
let ready = false, failed = false;
const pending = [];

function send(name, data) {
  try {
    // Omit query strings, fragments and referrer paths from every payload.
    const result = window.umami?.track(props => ({
      ...props, url: location.pathname,
      referrer: document.referrer ? new URL(document.referrer).origin : '',
      ...(name ? {name, data} : {}),
    }));
    Promise.resolve(result).catch(() => {});
  } catch {}
}

export function trackFirmware(name, recipe) {
  if (!enabled || failed || !['firmware_generated', 'firmware_download_clicked'].includes(name)) return;
  // Only built-in engine identifiers, never filenames, preset names or bytes.
  const engines = [...new Set(recipe.map(row => row.engine))]
    .filter(engine => typeof engine === 'string' && /^[a-z0-9_]{1,64}$/.test(engine))
    .sort().join(',').slice(0, 500);
  const data = {engines};
  if (ready) send(name, data);
  else if (pending.length < 30) pending.push([name, data]);
}

if (enabled) {
  const script = document.createElement('script');
  script.src = 'https://cloud.umami.is/script.js';
  script.async = true;
  script.dataset.websiteId = WEBSITE_ID;
  script.dataset.hostUrl = 'https://gateway.umami.is';
  // Send just one explicit pageview and the two application events.
  script.dataset.autoTrack = 'false';
  script.dataset.doNotTrack = 'true';
  script.onload = () => {
    ready = true;
    send();
    for (const [name, data] of pending.splice(0)) send(name, data);
  };
  script.onerror = () => {failed = true; pending.length = 0;};
  document.head.append(script);
}
