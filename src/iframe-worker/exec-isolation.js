// @ts-check

import { createFetchForwarderService } from './fetch-forwarder-service';
import { thisScriptURL } from '../url-encoded/parse-location';
import { remoteObjects } from './serialize/remote-objects';
import { createWebSocketForwarderService } from './websocket-forwarder-service';
import { loadCorsIframe } from './load-cors-iframe';

export var USE_SERIALIZATION = true;

export function execIsolation() {

  let remote = remoteObjects();

  return {
    execScriptIsolated
  };

  /**
   * @type {{
   *  [key: string]: {
   *    promise: Promise,
   *    resolve: (value: any) => void,
   *    reject: (value: any) => void
   *  }
   * }}
   */
  var scriptRequests;

  /** @type {Parameters<typeof execScriptIsolated>[2]} */
  var loggerInstance;

  /**
   * @param {string} scriptText
   * @param {Record<string, any>} globals
   * @param {(level: string, args: any[]) => void} [logger]
   */
  async function execScriptIsolated(scriptText, globals, logger) {
    loggerInstance = logger;
    const { iframe, origin: iframeOrigin } = await (
      _workerIframePromise ||
      (_workerIframePromise = loadCorsIframe())
    );

    remote = remoteObjects();
    remote.onSendMessage = (msg) => {
      iframe.contentWindow?.postMessage(msg, iframeOrigin);
    };

    // TODO: unsubscribe if iframe crashes and reloaded
    window.addEventListener('message', handleMessage);

    if (!scriptRequests) scriptRequests = {};

    /** @type {*} */
    let resolve;
    /** @type {*} */
    let reject;
    let promise = new Promise((xResolve, xReject) => {
      resolve = xResolve;
      reject = xReject;
    });

    const key = Date.now() + ' ' + Math.random();

    scriptRequests[key] = { promise, resolve, reject };

    iframe.contentWindow?.postMessage({
      eval: {
        key,
        script: scriptText,
        globals: USE_SERIALIZATION ? remote.serialize(globals) : globals
      }
    }, iframeOrigin);

    return promise;

    var fetchForwardService;
    var webSocketForwardService;

    /**
     * @param {MessageEvent} _
     */
    function handleMessage({ data, origin, source }) {
      if (iframeOrigin !== '*' && origin !== iframeOrigin) return;
      if (source !== iframe.contentWindow) return;

      if (data.evalReply) {
        const { key, success, result, error } = data.evalReply;

        const entry = scriptRequests[key];
        if (entry) {
          delete scriptRequests[key];
          if (success) entry.resolve(USE_SERIALIZATION ? remote.deserialize(result) : result);
          else entry.reject(USE_SERIALIZATION ? remote.deserialize(error) : error);
        }
      } else if (data.fetchForwarder) {
        if (!fetchForwardService)
          fetchForwardService = createFetchForwarderService(origin);
        fetchForwardService.onMessage({ data, source });
      } else if (data.webSocketForwarder) {
        if (!webSocketForwardService)
          webSocketForwardService = createWebSocketForwarderService(origin);

        webSocketForwardService.onMessage({ data, source });
      } else if (data.console) {
        if (loggerInstance) {
          if (data.console.log) loggerInstance('log', remote.deserialize(data.console.log));
          if (data.console.debug) loggerInstance('debug', remote.deserialize(data.console.debug));
          if (data.console.warn) loggerInstance('warn', remote.deserialize(data.console.warn));
        }
      } else {
        remote.onReceiveMessage(data);
      }
    }
  }

  /** @type {Promise<{ iframe: HTMLIFrameElement, origin: string }> | undefined} */
  var _workerIframePromise;
}
