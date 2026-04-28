# GapBuffer

A small mutable gap buffer implementation in modern JavaScript.

## Features

- Efficient insertion near the cursor
- Cursor movement
- Backspace and forward delete
- Range deletion
- Debug snapshot support
- UTF-16 indexing model compatible with JavaScript strings and browser text offsets

## Usage

```js
import GapBuffer from "./GapBuffer.js";

const buffer = new GapBuffer();

buffer.insert("hello");
buffer.moveCursor(2);
buffer.insert("X");

console.log(buffer.toString()); // "heXllo"
console.log(buffer.cursor);     // 3
console.log(buffer.length);     // 6
