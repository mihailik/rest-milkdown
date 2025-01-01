export function noteFontCssLinks() {
  return [
    'Noto Sans Math',
    'Noto Sans:100,200,300,400,500,600,700,800,900',
    'Noto Emoji',
    'Noto Sans Symbols',
    'Noto Sans Symbols 2'
  ].map(family => 'https://fonts.googleapis.com/css?family=' + family);
}

export function mainLayout() {
  return (
    `
  <table id=main
    cellspacing=0 cellpadding=0
    style="position: absolute; left: 0; top: 0; width: 100%; height: 100%;">
    <tr>
      <td width="100%" style="position: relative">
        <div id=contentHost style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: hidden;">
          <div id=unicontent class=content-area>
            <textarea id="textarea" autofocus></textarea>
          </div>
          <div id=fmtcontent class=content-area style="display: none">
          </div>
          <div id=restcontent class=content-area style="display: none">
          </div>
          <div id=filecontent class=content-area style="display: none">
          </div>
        </div>
      </td>
      <td width="1%" style="position: relative; width: 1em; padding-right: 0.7em;" id="toolbar" valign=top>
        <div id=unitools>
          <button id="bold"><span class="symbol-formatted">𝗕</span>old</button><button id="italic"><span
            class="symbol-formatted">𝘐</span>talic</button><button id="underlined"><span
            class="symbol-formatted">U̲</span>nderlined</button><button id="fractur"><span
            class="symbol-formatted">𝕱</span>ractur</button><button id="cursive"><span
            class="symbol-formatted">𝓒</span>ursive</button><button id="super"><span
            class="symbol-formatted">ˢ</span>uper</button><button id="box">bo<span
            class="symbol-formatted">🅇</span></button><button id="plate"><span
            class="symbol-formatted">🅿</span>late</button><button id="round"><span
            class="symbol-formatted">Ⓡ</span>ound</button><button id="typewriter"><span
            class="symbol-formatted">𝚃</span>ypewriter</button><button id="wide"><span
            class="symbol-formatted">𝕎</span>ide</button><button id="khazad"><span
            class="symbol-formatted">ᛕ</span>hazad-<span class="symbol-formatted-2">ᚦ</span>ûm</button><button id="joy"><span
            class="symbol-formatted">ᣫ</span>oy</button>
        </div>

        <div id=fmttools></div>
        <div id=filetools></div>

        <div id=moreModes style="height: 3em;
        padding-top: 0.2em;
        padding-left: 0.5em;
        text-align: center;
        cursor: default;
        font-size: 200%;
        opacity: 0.4;">
          +
        </div>

        <div id="version" style="
          position: absolute;
          bottom: 0;
          width: 100%;
          text-align: right;
          padding-right: 0.5em;
          color: silver;
          font-size: 80%;">
          v0.9.2<sup>?</sup>
        </div>
      </td>
    </tr>
  </table>
`
  );
}
