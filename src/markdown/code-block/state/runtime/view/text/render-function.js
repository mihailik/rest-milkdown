// @ts-check

/**
 * @param {import('.').ValueRenderParams<Function>} _
 */
export function renderFunction({ value, wrap }) {
  let functionName = value.name;
  if (!functionName) {
    functionName = String(value).trim().split('\n')[0];
    if (functionName.length > 60)
      functionName = functionName.slice(0, 50) + '...' + functionName.slice(-5);
  }

  wrap.availableHeight = Math.max(0, wrap.availableHeight - 1);
  return [
    { class: 'success success-function function-render hi-identifier', textContent: functionName },
    {
      widget: () => {
        const btnRun = document.createElement('button');
        btnRun.className = 'function-render-invoke-button';
        btnRun.textContent = '() >';
        btnRun.onclick = async () => {
          /** @type {any} */
          let args = prompt('functionName arguments:');
          if (args === null) return;

          try {
            args = (0, eval)('[' + args + ']');
          } catch (err) {
            args = [args];
          }

          btnRun.textContent = '() >...';

          const returnValue = await value(...args);
          btnRun.textContent = '() = ' +
            (returnValue ? returnValue : typeof returnValue + ' ' + returnValue);
        };
        return btnRun;
      }
    }
  ];
}
