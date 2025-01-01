// @ts-check

import { EditedScriptSnapshot } from './edited-script-snapshot';
import { inertLanguageService } from './inert-language-service';
import { loadDependencies } from './load-dependencies';
import { loadLibdts } from './load-libdts';
import { loadTS } from './load-ts';

/**
 * @param {() => void} internalStateChanged
 * @returns {import('.').LanguageServiceAccess & { then?: never } |
 *  Promise<import('.').LanguageServiceAccess>}
 */
export function accessLanguageService(internalStateChanged) {
  const tsOrPromise = loadTS();
  const libdtsOrPromise = loadLibdts();
  if (typeof tsOrPromise.then === 'function')
    return tsOrPromise.then(ts => withTS(ts, libdtsOrPromise, internalStateChanged));
  else
    return withTS(tsOrPromise, libdtsOrPromise, internalStateChanged);
}

/**
 * @param {import('typescript')} ts
 * @param {ReturnType<typeof loadLibdts>} libdtsOrPromise
 * @param {() => void} internalStateChanged
 * @returns {import('.').LanguageServiceAccess}
 */
function withTS(ts, libdtsOrPromise, internalStateChanged) {

  const queueDependency = loadDependencies(handleMissingDependencyLoaded);

  const inertLS = inertLanguageService(ts, queueDependency);

  const access = {
    ts,
    languageHost: inertLS.languageHost,
    languageService: inertLS.languageService,
    stateVersion: inertLS.stateVersion,
    update
  };

  if (typeof libdtsOrPromise.then === 'function') {
    libdtsOrPromise.then(libdts => {
      updateLibdts(libdts);
      internalStateChanged();
    })
  } else {
    updateLibdts(/** @type {Record<string, string>} */(libdtsOrPromise));
  }

  return access;

  /** @type {import('.').LanguageServiceAccess['update']} */
  function update(updates) {
    inertLS.update({ scripts: updates });
    access.stateVersion = inertLS.stateVersion;
  }

  /** @param {Record<string, string>} libdts */
  function updateLibdts(libdts) {
    inertLS.update({ libdts });
    access.stateVersion = inertLS.stateVersion;
  }

  var debounceDependencyLoadedTimeout;
  var debounceDependencyLoadedUpdates;

  function handleMissingDependencyLoaded(updates) {
    clearTimeout(debounceDependencyLoadedTimeout);
    debounceDependencyLoadedUpdates = {
      ...debounceDependencyLoadedUpdates,
      ...updates
    };

    debounceDependencyLoadedTimeout = setTimeout(() => {
      inertLS.update({
        dependencies: debounceDependencyLoadedUpdates,
        forceLoadScripts: true
      });

      debounceDependencyLoadedUpdates = undefined;

      access.stateVersion = inertLS.stateVersion;
      internalStateChanged();

    }, 300);
  }

}
