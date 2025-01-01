// @ts-check

import { throttledAsyncCache } from '../async/throttled-async-cache';

const MAX_ERROR_AGE_MSEC = 10000;

/**
 * @param {(updates: { [fileName: string]: string | null }) => void} update
 */
export function loadDependencies(update) {

  /**
   * @type {Map<string, string[] | Promise<string[]>>}
   */
  const cache = new Map();

  /** @type {Map<string, { failedPromise: Promise<any>, time: number }>} */
  const errorCache = new Map();

  const queueLoadPackage = throttledAsyncCache(
    queueLoadPackageCore,
    {
      maxConcurrency: 4,
      interval: 10
    });
  
  const loadFileContent = throttledAsyncCache(
    loadFileContentCore,
    {
      maxConcurrency: 10,
      interval: 3
    });

  return queueLoad;

  /** @param {string} path */
  async function queueLoad(path) {
    let packageName = path.startsWith('@') ? path.split('/', 2).join('/') : path.split('/', 1)[0];
    const prefixMatch = /^([a-z\.\-]+):/i.exec(packageName);
    if (prefixMatch) packageName = packageName.slice(prefixMatch[1].length + 1);

    if (path === packageName) return;

    let packageCache;
    if (cache.has(packageName)) {
      packageCache = await cache.get(packageName);
    } else {
      const errorCacheEntry = errorCache.get(packageName);
      if (errorCacheEntry) {
        if (Date.now() - errorCacheEntry.time <= MAX_ERROR_AGE_MSEC) {
          return errorCacheEntry.failedPromise;
        } else {
          errorCache.delete(packageName);
        }
      }

      const loadPackagePromise = queueLoadPackage(packageName);
      loadPackagePromise.catch(err => {
        console.log('Failed to load package ', { packageName, path }, err);
        errorCache.set(packageName, { failedPromise: err, time: Date.now() });
      });

      cache.set(packageName, loadPackagePromise);
      packageCache = await loadPackagePromise;
    }

    if (!packageCache) return;

    const localPath = path.slice(packageName.length);
    if (packageCache.indexOf(localPath) < 0) return;

    const fileContent = await loadFileContent(path);

    if (!fileContent) return;

    packageCache.splice(packageCache.indexOf(localPath), 1);

    update({ [path]: fileContent });

  }

  /**
   * @param {string} path
   */
  async function loadFileContentCore(path) {
    return await fetch(`https://unpkg.com/${path}`, { cache: 'force-cache' }).then(
      x => x.status === 200 ? x.text() : undefined);
  }

  async function queueLoadPackageCore(packageName) {

    const packageDir = await fetch(`https://unpkg.com/${packageName}/?meta`, { cache: 'force-cache' }).then(
      x =>
        x.status === 200 ? x.json() : undefined);

    if (!packageDir) return [];

    /** @type {string[]} */
    const unfetchedFiles = [];
    visit(packageDir);

    cache.set(packageName, unfetchedFiles);

    return unfetchedFiles;

    /** 
     * @typedef {{ path: string, type: 'file' } | { path: string, type: 'directory', files: PackageEntry[] }} PackageEntry
     */
    /** @param {PackageEntry} entry */
    function visit(entry) {
      if (entry.type === 'file') {
        unfetchedFiles.push(entry.path);
      } else if (entry.type === 'directory') {
        entry.files.forEach(visit);
      }
    }
  }
}