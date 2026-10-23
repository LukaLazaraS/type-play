// A process's output as lines, without ever holding an unbounded line in memory: a line longer than
// MAX_LINE is cut (the rest of it dropped, "…[cut]" appended), and after MAX_TOTAL bytes the rest of
// the stream is read and ignored (the process goes on; its output is just no longer kept). An
// agent's shell can print a newline-free gigabyte; readline would buffer it all.
import type { Readable } from "node:stream";
import { StringDecoder } from "node:string_decoder";

export const MAX_LINE = 64 << 10;
export const MAX_TOTAL = 50 << 20;

export function readLines(stream: Readable, onLine: (line: string) => void): void {
  const dec = new StringDecoder("utf8");
  let buf = "";
  let dropping = false; // inside a line that was already cut
  let total = 0;
  const emit = (line: string) => onLine(line.endsWith("\r") ? line.slice(0, -1) : line);
  stream.on("data", (chunk: Buffer) => {
    total += chunk.length;
    if (total > MAX_TOTAL) return;
    let text = dec.write(chunk);
    for (;;) {
      const i = text.indexOf("\n");
      if (i < 0) break;
      const head = text.slice(0, i);
      text = text.slice(i + 1);
      if (dropping) dropping = false;
      else {
        emit(buf + head);
        buf = "";
      }
    }
    if (dropping || !text) return;
    buf += text;
    if (buf.length > MAX_LINE) {
      emit(buf.slice(0, MAX_LINE) + "…[cut]");
      buf = "";
      dropping = true;
    }
  });
  stream.on("end", () => {
    buf += dec.end();
    if (buf && !dropping && total <= MAX_TOTAL) emit(buf);
  });
}
