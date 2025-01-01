// @ts-check

export function executeInitRequest({ ackKey, fetchForwarder, webSocketForwarder, consoleLogForwarder, console }) {
  console.log(
    'init ACK, redirecting ',
    {
      fetch: { from: window.fetch, to: fetchForwarder.fetch },
      WebSocket: { from: window.WebSocket, to: webSocketForwarder.WebSocket },
      console: consoleLogForwarder.console,
    });
  window.fetch = fetchForwarder.fetch;
  window.WebSocket = webSocketForwarder.WebSocket;
  window.console = consoleLogForwarder.console;

  return { init: 'ack', ackKey };
}
