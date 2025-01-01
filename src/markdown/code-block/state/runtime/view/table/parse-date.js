// @ts-check

const minDateNum = +new Date('2000-01-01');
const maxDateNum = +new Date('2050-01-01');

/** @param {string | Date | number | null | undefined} str */
export function parseDate(str) {
  if (typeof str === 'string') return parseDateStr(str);
  if (typeof str === 'number') return parseDateNum(str);
}

/**@param {string} str */
function parseDateStr(str) {
  if (str.length < 8) return;
  let dt = new Date(str);
  if (!Number.isNaN(dt.getTime())) return dt;

  const num = Number(str);
  if (Number.isFinite(num)) return parseDateNum(num);
}

/**@param {number} num */
function parseDateNum(num) {
  const isWholeNumber = num === Math.floor(num);
  if (isWholeNumber) {
    if (num > minDateNum && num < maxDateNum) return new Date(num);
    const numX1000 = num * 1000;
    if (numX1000 > minDateNum && numX1000 < maxDateNum) return new Date(numX1000);
  }

  // 20241106 i.e. YYYYMMDD
  if (num > 20000101 && num < 20500101) {
    if (isWholeNumber)
      return new Date(Date.UTC(num / 10000, num / 100 % 100 - 1, num % 100));
    // hope no need to support YYYYMMDD.hhmmss?
  }
}