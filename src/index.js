// @ts-check

import { runIFRAMEWorker } from './iframe-worker';
import { runInteractiveApp } from './app';

import './core.css';

if (typeof window !== 'undefined' && typeof window?.alert === 'function') {

  if (location.host.indexOf('-ifrwrk.') >= 0) {
    runIFRAMEWorker();
  } else {
    runInteractiveApp();
  }

}
