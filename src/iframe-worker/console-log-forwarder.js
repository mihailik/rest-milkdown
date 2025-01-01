// @ts-check

/**
 * @param {string} replyOrigin
 * @param {ReturnType<typeof import('./serialize/remote-objects').remoteObjects>} remote
 */
export function createConsoleLogForwarder(replyOrigin, remote) {
  const originalConsole = console;
  ConsoleReplacement.prototype = originalConsole;

  const consoleReplacement = new ConsoleReplacement();
  consoleReplacement.log = log;
  consoleReplacement.debug = debug;
  consoleReplacement.warn = warn;

  const forwarder = {
    console: consoleReplacement,
    originalConsole,
    onSendMessage
  }

  return forwarder;

  function ConsoleReplacement() {
  }

  function log(...args) {
    originalConsole.log(...args);
    forwarder.onSendMessage({ console: { log: remote.serialize(args)} }, replyOrigin);
  }

  function debug(...args) {
    originalConsole.debug(...args);
    forwarder.onSendMessage({ console: { debug: remote.serialize(args) } }, replyOrigin);
  }

  function warn(...args) {
    originalConsole.warn(...args);
    forwarder.onSendMessage({ console: { debug: remote.serialize(args) } }, replyOrigin);
  }

  /**
 * @param {any} msg
 * @param {string} replyOrigin
 */
  function onSendMessage(msg, replyOrigin) {
    window.parent.postMessage(msg, replyOrigin);
  }
}