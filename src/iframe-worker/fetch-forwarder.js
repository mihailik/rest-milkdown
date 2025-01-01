// @ts-check

/**
 * @param {string} replyOrigin
 */
export function createFetchForwarder(replyOrigin) {

  const fetchSessions = {};

  const forwarder = {
    fetch,
    onSendMessage,
    onFetchReply
  };

  return forwarder;

  function fetch(...args) {
    return fetchProxy(...args);
  }

  async function fetchProxy(...args) {
    const key = String(Date.now() + Math.random());

    let promise = new Promise((resolve, reject) => {
      fetchSessions[key] = {
        key,
        resolve,
        reject
      };
    });

    if (args.length === 1 && args[0] && args[0] instanceof Request) {
      const req = args[0];
      let body;
      if (req.body && req.method && ['GET', 'HEAD', 'DELETE'].indexOf(req.method.toUpperCase()) < 0) {
        const arr = [];
        for await (const chunk of req.body) {
          arr.push(chunk);
        }
        const buf = new Uint8Array(arr.reduce((acc, chunk) => acc + chunk.length, 0));
        let pos = 0;
        for (const chunk of arr) {
          buf.set(chunk, pos);
          pos += chunk.length;
        }
        body = buf;
      }

      args = [
        req.url,
        {
          method: req.method,
          headers: Object.fromEntries(req.headers?.entries?.() || []),
          body,
          referrer: req.referrer,
          referrerPolicy: req.referrerPolicy,
          mode: req.mode,
          credentials: req.credentials,
          cache: req.cache,
          redirect: req.redirect,
          integrity: req.integrity,
          keepalive: req.keepalive,
        }
      ];
    } else {
      const req = args[1];
      args = [String(args[0])];
      if (req)
        args[1] =
        {
          method: req.method,
          headers:
            typeof req.headers?.entries === 'function' ? Object.fromEntries(req.headers.entries()) :
            req.headers && typeof req.headers === 'object' ? req.headers : undefined,
          body: req.body,
          referrer: req.referrer,
          referrerPolicy: req.referrerPolicy,
          mode: req.mode,
          credentials: req.credentials,
          cache: req.cache,
          redirect: req.redirect,
          integrity: req.integrity,
          keepalive: req.keepalive,
        };
    }

    forwarder.onSendMessage({
      fetchForwarder: {
        key,
        args
      }
    }, replyOrigin);

    const result = await promise;
    console.log('fetchProxy::fetch(', args, ') --> ', result);

    return result;
  }

  function onFetchReply({ fetchForwarder }, replyTo) {
    const fSession = fetchSessions[fetchForwarder.key];
    if (!fSession) return;
    delete fetchSessions[fSession.key];

    const { error, result } = fetchForwarder;

    if (error) {
      /** @type {*} */
      const ErrorFn = window[error.name] || Error;
      const err = new ErrorFn(error.message);
      for (const k in error) {
        if (err[k] !== error[k]) err[k] = error[k];
      }

      fSession.reject(err);
    } else {
      let result;
      if (fetchForwarder.for !== 'fetch') {
        result = fetchForwarder.result;
      } else {
        result = new Response();
        for (const k in fetchForwarder.result) {
          var val = fetchForwarder.result[k];
          if (k === 'headers') {
            for (const header in val) {
              result.headers.set(header, val[header]);
            }
          } else if (val && typeof val === 'object') {
            if (val.function) {
              if (val.function === 'promise') {
                result[k] = async (...args) => {
                  const key = String(Date.now() + Math.random());
                  const promise = new Promise((resolve, reject) => {
                    fetchSessions[key] = {
                      resolve,
                      reject
                    };
                  });

                  replyTo.postMessage({
                    fetchForwarder: {
                      key: fSession.key,
                      call: { function: k, key, args }
                    }
                  }, replyOrigin);

                  const res = await promise;
                  console.log('fetch.' + k + '() -> ', res);
                  return res;
                };
              } else {
                return val.function;
              }
            }
          } else {
            try {
              result[k] = fetchForwarder.result[k];
            } catch (error) {
              console.log('onFetchReply>> [' + k + '] = ', fetchForwarder.result[k], error);
            }
          }
        }
      }

      console.log('onFetchReply>> ', fetchForwarder);

      fSession.resolve(result);
    }
  }

  /**
   * @param {any} msg
   * @param {string} replyOrigin
   */
  function onSendMessage(msg, replyOrigin) {
    window.parent.postMessage(msg, replyOrigin);
  }
}
