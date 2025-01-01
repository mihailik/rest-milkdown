// @ts-check

/**
 * @typedef {Omit<import('.').ValueRenderParams, 'value'> & {
 *  formats: { [format: string]: () => (args: import('.').ValueRenderParams) => FormatTagOption },
 *  json: (args: import('.').ValueRenderParams) => import('..').RenderedContent[]
 * }} FormatTagParams
 */

/**
 * @typedef {{
 *  preference: number,
 *  button: HTMLElement,
 *  render: () => HTMLElement | null | undefined
 * }} FormatTagOption
 */

const TAG_WIDGET_SUFFIX = '.tagWidget';
const TAG_VIEW_SUFFIX = '.tagView';

/**
 * @param {FormatTagParams} params
 * @returns {{ view?: string } & ((params: import('.').ValueRenderParams) => import('..').RenderedContent[])}
 */
export function formatTagWidget(params) {

  /** @type {ReturnType<typeof createToggleWidget>} */
  let toggleWidget = params.state[params.path + TAG_WIDGET_SUFFIX];
  if (!toggleWidget) {
    toggleWidget = createToggleWidget();
    params.state[params.path + TAG_WIDGET_SUFFIX] = toggleWidget;
  }

  return toggleWidget;

  function createToggleWidget() {
    const togglePanel = document.createElement('span');
    togglePanel.className = 'inline-view-toggle-panel';
    let visibleTag;
    let carryValue;

    const jsonButton = createTagToggle('json');
    jsonButton.textContent = '{}';

    jsonButton.onclick = () => {
      params.state[params.path + TAG_VIEW_SUFFIX] = bindValue.view = 'json';
      params.invalidate();
    };

    /** @type {{ format: string, apply(args: import('.').ValueRenderParams): FormatTagOption, button: HTMLElement }[]} */
    const formatters = [];

    for (const [format, ctor] of Object.entries(params.formats)) {
      const button = createTagToggle(format);
      togglePanel.appendChild(button);
      const apply = ctor();
      formatters.push({ format, apply, button });

      button.onclick = () => {
        params.state[params.path + TAG_VIEW_SUFFIX] = bindValue.view = format;
        params.invalidate();
      };
    }

    togglePanel.appendChild(jsonButton);

    bindValue.view = 'json';

    return bindValue;

    /**
     * @param {import('.').ValueRenderParams} args
     * @returns {import('..').RenderedContent[]}
     */
    function bindValue(args) {
      carryValue = args.value;

      const applied = formatters.map(fmt => {
        const innerWrap = { ...args.wrap, availableHeight: args.wrap.availableHeight };
        const result = fmt.apply({
          ...args,
          wrap: innerWrap
        });
        return /** @type {const} */([result, innerWrap]);
      });
      let bestFormatIndex = -1;

      const availableTags = [];

      for (let iFormat = 0; iFormat < applied.length; iFormat++) {
        const [appliedFmt, innerWrap] = applied[iFormat];
        const fmt = formatters[iFormat];
        if (appliedFmt.preference > 0) {
          availableTags[iFormat] = true;
          fmt.button.style.display = /** @type {*} */(null);
          if (fmt.button.firstChild !== appliedFmt.button) {
            fmt.button.textContent = '';
            fmt.button.appendChild(appliedFmt.button);
          }
          if (bestFormatIndex < 0 || appliedFmt.preference > applied[bestFormatIndex][0].preference)
            bestFormatIndex = iFormat;
        } else {
          availableTags[iFormat] = false;
          fmt.button.style.display = 'none';
        }
      }

      const stateView = params.state[params.path + TAG_VIEW_SUFFIX];
      if (stateView) {
        let retainStateFormatIndex = formatters.findIndex(fmt => fmt.format === stateView);
        if (retainStateFormatIndex >= 0 && availableTags[retainStateFormatIndex] || stateView === 'json')
          bestFormatIndex = retainStateFormatIndex;
      }

      if (bestFormatIndex < 0) {
        params.state[params.path + TAG_VIEW_SUFFIX] = bindValue.view = 'json';
        jsonButton.classList.add('inline-view-toggle-button-selected');
      } else {
        jsonButton.classList.remove('inline-view-toggle-button-selected');
      }

      bindValue.view = formatters[bestFormatIndex]?.format;

      for (let iFormat = 0; iFormat < applied.length; iFormat++) {
        const fmt = formatters[iFormat];
        if (iFormat === bestFormatIndex) fmt.button.classList.add('inline-view-toggle-button-selected');
        else fmt.button.classList.remove('inline-view-toggle-button-selected');
      }

      let subsequentJson;
      if (bestFormatIndex < 0) {
        const innerWrap = { ...args.wrap, availableHeight: args.wrap.availableHeight };
        const renderOutput = params.json({
          ...args,
          wrap: innerWrap
        });
        subsequentJson = /** @type {const} */([renderOutput, innerWrap]);
      }

      const newVisibleTag = applied[bestFormatIndex]?.[0].render();
      if (newVisibleTag !== visibleTag && visibleTag) visibleTag.remove();
      if (newVisibleTag && newVisibleTag.parentElement !== togglePanel) togglePanel.appendChild(newVisibleTag);
      visibleTag = newVisibleTag;

      let combined =
        !subsequentJson ? [{ widget: togglePanel }] :
          Array.isArray(subsequentJson[0]) ? [{ widget: togglePanel }, ...subsequentJson[0]] :
            [{ widget: togglePanel }, subsequentJson[0]];
      
      params.wrap.availableHeight = 
        (bestFormatIndex >= 0 ? applied[bestFormatIndex][1].availableHeight : 0) +
        (subsequentJson ? subsequentJson[1].availableHeight : 0);

      return combined;
    }
  }

  /**
   * @param {string} format
   */
  function createTagToggle(format) {
    const tagButton = document.createElement('button');
    tagButton.className =
      'inline-view-toggle-button inline-view-toggle-button-' + format;
    tagButton.textContent = format;
    return tagButton;
  }
}