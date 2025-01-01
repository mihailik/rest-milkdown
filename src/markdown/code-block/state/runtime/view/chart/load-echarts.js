// @ts-check
/// <reference path="./load-echarts-var.d.ts" />

import './echarts-styles.css';

var echartsScriptIncluded;

export function loadEcharts() {
  if (typeof echarts !== 'undefined') return /** @type {typeof echarts & { then?: never }} */(echarts);
  else return new Promise(resolve => {
    if (!echartsScriptIncluded) {
      echartsScriptIncluded = document.createElement('script');
      echartsScriptIncluded.src = 'https://unpkg.com/echarts@5.5.1/dist/echarts.js';
      document.body.appendChild(echartsScriptIncluded);
    }

    const interval = setInterval(() => {
      if (typeof echarts !== 'undefined') {
        clearInterval(interval);
        resolve(echarts);
      }
    }, 100);
  });
}