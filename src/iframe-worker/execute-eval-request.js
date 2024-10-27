// @ts-check

/**
 * @param {string} script
 * @param {Record<string, any>} globals
 * @param {any} key
 * @param {(obj: any) => any} remoteSerialize
 */
export async function executeEvalRequest(script, globals, key, remoteSerialize) {
  if (typeof script !== 'string') return;
  if (key == null) return;

  try {
    for (const key in window) {
      if (key.length === 2 && /\$[0-9]/.test(key)) {
        if (key in globals)
          window[key] = globals[key];
        else
          delete window[key];
      }
    }

    for (const key in globals) {
      window[key] = globals[key];
    }

    const result = (0, eval)(script);
    let resolvedResult = result;
    if (typeof result?.then === 'function')
      resolvedResult = await result;

    const remoteResolvedResult = remoteSerialize(resolvedResult);

    return { evalReply: { key, result: remoteResolvedResult, success: true } };
  } catch (error) {
    const remoteError = remoteSerialize(error);
    return { evalReply: { key, success: false, error: remoteError } };
  }
}