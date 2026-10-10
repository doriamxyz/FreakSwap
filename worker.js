import {generate} from './patch-core.js';

self.onmessage = async ({data}) => {
  try {
    const result = await generate(data.base, data.patch, data.entry);
    self.postMessage({id: data.id, result}, [result]);
  } catch (error) {
    self.postMessage({id: data.id, error: error.message || 'Could not prepare the firmware.'});
  }
};
