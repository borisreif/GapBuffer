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

## API

### Core API
- length
- cursor
- capacity
- isEmpty
- toString()
- moveCursor(position)
- insert(text)
- backspace()
- deleteForward()
- deleteRange(start, end)
- clear()
- setText(text)
- charAt(index)

### Debug API

- debugSnapshot()
- debugValidate()

## Indexing model

This class uses JavaScript string offsets, meaning indexes are measured in
UTF-16 code units. This matches String.prototype.length,
String.prototype.slice(), textarea.selectionStart, and
textarea.selectionEnd.

Grapheme-aware cursor movement should be implemented at a higher editor/model
layer.

## License

MIT
