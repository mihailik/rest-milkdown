// @ts-check

/** @type {Record<string, string> | undefined} */
var libdts;

/** @type {Promise<Record<string, string>> | undefined} */
var libdtsPromise;

export function loadLibdts() {
  if (libdts) return libdts;
  if (libdtsPromise) return libdtsPromise;
  return libdtsPromise = new Promise((resolve, reject) => {
    window['libdts'] = resolvedLibds => {
      libdtsPromise = undefined;
      resolve(libdts = { ...resolvedLibds });
    };
    const script = document.createElement('script');
    script.src =
      location.hostname === 'localhost' ? './node_modules/ts-jsonp/index.js' :
        'https://unpkg.com/ts-jsonp';

    script.onload = () => {
      setTimeout(() => {
        script.remove();
      }, 1000);
    };
    script.onerror = (err) => {
      reject(err);
      setTimeout(() => {
        script.remove();
      }, 1000);
    };

    (document.body || document.head).appendChild(script);
  });
}
