// @ts-check

/** @typedef {import('typescript').IScriptSnapshot} IScriptSnapshot */

/** @implements {IScriptSnapshot} */
export class EditedScriptSnapshot {
  /**
   * @param {EditedScriptSnapshot | null} prev
   * @param {number} from
   * @param {number} to
   * @param {string} newText
   */
  constructor(prev, from, to, newText) {
    this.prev = prev;
    this.from = from;
    this.to = to;
    this.mid = newText;
    /** @type {number} */
    this.version = 0;
    if (prev) this.version = prev.version + 1;
  }

  /** @type {import('typescript').IScriptSnapshot['getText']} */
  getText(start, end) {
    if (end < 0) end = this.getLength();
    if (!this.prev) return this.mid.slice(start, end);

    if (end <= this.from) return this.prev.getText(start, end);

    const increase = this.mid.length - (this.to - this.from);

    const prevEnd =
      end <= this.from ? end :
        Math.max(this.from, end - increase);

    if (start - increase >= prevEnd) return this.prev.getText(start - increase, end - increase);

    if (start < this.from) {
      const lead = this.prev.getText(start, this.from);
      const mid = this.mid.slice(0, end - this.from); // slice protects from overflow
      if (end <= this.from + this.mid.length) return lead + mid;
      const trail = this.prev.getText(this.to, end - increase);
      return lead + mid + trail;
    } else {
      const mid = this.mid.slice(start - this.from, end - this.from); // slice protects from overflow
      if (end <= this.from + this.mid.length) return mid;
      const trail = this.prev.getText(this.to, end - increase);
      return mid + trail;
    }
  }

  getLength() {
    if (!this.prev) return this.mid.length;
    const increase = this.mid.length - (this.to - this.from);
    return this.prev.getLength() + increase;
  }

  /** @type {import('typescript').IScriptSnapshot['getChangeRange']} */
  getChangeRange(oldSnapshot) {
    if (oldSnapshot === this) return {
      span: { start: 0, length: 0 },
      newLength: 0
    };

    if (!this.prev) return undefined;

    const changeRange = this.prev.getChangeRange(oldSnapshot);
    if (!changeRange) return undefined;

    let oldSpanStart = changeRange.span.start;
    let oldSpanEnd = changeRange.span.start + changeRange.span.length;
    let newSpanStart = oldSpanStart;
    let newSpanEnd = oldSpanStart + changeRange.newLength;

    if (oldSpanStart > this.from) {
      oldSpanStart = this.from;
      newSpanStart = this.from;
    }

    if (oldSpanEnd < this.to) {
      oldSpanEnd = this.to;
      newSpanEnd = this.from + this.mid.length;
    } else {
      newSpanEnd += this.mid.length - (this.to - this.from);
    }

    changeRange.newLength = newSpanEnd - newSpanStart;
    changeRange.span.start = oldSpanStart;
    changeRange.span.length = oldSpanEnd - oldSpanStart;

    return changeRange;
  }

  /**
   * @param {number} from
   * @param {number} to
   * @param {string} newText
   */
  applyEdits(from, to, newText) {
    if (!from && (to === this.getLength() || to === -1)) {
      if (!this.prev && this.mid === newText) return this;
      const newSnapshot = new EditedScriptSnapshot(null, 0, 0, newText);
      newSnapshot.version = this.version + 1;
      return newSnapshot;
    } else if (to - from === newText.length && this.getText(from, to) === newText) {
      return this;
    } else {
      const newSnapshot = new EditedScriptSnapshot(this, from, to, newText);
      newSnapshot.version = this.version + 1;
      return newSnapshot;
    }
  }

  dispose() {
    if (this.prev) {
      this.mid = this.getText(0, this.getLength());
      this.prev = null;
      this.from = this.to = 0;
    }
  }
}
