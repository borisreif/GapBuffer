/**
 * Mutable gap buffer data structure.
 *
 * A gap buffer stores text in an array with an empty "gap" at the cursor.
 * Insertions at the cursor are efficient because characters are written
 * directly into the gap.
 *
 * @author Boris A. Reif
 *
 * @link https://en.wikipedia.org/wiki/Gap_buffer
 * @link https://www.geeksforgeeks.org/dsa/gap-buffer-data-structure/
 * @link https://workdad.dev/posts/building-a-text-editor-the-gap-buffer/
 * @link https://coredumped.dev/2023/08/09/text-showdown-gap-buffers-vs-ropes/
 * @link https://iq.opengenus.org/data-structures-used-in-text-editor/
 * @link https://belanyi.fr/2024/07/06/gap-buffer/
 *
 * Gap buffer concept:
 *
 * The internal array is divided into three regions:
 *
 *   [ text before cursor ][      gap      ][ text after cursor ]
 *
 * Example:
 *
 *   buffer:   [ "H", "e", "l", "l", "o", null, null, null, "!", "!" ]
 *   indexes:     0    1    2    3    4     5     6     7     8    9
 *                                      ^gapStart         ^gapEnd
 *
 * Logical text:
 *
 *   "Hello!!"
 *
 * The cursor is always located at gapStart.
 * Insertions happen at gapStart by filling the gap.
 * Moving the cursor left/right shifts characters across the gap.
 *
 * Indexing model:
 * This class uses JavaScript string offsets, meaning positions are measured
 * in UTF-16 code units. This matches String.prototype.length,
 * String.prototype.slice(), textarea.selectionStart, and textarea.selectionEnd.
 *
 * Note:
 * User-perceived characters such as emoji, flags, and combined accents may
 * span multiple UTF-16 code units. Grapheme-aware cursor movement should be
 * implemented at the editor/model layer, not inside this low-level buffer.
 *
 * Core API:
 * - length
 * - cursor
 * - capacity
 * - isEmpty
 * - toString()
 * - moveCursor(position)
 * - insert(text)
 * - backspace()
 * - deleteForward()
 * - deleteRange(start, end)
 * - clear()
 * - setText(text)
 * - charAt(index)
 *
 * Debug API:
 * - debugSnapshot()
 * - debugValidate()
 *
 *
 * @example
 * const buffer = new GapBuffer();
 *
 * buffer.insert("hello");
 * buffer.moveCursor(2);
 * buffer.insert("X");
 *
 * console.log(buffer.toString()); // "heXllo"
 * console.log(buffer.cursor);     // 3
 * console.log(buffer.length);     // 6
 *
 *
 */
export default class GapBuffer {
  /**
   * Internal storage array.
   * Characters before the gap are stored at the beginning of the array.
   * Characters after the gap are stored at the end of the array.
   *
   * @type {Array<string|null>}
   */
  #buffer;

  /**
   * Index where the gap begins.
   * This is also the logical cursor position.
   *
   * @type {number}
   */
  #gapStart;

  /**
   * Index where the gap ends.
   * The gap occupies the range [#gapStart, #gapEnd).
   *
   * @type {number}
   */
  #gapEnd;

  /**
   * Creates a new empty gap buffer.
   *
   * Non-finite initial sizes fall back to 16. Finite values are floored
   * and clamped to at least 1.
   *
   * @param {number} [initialSize=16] - Initial capacity of the internal buffer.
   */
  constructor(initialSize = 16) {
    const size = Number.isFinite(initialSize)
      ? Math.max(1, Math.floor(initialSize))
      : 16;

    this.#buffer = new Array(size).fill(null);
    this.#gapStart = 0;
    this.#gapEnd = size;
  }

  // ----------------------------
  // Public API
  // ----------------------------

  /**
   * Returns the number of actual characters stored in the buffer.
   *
   * This excludes the unused gap area.
   *
   * @returns {number} The current text length.
   */
  get length() {
    return this.#buffer.length - this.#gapSize;
  }

  /**
   * Returns the current cursor position.
   *
   * The cursor is always located at the start of the gap.
   *
   * @returns {number} The current cursor index.
   */
  get cursor() {
    return this.#gapStart;
  }

  /**
   * Returns the total capacity of the internal buffer.
   *
   * This includes both real characters and unused gap space.
   *
   * @returns {number} The internal buffer capacity.
   */
  get capacity() {
    return this.#buffer.length;
  }

  /**
   * Indicates whether the buffer contains no text.
   *
   * This is a convenience getter equivalent to checking whether
   * `this.length === 0`.
   *
   * @returns {boolean} True if the buffer is empty, otherwise false.
   */
  get isEmpty() {
    return this.length === 0;
  }

  /**
   * Converts the gap buffer contents into a normal string.
   *
   * The internal gap is skipped.
   *
   * @returns {string} The text stored in the buffer.
   */
  toString() {
    const prefix = this.#buffer.slice(0, this.#gapStart).join("");
    const suffix = this.#buffer.slice(this.#gapEnd).join("");

    return prefix + suffix;
  }

  /**
   * Moves the cursor to the given logical text position.
   *
   * Numeric positions outside the valid range are clamped to [0, this.length].
   * Invalid positions such as NaN or non-number values throw a TypeError.
   *
   * @example
   * const buffer = new GapBuffer();
   * buffer.insert("hello");
   * buffer.moveCursor(2);
   * buffer.insert("X");
   *
   * console.log(buffer.toString()); // "heXllo"
   * console.log(buffer.cursor);     // 3
   *
   * @param {number} position - Desired cursor position.
   * @throws {TypeError} If position is not a valid number.
   * @returns {GapBuffer} This gap buffer instance, for method chaining.
   */
  moveCursor(position) {
    const target = this.#clampPosition(position);

    while (target < this.#gapStart) {
      this.#moveGapLeft();
    }

    while (target > this.#gapStart) {
      this.#moveGapRight();
    }

    return this;
  }

  /**
   * Inserts text at the current cursor position.
   *
   * If the gap becomes full, the internal buffer automatically grows.
   *
   * Example:
   *
   *   Before:
   *     [ "H", "i", null, null, "!" ]
   *                 ^cursor
   *
   *   insert("X")
   *
   *   After:
   *     [ "H", "i", "X", null, "!" ]
   *                      ^cursor
   *
   * @example
   * const buffer = new GapBuffer();
   * buffer.insert("hello");
   *
   * console.log(buffer.toString()); // "hello"
   * console.log(buffer.cursor);     // 5
   *
   * @param {string} text - Text to insert at the cursor.
   * @throws {TypeError} If text is not a string.
   * @returns {GapBuffer} This gap buffer instance, for method chaining.
   */
  insert(text) {
    if (typeof text !== "string") {
      throw new TypeError("GapBuffer.insert() expects a string.");
    }

    for (let i = 0; i < text.length; i++) {
      if (this.#gapSize === 0) {
        this.#grow();
      }

      this.#buffer[this.#gapStart] = text[i];
      this.#gapStart++;
    }

    return this;
  }

  /**
   * Deletes the character immediately before the cursor.
   *
   * This behaves like the Backspace key in a text editor.
   *
   * @returns {string|null} The deleted character; null if nothing was deleted.
   */
  backspace() {
    if (this.#gapStart <= 0) return null;

    this.#gapStart--;

    const deleted = this.#buffer[this.#gapStart];
    this.#buffer[this.#gapStart] = null;

    return deleted;
  }

  /**
   * Deletes the character immediately after the cursor.
   *
   * This behaves like the Delete key in a text editor.
   *
   * @returns {string|null} The deleted character; null if nothing was deleted.
   */
  deleteForward() {
    if (this.#gapEnd >= this.#buffer.length) return null;

    const deleted = this.#buffer[this.#gapEnd];
    this.#buffer[this.#gapEnd] = null;
    this.#gapEnd++;

    return deleted;
  }

  /**
   * Deletes a range of characters from the buffer.
   *
   * The range is interpreted as [start, end), meaning start is included
   * and end is excluded.
   *
   * Numeric positions outside the valid range are clamped.
   * Invalid positions such as NaN or non-number values throw a TypeError.
   *
   *
   * @example
   * const buffer = new GapBuffer();
   * buffer.insert("hello world");
   * buffer.deleteRange(5, 11);
   *
   * console.log(buffer.toString()); // "hello"
   *
   *
   * @param {number} start - Start index of the range to delete.
   * @param {number} end - End index of the range to delete.
   * @throws {TypeError} If start or end is not a valid number.
   * @returns {number} The number of characters deleted.
   */
  deleteRange(start, end) {
    const safeStart = this.#clampPosition(start);
    const safeEnd = Math.max(safeStart, this.#clampPosition(end));
    const count = safeEnd - safeStart;

    this.moveCursor(safeStart);

    for (let i = 0; i < count; i++) {
      this.deleteForward();
    }

    return count;
  }

  /**
   * Removes all text from the buffer.
   *
   * The internal capacity is preserved.
   *
   * @returns {GapBuffer} This gap buffer instance, for method chaining.
   */
  clear() {
    this.#buffer.fill(null);
    this.#gapStart = 0;
    this.#gapEnd = this.#buffer.length;

    return this;
  }

  /**
   * Replaces the entire contents of the buffer with new text.
   *
   * The internal buffer is recreated with enough capacity to hold the text
   * plus extra gap space for future insertions. After this operation, the
   * cursor is positioned at the end of the inserted text.
   *
   * @example
   * const buffer = new GapBuffer();
   * buffer.insert("old text");
   * buffer.setText("new text");
   *
   * console.log(buffer.toString()); // "new text"
   * console.log(buffer.cursor);     // 8
   *
   * @param {string} text - New text content for the buffer.
   * @throws {TypeError} If text is not a string.
   * @returns {GapBuffer} This gap buffer instance, for method chaining.
   */
  setText(text) {
    if (typeof text !== "string") {
      throw new TypeError("GapBuffer.setText() expects a string.");
    }

    const size = Math.max(1, text.length * 2, 16);

    this.#buffer = new Array(size).fill(null);
    this.#gapStart = 0;
    this.#gapEnd = size;

    return this.insert(text);
  }

  /**
   * Returns the character at the given logical text index.
   *
   * Numeric positions outside the valid range are clamped. If the final
   * position is equal to the text length, an empty string is returned.
   *
   * Example:
   *   charAt(-10)
   *   returns the first character, because #clampPosition(-10) becomes 0.
   *
   *   charAt(Infinity)
   *   returns "", because it clamps to this.length.
   *
   * Note:
   *    This is slightly different from String.prototype.charAt():
   *    negative indexes are clamped to 0 instead of returning "".
   *
   * @example
   * const buffer = new GapBuffer();
   * buffer.insert("hello");
   *
   * console.log(buffer.charAt(0));        // "h"
   * console.log(buffer.charAt(1));        // "e"
   * console.log(buffer.charAt(-10));      // "h"
   * console.log(buffer.charAt(Infinity)); // ""
   *
   * @param {number} index - Logical text index.
   * @throws {TypeError} If index is not a valid number.
   * @returns {string} Character at the index, or an empty string at the end.
   */
  charAt(index) {
    const safeIndex = this.#clampPosition(index);

    if (safeIndex === this.length) return "";

    if (safeIndex < this.#gapStart) {
      return this.#buffer[safeIndex];
    }

    return this.#buffer[safeIndex + this.#gapSize];
  }

  /**
   * Returns a debugging snapshot of the current internal state.
   *
   * This is useful for tests, debugging, and visualizing the gap.
   *
   * @returns {{
   *   text: string,
   *   cursor: number,
   *   length: number,
   *   capacity: number,
   *   gapStart: number,
   *   gapEnd: number,
   *   gapSize: number,
   *   buffer: Array<string|null>
   * }} A snapshot of the gap buffer state.
   */
  debugSnapshot() {
    return {
      text: this.toString(),
      cursor: this.cursor,
      length: this.length,
      capacity: this.capacity,
      gapStart: this.#gapStart,
      gapEnd: this.#gapEnd,
      gapSize: this.#gapSize,
      buffer: [...this.#buffer],
    };
  }

  /**
   * Validates the internal gap buffer state.
   *
   * This method is intended for debugging and testing. It checks that the
   * gap indexes are internally consistent. If the buffer is valid, it returns
   * true. If the buffer is invalid, it throws an error.
   *
   * @throws {Error} If the internal gap state is invalid.
   * @returns {boolean} True if the internal state is valid.
   */
  debugValidate() {
    this.#assertInvariant();

    return true;
  }

  // ----------------------------
  // Private internals
  // ----------------------------

  /**
   * Returns the current size of the gap.
   *
   * @returns {number} The number of unused slots in the gap.
   */
  get #gapSize() {
    return this.#gapEnd - this.#gapStart;
  }

  /**
   * Clamps a position so that it lies inside the valid text range.
   *
   * Finite numeric positions are truncated to integers. Infinity is clamped
   * to the end of the buffer, and -Infinity is clamped to the beginning.
   *
   * @param {number} position - Position to clamp.
   * @throws {TypeError} If position is not a valid number.
   * @returns {number} A valid cursor/text position.
   */
  #clampPosition(position) {
    if (typeof position !== "number" || Number.isNaN(position)) {
      throw new TypeError("Position must be a valid number.");
    }

    if (position === Infinity) return this.length;
    if (position === -Infinity) return 0;

    return Math.max(0, Math.min(Math.trunc(position), this.length));
  }

  /**
   * Moves the gap one character to the left.
   *
   * This also moves the cursor one position to the left.
   *
   * Example:
   *
   *   Before:
   *     [ "A", "B", "C", null, null, "D", "E" ]
   *                 ^gapStart     ^gapEnd
   *
   *   After moving left:
   *     [ "A", "B", null, null, "C", "D", "E" ]
   *            ^gapStart     ^gapEnd
   *
   * The character immediately before the gap is moved to the end of the gap.
   *
   * @returns {void}
   */
  #moveGapLeft() {
    if (this.#gapStart <= 0) return;

    this.#gapStart--;
    this.#gapEnd--;

    this.#buffer[this.#gapEnd] = this.#buffer[this.#gapStart];
    this.#buffer[this.#gapStart] = null;
  }

  /**
   * Moves the gap one character to the right.
   *
   * This also moves the cursor one position to the right.
   *
   * Example (conceptual):
   *
   *   Before:
   *     [ "A", "B", null, null, "C", "D", "E" ]
   *                 ^gapStart     ^gapEnd
   *
   *   After moving right:
   *     [ "A", "B", "C", null, null, "D", "E" ]
   *                      ^gapStart     ^gapEnd
   *
   * The character immediately after the gap is moved to the start of the gap.
   *
   * @returns {void}
   */
  #moveGapRight() {
    if (this.#gapEnd >= this.#buffer.length) return;

    this.#buffer[this.#gapStart] = this.#buffer[this.#gapEnd];
    this.#buffer[this.#gapEnd] = null;

    this.#gapStart++;
    this.#gapEnd++;
  }

  /**
   * Grows the internal buffer when the gap is full.
   *
   * Existing text before and after the gap is preserved.
   * A larger gap is created between the prefix and suffix.
   *
   * Example (conceptual):
   *
   *   Before grow:
   *     [ "A", "B", "C", "D" ]
   *                ^gapStart
   *                ^gapEnd
   *
   *     gap size is 0
   *
   *   After grow:
   *     [ "A", "B", null, null, null, null, "C", "D" ]
   *                ^gapStart                 ^gapEnd
   *
   * Prefix remains on the left.
   * Suffix remains on the right.
   * The gap becomes larger in the middle.
   *
   * @returns {void}
   */
  #grow() {
    const oldSize = this.#buffer.length;
    const newSize = Math.max(1, oldSize * 2);

    const newBuffer = new Array(newSize).fill(null);

    for (let i = 0; i < this.#gapStart; i++) {
      newBuffer[i] = this.#buffer[i];
    }

    const suffixLength = oldSize - this.#gapEnd;
    const newGapEnd = newSize - suffixLength;

    for (let i = 0; i < suffixLength; i++) {
      newBuffer[newGapEnd + i] = this.#buffer[this.#gapEnd + i];
    }

    this.#buffer = newBuffer;
    this.#gapEnd = newGapEnd;
  }

  /**
   * Checks whether the internal gap state is valid.
   *
   * This method is mainly intended for debugging and testing.
   *
   * @throws {Error} If the internal gap state is invalid.
   * @returns {void}
   */
  #assertInvariant() {
    const valid =
      this.#gapStart >= 0 &&
      this.#gapStart <= this.#gapEnd &&
      this.#gapEnd <= this.#buffer.length;

    if (!valid) {
      throw new Error(
        [
          "Invalid gap state:",
          `gapStart=${this.#gapStart}`,
          `gapEnd=${this.#gapEnd}`,
          `capacity=${this.#buffer.length}`,
        ].join(" "),
      );
    }
  }
}
