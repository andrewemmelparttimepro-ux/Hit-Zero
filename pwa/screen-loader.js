// Each asset is fetched once; each caller receives its own named export.
// A missing export or stalled download is a retryable failure, never a blank screen.
export function installScreenLoader(target, document, assets, timeoutMs = 20000) {
  const pending = new Map();
  const ready = name => {
    if (typeof target[name] !== 'function') throw new Error('This screen did not load correctly. Please retry.');
    return target[name];
  };
  target.HZ_SCREEN_ASSETS = assets;
  target.HZloadScreenAsset = async name => {
    if (typeof target[name] === 'function') return target[name];
    const src = assets[name];
    if (!src) throw new Error('This screen is unavailable in this release.');
    if (!pending.has(src)) {
      pending.set(src, new Promise((resolve, reject) => {
        const element = document.createElement('script');
        let timer;
        const fail = () => {
          clearTimeout(timer);
          element.onload = element.onerror = null;
          pending.delete(src);
          element.remove();
          reject(new Error('This screen could not load. Check your connection and retry.'));
        };
        element.src = src;
        element.onerror = fail;
        element.onload = () => {
          clearTimeout(timer);
          element.onload = element.onerror = null;
          resolve();
        };
        timer = setTimeout(fail, timeoutMs);
        document.head.appendChild(element);
      }));
    }
    await pending.get(src);
    try { return ready(name); }
    catch (error) { pending.delete(src); throw error; }
  };
}
