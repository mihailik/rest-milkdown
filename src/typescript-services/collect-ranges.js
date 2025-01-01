// @ts-check

/**
 * @typedef {{
 *  from: number,
 *  fromLine: number,
 *  foldFrom: number,
 *  to: number,
 *  toLine: number,
 *  foldTo: number,
 *  recommendCollapse: boolean,
 *  childRanges: SemanticRange[]
 * }} SemanticRange
 */

const MIN_RANGE_LINE_HEIGHT = 4;
const DESIRED_CONTENT_HEIGHT = 20;

/**
 * @param {import('.').LanguageServiceAccess} accessLang
 * @param {string} fileName
 */
export function collectRanges(accessLang, fileName) {
  const { ts, languageService } = accessLang;

  /** @type {SemanticRange[] | undefined} */
  let ranges;

  /** @type {SemanticRange[] | undefined} */
  let allRanges;

  /** @type {SemanticRange | undefined} */
  let currentParentRange;

  const ast = /** @type {import('typescript').SourceFile} */(languageService.getProgram()?.getSourceFile(fileName));
  const text = ast?.text || '';
  ast?.forEachChild(visit);

  if (ranges)
    assessCollapseRecommendationsWithin(ranges, 0, ast.getLineStarts().length);

  // expand top level range
  let topLevel = ranges;
  while (topLevel && topLevel.length === 1) {
    topLevel[0].recommendCollapse = false;
    topLevel = topLevel[0].childRanges;
  }

  if (allRanges)
    allRanges.sort((a, b) => a.from - b.from);

  if (ranges && allRanges) return { ranges, allRanges };

  /**
   * @param {import('typescript').Node} node
   */
  function visit(node) {
    const from = node.getStart();

    // more precise line height, likely take more performance to calculate
    const fromCoord = ast.getLineAndCharacterOfPosition(from);
    const toCoord = ast.getLineAndCharacterOfPosition(node.end);

    // range too short
    if (toCoord.line - fromCoord.line < MIN_RANGE_LINE_HEIGHT) return;

    // range sticking to the parent too tightly
    if (currentParentRange && fromCoord.line <= currentParentRange.toLine + 1 && toCoord.line >= currentParentRange.toLine - 1) {
      node.forEachChild(visit);
      return;
    }

    // approximate as end of line
    let foldFrom = ast.getPositionOfLineAndCharacter(fromCoord.line + 1, 0) - 1;
    while (/\s/.test(text.charAt(foldFrom-1))) foldFrom--;

    // approximate as start of line
    let foldTo = ast.getPositionOfLineAndCharacter(toCoord.line, 0);
    while (/\s/.test(text.charAt(foldTo))) foldTo++;

    const range = {
      from,
      fromLine: fromCoord.line,
      foldFrom,
      to: node.end,
      toLine: toCoord.line,
      foldTo,
      recommendCollapse: false,
      childRanges: []
    };
    if (!allRanges) allRanges = [range];
    else allRanges.push(range);

    if (currentParentRange) currentParentRange.childRanges.push(range);
    else if (!ranges) ranges = [range];
    else ranges.push(range);

    const saveCurrentParentRange = currentParentRange;
    currentParentRange = range;
    node.forEachChild(visit);
    currentParentRange = saveCurrentParentRange;
  }
}

/**
 * @param {SemanticRange[]} ranges
 * @param {number} containerLineFrom
 * @param {number} containerLineTo
 */
function assessCollapseRecommendationsWithin(ranges, containerLineFrom, containerLineTo) {
  if (containerLineTo - containerLineFrom < DESIRED_CONTENT_HEIGHT) return;

  let overwhelmingChild = findOverwhelmingRange(ranges, containerLineFrom, containerLineTo);

  if (overwhelmingChild) {
    const heightAfterCollapse = containerLineTo - containerLineFrom - overwhelmingChild.fromLine - overwhelmingChild.toLine;
    if (heightAfterCollapse > DESIRED_CONTENT_HEIGHT || heightAfterCollapse < MIN_RANGE_LINE_HEIGHT) {
      // see if collapsing all children is better?
      let allChildrenCollapseSavings = 0;
      for (const range of ranges) {
        allChildrenCollapseSavings += range.toLine - range.fromLine - 1;
        // range.recommendCollapse = true;
        // assessCollapseRecommendationsWithin(range.childRanges, range.fromLine, range.toLine);
      }

      const heightAfterAllChildrenCollapse = containerLineTo - containerLineFrom - allChildrenCollapseSavings;
      if (Math.abs(heightAfterAllChildrenCollapse - DESIRED_CONTENT_HEIGHT) < Math.abs(heightAfterCollapse - DESIRED_CONTENT_HEIGHT)) {
        for (const range of ranges) {
          range.recommendCollapse = true;
          assessCollapseRecommendationsWithin(range.childRanges, range.fromLine, range.toLine);
        }
        return;
      }
    }

    // check if it's best to collapse within the range
    const overwhelmingGrandchild = findOverwhelmingRange(overwhelmingChild.childRanges, overwhelmingChild.fromLine, overwhelmingChild.toLine);
    if (overwhelmingGrandchild) {
      const heightAfterGrandchildCollapse = overwhelmingChild.toLine - overwhelmingChild.fromLine - (overwhelmingGrandchild.fromLine - overwhelmingGrandchild.toLine);
      if (Math.abs(heightAfterGrandchildCollapse - DESIRED_CONTENT_HEIGHT) < Math.abs(heightAfterCollapse - DESIRED_CONTENT_HEIGHT)) {
        overwhelmingGrandchild.recommendCollapse = true;
        assessCollapseRecommendationsWithin(overwhelmingGrandchild.childRanges, overwhelmingGrandchild.fromLine, overwhelmingGrandchild.toLine);
        return;
      }
    }

    overwhelmingChild.recommendCollapse = true;
    assessCollapseRecommendationsWithin(overwhelmingChild.childRanges, overwhelmingChild.fromLine, overwhelmingChild.toLine);
  } else {
    // collapse all children, or maybe collapse all grandchildren?
    for (const range of ranges) {
      range.recommendCollapse = true;
      assessCollapseRecommendationsWithin(range.childRanges, range.fromLine, range.toLine);
    }
  }
}

/**
 * @param {SemanticRange[]} ranges
 * @param {number} containerLineFrom
 * @param {number} containerLineTo
 */
function findOverwhelmingRange(ranges, containerLineFrom, containerLineTo) {
  /** @type {SemanticRange | undefined} */
  let overwhelmingCollapseRange;

  for (const range of ranges) {
    if (range.toLine - range.fromLine > (containerLineTo - containerLineFrom) / 2) {
      overwhelmingCollapseRange = range;
      break;
    }
  }

  return overwhelmingCollapseRange;
} 