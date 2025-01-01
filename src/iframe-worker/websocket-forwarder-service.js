// @ts-check

/**
 * @param {string} replyOrigin
 */
export function createWebSocketForwarderService(replyOrigin) {

  /** @type {Map<string, WebSocket & { __key: string }>} */
  const registeredWebSockets = new Map();

  return {
    onMessage
  };

  function onMessage({ data, source }) {
    const { key, method, args } = data.webSocketForwarder;
    switch (method) {
      case 'new':
        return handleNewWebSocket(source, key, ...args);
      
      case 'close':
        return handleCloseWebSocket(key);

      case 'send':
        return handleSendWebSocket(key, ...args);
    }
  }

  function handleNewWebSocket(source, key, url) {
    const ws = /** @type {WebSocket & { __key: string }} */(new WebSocket(url));
    ws.__key = key;
    registeredWebSockets.set(key, ws);
    ws.addEventListener('open', handleEvent.bind(ws, 'open'));
    ws.addEventListener('close', handleEvent.bind(ws, 'close'));
    ws.addEventListener('error', handleEvent.bind(ws, 'error'));
    ws.addEventListener('message', handleEvent.bind(ws, 'message'));

    function handleEvent(kind, e) {
      source.postMessage({
        webSocketForwarder: {
          key,
          method: kind,
          args: [{ data: e.data }]
        }
      },
        { targetOrigin: replyOrigin }
      );
    }
  }

  function handleCloseWebSocket(key) {
    const ws = registeredWebSockets.get(key);
    ws?.close();
  }

  function handleSendWebSocket(key, data) {
    const ws = registeredWebSockets.get(key);
    ws?.send(data);
  }
}