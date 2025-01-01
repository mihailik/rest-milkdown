// @ts-check
/// <reference types="node" />

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

let updateHTMLTimeout;

/** @type {Parameters<typeof esbuild.build>[0]} */
const baseOptions = {
  //entryPoints: ['lib/index.js'],
  bundle: true,
  sourcemap: true,
  target: 'es6',
  loader: { '.js': 'jsx', '.html': 'text', '.png': 'binary', '.svg': 'text' },
  format: 'iife',
  //minify: true,
  //logLevel: 'info',
  external: [
    'fs', 'path', 'os',
    'crypto', 'tty', 'tls',
  'events', 'stream',
    'zlib',
    'assert',
    'net', 'http', 'https', 'http2',
    'child_process',
    'module', 'url', 'worker_threads', 'util',
    'node:constants', 'node:buffer', 'node:querystring', 'node:events', 'node:fs', 'node:path', 'node:os',
    'node:crypto', 'node:util', 'node:stream', 'node:assert', 'node:tty', 'node:net', 'node:tls', 'node:http',
    'node:https', 'node:zlib', 'node:http2', 'node:perf_hooks', 'node:child_process', 'node:worker_threads',

    'ws'
  ],
  //outfile: 'libs.js'
};

let lastPrinted = 0;
function printBanner(text) {
  const dt = new Date();
  let bannerText =
    dt.getHours() + ':' + (100 + dt.getMinutes()).toString().slice(1) + ':' + (100 + dt.getSeconds()).toString().slice(1) + ' ' +
    text + ' ';
  while (bannerText.length < 30)
    bannerText += '=';

  if (Date.now() - lastPrinted > 3000) bannerText = '\n' + bannerText;
  if (Date.now() - lastPrinted > 10000) bannerText = '\n' + bannerText;

  console.log(bannerText);
  lastPrinted = dt.getTime();
}

function tryCollectingGitInfo() {
  try {
    const output = child_process.execSync('git log --pretty=format:"%h%x09%an%x09%ad%x09%s" -n 10 --date=iso', { encoding: 'utf8' });
    const lines = output.trim().split('\n');
    const parsed = lines.map(ln => {
      const [hash, authorRaw, dateRaw, subject] = ln.trim().split('\t');
      const author = authorRaw.split(' ').slice(-1)[0];
      const date = new Date(dateRaw).toISOString();
      return { hash, author, date, subject };
    });
    return parsed;

  } catch (error) {
  }
}

/** @param {{ js: string, css: string, extras: import('esbuild').OutputFile[] }} jsAndCSS */
let coreBuiltResolve = (jsAndCSS) => { };
let coreBuiltPromise = new Promise(resolve => coreBuiltResolve = resolve);

async function updateHTML() {
  clearTimeout(updateHTMLTimeout);
  updateHTMLTimeout = undefined;

  const coreBuilt = await coreBuiltPromise;
  await mainBuiltPromise;

  updateIndexHTML({ core: coreBuilt });
}

const mainIndexHTMLPath = 'src/index.html';
const initHTMLPath = 'src/init.html';

/**
 * @param {{
 *  core: { js: string, css: string, extras: import('esbuild').OutputFile[] }
 * }} _
 */
function updateIndexHTML({ core }) {
  const srcIndexHTML = fs.readFileSync(path.resolve(__dirname, mainIndexHTMLPath), 'utf8');

  const substitutedIndexHTML = srcIndexHTML.replace(
    /(<link rel="icon"[^>]*>)|(<style[^>]*>\s*\/\*+\s*core\s*styles\s*\*+\/<\/style>)|(<script[^>]*>\s*\/\*+\s*core\s*scripts\s*\*+\/<\/script>)|(<\!--\s*init\s*html\s*--\>)/g,
    (fullMatch, linkMatch, styleMatch, scriptMatch, initHtmlMatch) => {
      // if (linkMatch) return linkMatch.replace(/favicon\.png/, () =>
      //   'data:image/png;base64,' + fs.readFileSync(path.resolve('src/favicon.png'), 'base64'));
      if (styleMatch) return '<' + 'style>' + core.css + '</' + 'style>';
      if (scriptMatch) return '<' + 'script>' + core.js + '</' + 'script>';
      if (initHtmlMatch) return fs.readFileSync(path.resolve(__dirname, initHTMLPath), 'utf8');
      return fullMatch;
    });
  
  fs.writeFileSync(path.resolve(__dirname, 'index.html'), substitutedIndexHTML);

  for (const fi of core.extras) {
    fs.writeFileSync(path.resolve(__dirname, fi.path), fi.contents);
  }

  printBanner(
    'CORE HTML EMBED built:' +
    core.extras.map(fi => '\n   ' + path.relative(__dirname, fi.path) + '[' + fi.contents.length.toLocaleString() + ']').join('') +
    '\n   index.html[' + substitutedIndexHTML.length.toLocaleString() +']');
}

function watchTemplateHTMLs() {
  console.log('watching template htmls...');
  fs.watchFile(path.resolve(__dirname, mainIndexHTMLPath), () => {
    queueHTMLUpdate();
  });
  fs.watchFile(path.resolve(__dirname, initHTMLPath), () => {
    console.log('init html changed');
    queueHTMLUpdate();
  });
}

async function buildCoreEmbedLayout(mode) {

  const options = /** @type {typeof baseOptions} */({
    ...baseOptions,
    sourcemap: false,
    write: false,
    format: 'iife',
    entryPoints: ['src/core.js'],
    plugins: [
      {
        name: 'post-export',
        /** @param {esbuild.PluginBuild} build */
        setup(build) {
          var longBuildTimeout;
          build.onStart(() => {
            coreBuiltPromise = new Promise(resolve => coreBuiltResolve = resolve);
            clearTimeout(longBuildTimeout);
            longBuildTimeout = setTimeout(() => {
              printBanner('CORE HTML EMBED...');
            }, 1000);
          });
          build.onEnd(result => {
            clearTimeout(longBuildTimeout);
            const coreJSIndex = result.outputFiles?.findIndex(file => file.path.endsWith('core.js')) ?? -1;
            const coreCSSIndex = result.outputFiles?.findIndex(file => file.path.endsWith('core.css')) ?? -1;
            const coreJSEntry = coreJSIndex >= 0 ? result.outputFiles?.[coreJSIndex] : null;
            const coreCSSEntry = coreCSSIndex >= 0 ? result.outputFiles?.[coreCSSIndex] : null;
            if (!coreJSEntry || !coreCSSEntry) {
              printBanner('CORE HTML: EMPTY OUTPUT');
              return;
            }

            queueHTMLUpdate();
            coreBuiltResolve({
              js: coreJSEntry?.text,
              css: coreCSSEntry?.text,
              extras: result.outputFiles?.filter((_x, index) => index !== coreJSIndex && index !== coreCSSIndex) || []
            });
          });
        }
      }
    ],
    outfile: 'core.js'
  });

  if (mode === 'serve' || mode === 'watch') {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    printBanner('WATCHING LIB...');
  } else {
    await esbuild.build(options);
  }
}

let mainBuiltResolve = () => { };
/** @type {Promise<void>} */
let mainBuiltPromise = new Promise(resolve => mainBuiltResolve = resolve);

async function buildMain(mode) {

  const options = {
    ...baseOptions,
    entryPoints: ['src/index.js'],
    outfile: 'index.js',
    write: false,
    plugins: [
      {
        name: 'post-export',
        /** @param {esbuild.PluginBuild} build */
        setup(build) {
          var longBuildTimeout;
          build.onStart(() => {
            mainBuiltPromise = new Promise(resolve => mainBuiltResolve = resolve);
            clearTimeout(longBuildTimeout);
            longBuildTimeout = setTimeout(() => {
              printBanner('SITE...');
            }, 1000);
          });
          build.onEnd(result => {
            clearTimeout(longBuildTimeout);

            let gitInjected = false;
            if (result.outputFiles?.length) {
              for (const ofile of result.outputFiles) {
                /** @type {typeof ofile.contents | typeof ofile.text} */
                let output = ofile.contents;

                if (ofile.path.endsWith('index.js')) {
                  const runtime_git_info = tryCollectingGitInfo();
                  if (runtime_git_info?.length) {
                    const originalText = ofile.text;
                    const replacement = originalText.replace(/\{\s*runtime_git_info\s*:\s*null\s*\}/, JSON.stringify({ runtime_git_info }));
                    if (replacement !== originalText) {
                      const index = /\{\s*runtime_git_info\s*:\s*null\s*\}/.exec(originalText)?.index ?? -1;
                      // if (index > 0) {
                      //   console.log('git inhjected at ' + originalText.slice(index - 20, index + 30));
                      //   console.log(' as ' + replacement.slice(index - 20, index + 30));
                      // }
                      output = replacement;
                      // @see https://github.com/evanw/esbuild/issues/1792#issuecomment-977529476
                      // @see https://github.com/evanw/esbuild/issues/2999#issuecomment-1741800101
                      ofile.contents = Buffer.from(replacement);
                      // Object.defineProperty(ofile, 'contents', { value: Buffer.from(replacement) });
                      gitInjected = true;
                    }
                  }
                }

                fs.mkdirSync(path.dirname(ofile.path), { recursive: true });
                fs.writeFileSync(path.resolve(__dirname, ofile.path), output);
              }
            }

            mainBuiltResolve();
            printBanner('SITE REBUILD COMPLETE' + (gitInjected ? '.' : ''));
          });
        }
      }]
  };

  if (mode === 'serve') {
    const ctx = await esbuild.context(options);
    const server = await ctx.serve({
      port: 8460,
      servedir: __dirname,
      fallback: 'index.html'
    });
    await ctx.watch();
    printBanner('SERVING SITE http://' + (server.host === '0.0.0.0' ? 'localhost' : server.host) + ':' + server.port + '/');
  } else if (mode === 'watch') {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    printBanner('WATCHING SITE...');
  } else {
    await esbuild.build(options);
  }
}

function queueHTMLUpdate() {
  clearTimeout(updateHTMLTimeout);
  updateHTMLTimeout = setTimeout(updateHTML, 300);
}

function buildAll() {
  const mode = process.argv.some(arg => /^\-*serve$/i.test(arg)) ? 'serve' :
    process.argv.some(arg => /^\-*watch$/i.test(arg)) ? 'watch' :
      undefined;

  buildMain(mode);
  buildCoreEmbedLayout(mode);
  if (mode === 'watch' || mode === 'serve')
    watchTemplateHTMLs();
}

if (typeof require === 'function' && typeof module !== 'undefined' && require?.main === module) {
  buildAll();
}