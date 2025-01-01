// @ts-check

import { renderValue } from './render-value';

/**
 * @param {import('.').ValueRenderParams<Iterable | AsyncIterable>} _
 */
export function renderIterable({ value, path, indent, wrap, invalidate, state }) {
  /** @typedef {{ top: any[], completed: boolean, error: any, next: () => void }} IterationStatus */
  /** @type {Map<any, IterationStatus>} */
  let iterationStatuses = state.iterationStatuses || (state.iterationStatuses = new Map());

  let status = iterationStatuses.get(value);
  if (!status) {
    status = {
      top: [],
      completed: false,
      error: undefined,
      next: () => { }
    };
    state.iterationStatuses.set(value, status);

    (async () => {
      let lastRest = Date.now();
      try {
        for await (const entry of value) {
          status.top.push(entry);
          invalidate();

          if (Date.now() - lastRest > 600) {
            // @ts-ignore
            let morePromise = new Promise(resolve => status.next = resolve);
            await morePromise;

            lastRest = Date.now();
            invalidate();
          }
        }
        status.completed = true;
        invalidate();
      } catch (error) {
        status.completed = true;
        status.error = error;
        invalidate();
      }
    })();
  }

  const top = status.completed && !status.error ? status.top :
    [
      ...status.top,
      status.error || 'Loading...'
    ];

  return [
    renderValue({ value: top, path, indent, wrap, invalidate, state }),
    {
      widget: () => {
        const btnMore = document.createElement('button');
        btnMore.className = 'iterable-more';
        btnMore.textContent = 'More...';
        btnMore.onclick = () => {
          status?.next();
        };
        return btnMore;
      }
    }
  ].flat();
}
