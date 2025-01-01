// @ts-check

import { ASSOCIATED_CSS_TAG, BACKUP_CHILD_NODES_TAG } from '../markdown/code-block/state-html/plugin-runtime';
import { storedElements } from './serialize/remote-objects';

const zeroBounds = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };

export function executePresentVisualRequest({
  domAccessKey,
  console
}) {
  for (let iFrame = 0; iFrame < window.parent.frames.length; iFrame++) {
    try {
      const siblingFrame = window.parent.frames[iFrame];
      if (siblingFrame.document.body) {
        const storedElementsMap = storedElements(siblingFrame);
        if (!storedElementsMap?.size) return;

        const weakRef = storedElementsMap.get(domAccessKey);

        const element = /** @type {HTMLElement | undefined} */(weakRef?.deref());

        /** @type {{ left: number, top: number, right: number, bottom: number, width: number, height: number } | undefined} */
        let bounds;
        if (element) {

          try {
            if (typeof element.getBoundingClientRect === 'function') {
              bounds = { ...zeroBounds, ...element.getBoundingClientRect() };
            }
          } catch (err) {
          }

          document.body.textContent = '';
          let childNodes = [...element.childNodes];
          if (element.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            if (element[BACKUP_CHILD_NODES_TAG]) {
              childNodes = element[BACKUP_CHILD_NODES_TAG];

              for (const child of element[BACKUP_CHILD_NODES_TAG]) {
                document.body.appendChild(child);
              }
            } else {
              element[BACKUP_CHILD_NODES_TAG] = childNodes;
              document.body.appendChild(element);
            }
          } else {
            document.body.appendChild(element);
          }

          if (element[ASSOCIATED_CSS_TAG]) {
            const styles = document.createElement('style');
            styles.innerHTML = element[ASSOCIATED_CSS_TAG];
            document.head.appendChild(styles);
          }

          try {
            if (!bounds || bounds.width <= 4 && bounds.height <= 4) {
              if (typeof element.getBoundingClientRect === 'function') {
                bounds = { ...zeroBounds, ...element.getBoundingClientRect() };
              }
            }

            if (childNodes.length) {
              if (!bounds) bounds = { ...zeroBounds };
              for (const child of childNodes) {
                try {
                  if (typeof /** @type {HTMLElement} */(child).getBoundingClientRect === 'function') {
                    const childBounds = /** @type {HTMLElement} */(child).getBoundingClientRect();
                    if (childBounds) {
                      if (childBounds.left < bounds.left) bounds.left = childBounds.left;
                      if (childBounds.top < bounds.top) bounds.top = childBounds.top;
                      if (childBounds.right > bounds.right) bounds.right = childBounds.right;
                      if (childBounds.bottom > bounds.bottom) bounds.bottom = childBounds.bottom;

                      bounds.width = bounds.right - bounds.left;
                      bounds.height = bounds.bottom - bounds.top;
                    }
                  }
                } catch (childBoundsError) { }
              }
            }
          } catch (getBoundsError) { }

          console.log('IFRAME WORKER PRESENTED VISUAL ', domAccessKey, element, bounds);
        }

        return { bounds };
      }
    } catch (error) {
      console.error('IFRAME WORKER ERROR PRESENTING VISUAL ', domAccessKey, error);
    }
  }
}