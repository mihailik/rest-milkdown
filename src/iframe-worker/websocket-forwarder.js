// @ts-check

const BaseWebSocket = window.WebSocket;

/**
 * @param {string} replyOrigin
 */
export function createWebSocketForwarder(replyOrigin) {

  const empty = {};
  for (const k in BaseWebSocket) {
    const val = BaseWebSocket[k];
    if (typeof val !== 'function' && !(k in empty)) {
      WebSocket[k] = window.WebSocket[k];
    }
  }

  /** @type {Map<string, WebSocketProxy>} */
  const registeredWebSockets = new Map();

  const forwarder = {
    WebSocket,
    onWebSocketSendMessage,
    onWebSocketMessage
  };

  return forwarder;

  /**
   * @typedef {globalThis.WebSocket & {
   *  __key: string,
   *  __events: { [eventName: string]: Set<Function> }
   * }} WebSocketProxy
   */

  /**
   * @class
   * @this {WebSocketProxy}
   * @param {string | URL} url
   */
  function WebSocket(url) {
    this.send = send;
    this.close = close;
    // @ts-ignore
    this.addEventListener = addEventListener;
    // @ts-ignore
    this.removeEventListener = removeEventListener;
    // @ts-ignore
    this.url = String(url);
    // @ts-ignore
    this.readyState = 0;
    /** @type {{ [eventName: string]: Set<Function> }} */
    this.__events = {};
    /** @type {string} */
    this.__key =
      'ws-' +
      (Date.now() % 7537) + '-' +
      (Math.random() * 1000).toFixed() + '-' +
      registeredWebSockets.size;

    registeredWebSockets.set(this.__key, this);

    forwarder.onWebSocketSendMessage({
      webSocketForwarder: {
        key: this.__key,
        method: 'new',
        args: [this.url]
      }
    }, replyOrigin);

    function send(data) {
      forwarder.onWebSocketSendMessage({
        webSocketForwarder: {
          key: this.__key,
          method: 'send',
          args: [data]
        }
      }, replyOrigin);
    }

    function close() {
      forwarder.onWebSocketSendMessage({
        webSocketForwarder: {
          key: this.__key,
          method: 'close',
          args: []
        }
      }, replyOrigin);
    }

    /**
     * @param {string} eventName
     * @param {Function} callback
     */
    function addEventListener(eventName, callback) {
      /** @type {Set} */
      const handlers = this.__events[eventName] || (this.__events[eventName] = new Set());
      handlers.add(callback);
    }

    /**
     * @param {string} eventName
     * @param {Function} callback
     */
    function removeEventListener(eventName, callback) {
      /** @type {Set} */
      const handlers = this.__events[eventName] || (this.__events[eventName] = new Set());
      handlers.delete(callback);
    }
  }

  /**
 * @param {any} msg
 * @param {string} replyOrigin
 */
  function onWebSocketSendMessage(msg, replyOrigin) {
    window.parent.postMessage(msg, replyOrigin);
  }

  function onWebSocketMessage({ webSocketForwarder }, replyTo) {
    const ws = registeredWebSockets.get(webSocketForwarder.key);
    if (!ws) return;

    if (webSocketForwarder.method === 'finish') {
      registeredWebSockets.delete(webSocketForwarder.key);
      return;
    }

    const handlers = ws.__events[webSocketForwarder.method];
    if (handlers) {
      for (const h of handlers) {
        h.apply(ws, webSocketForwarder.args);
      }
    }
  }

}