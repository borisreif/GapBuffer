import test from "node:test";
import assert from "node:assert/strict";

import GapBuffer from "../GapBuffer.js";

test("creates an empty buffer", () => {
  const buffer = new GapBuffer();

  assert.equal(buffer.toString(), "");
  assert.equal(buffer.length, 0);
  assert.equal(buffer.cursor, 0);
  assert.equal(buffer.isEmpty, true);
  assert.equal(buffer.debugValidate(), true);
});

test("inserts text at the cursor", () => {
  const buffer = new GapBuffer();

  buffer.insert("hello");

  assert.equal(buffer.toString(), "hello");
  assert.equal(buffer.length, 5);
  assert.equal(buffer.cursor, 5);
  assert.equal(buffer.isEmpty, false);
});

test("moves the cursor and inserts text in the middle", () => {
  const buffer = new GapBuffer();

  buffer.insert("hello");
  buffer.moveCursor(2);
  buffer.insert("X");

  assert.equal(buffer.toString(), "heXllo");
  assert.equal(buffer.cursor, 3);
});

test("backspace deletes the character before the cursor", () => {
  const buffer = new GapBuffer();

  buffer.insert("hello");
  buffer.moveCursor(3);

  const deleted = buffer.backspace();

  assert.equal(deleted, "l");
  assert.equal(buffer.toString(), "helo");
  assert.equal(buffer.cursor, 2);
});

test("backspace returns null at the beginning", () => {
  const buffer = new GapBuffer();

  assert.equal(buffer.backspace(), null);
  assert.equal(buffer.toString(), "");
});

test("deleteForward deletes the character after the cursor", () => {
  const buffer = new GapBuffer();

  buffer.insert("hello");
  buffer.moveCursor(1);

  const deleted = buffer.deleteForward();

  assert.equal(deleted, "e");
  assert.equal(buffer.toString(), "hllo");
  assert.equal(buffer.cursor, 1);
});

test("deleteForward returns null at the end", () => {
  const buffer = new GapBuffer();

  buffer.insert("hello");

  assert.equal(buffer.deleteForward(), null);
  assert.equal(buffer.toString(), "hello");
});

test("deleteRange deletes a half-open range", () => {
  const buffer = new GapBuffer();

  buffer.insert("hello world");

  const deletedCount = buffer.deleteRange(5, 11);

  assert.equal(deletedCount, 6);
  assert.equal(buffer.toString(), "hello");
  assert.equal(buffer.cursor, 5);
});

test("deleteRange clamps numeric positions", () => {
  const buffer = new GapBuffer();

  buffer.insert("hello");

  const deletedCount = buffer.deleteRange(-100, 100);

  assert.equal(deletedCount, 5);
  assert.equal(buffer.toString(), "");
  assert.equal(buffer.cursor, 0);
});

test("clear removes all text but preserves capacity", () => {
  const buffer = new GapBuffer(32);

  buffer.insert("hello");

  const capacityBefore = buffer.capacity;

  buffer.clear();

  assert.equal(buffer.toString(), "");
  assert.equal(buffer.length, 0);
  assert.equal(buffer.cursor, 0);
  assert.equal(buffer.isEmpty, true);
  assert.equal(buffer.capacity, capacityBefore);
});

test("setText replaces the entire buffer contents", () => {
  const buffer = new GapBuffer();

  buffer.insert("old text");
  buffer.setText("new text");

  assert.equal(buffer.toString(), "new text");
  assert.equal(buffer.length, 8);
  assert.equal(buffer.cursor, 8);
});

test("charAt returns characters by logical index", () => {
  const buffer = new GapBuffer();

  buffer.insert("hello");

  assert.equal(buffer.charAt(0), "h");
  assert.equal(buffer.charAt(1), "e");
  assert.equal(buffer.charAt(4), "o");
});

test("charAt clamps out-of-range positions", () => {
  const buffer = new GapBuffer();

  buffer.insert("hello");

  assert.equal(buffer.charAt(-10), "h");
  assert.equal(buffer.charAt(Infinity), "");
});

test("buffer grows when the gap becomes full", () => {
  const buffer = new GapBuffer(2);

  buffer.insert("hello");

  assert.equal(buffer.toString(), "hello");
  assert.equal(buffer.length, 5);
  assert.ok(buffer.capacity >= 5);
  assert.equal(buffer.debugValidate(), true);
});

test("insert rejects non-string values", () => {
  const buffer = new GapBuffer();

  assert.throws(() => {
    buffer.insert(123);
  }, TypeError);
});

test("setText rejects non-string values", () => {
  const buffer = new GapBuffer();

  assert.throws(() => {
    buffer.setText(null);
  }, TypeError);
});

test("moveCursor rejects invalid positions", () => {
  const buffer = new GapBuffer();

  assert.throws(() => {
    buffer.moveCursor(NaN);
  }, TypeError);

  assert.throws(() => {
    buffer.moveCursor("2");
  }, TypeError);
});

test("deleteRange rejects invalid positions", () => {
  const buffer = new GapBuffer();

  assert.throws(() => {
    buffer.deleteRange(0, NaN);
  }, TypeError);

  assert.throws(() => {
    buffer.deleteRange("0", 2);
  }, TypeError);
});

test("uses JavaScript UTF-16 string offsets", () => {
  const buffer = new GapBuffer();

  buffer.insert("A😊B");

  assert.equal(buffer.toString(), "A😊B");
  assert.equal(buffer.length, "A😊B".length);
  assert.equal(buffer.length, 4);
});