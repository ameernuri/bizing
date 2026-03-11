import { CanvasSize } from "../store/diagramSlice";
import { Coords, TextShape } from "./shapes";

export function getStringFromShape(textShape: TextShape): string {
  return textShape.lines.join("\n");
}

export function getLines(text: string): string[] {
  return text.split("\n");
}

export function capText(
  start: Coords,
  lines: string[],
  canvasSize: CanvasSize
): string[] {
  return lines
    .filter((_line, idx) => start.r + idx < canvasSize.rows)
    .map((line) => line.slice(0, canvasSize.cols - start.c));
}

type ListContinuationMatch =
  | {
      kind: "BULLET";
      indent: string;
      marker: "-" | "*";
      spacing: string;
    }
  | {
      kind: "NUMBERED";
      indent: string;
      delimiter: "." | ")";
      spacing: string;
      number: number;
    };

const BULLET_LIST_RE = /^(\s*)([-*])(\s+)/;
const NUMBERED_LIST_RE = /^(\s*)(\d+)([.)])(\s+)/;

function matchListPrefix(line: string): ListContinuationMatch | null {
  const bulletMatch = line.match(BULLET_LIST_RE);
  if (bulletMatch) {
    return {
      kind: "BULLET",
      indent: bulletMatch[1] ?? "",
      marker: (bulletMatch[2] as "-" | "*") ?? "-",
      spacing: bulletMatch[3] ?? " ",
    };
  }

  const numberedMatch = line.match(NUMBERED_LIST_RE);
  if (numberedMatch) {
    return {
      kind: "NUMBERED",
      indent: numberedMatch[1] ?? "",
      number: parseInt(numberedMatch[2] ?? "1", 10),
      delimiter: (numberedMatch[3] as "." | ")") ?? ".",
      spacing: numberedMatch[4] ?? " ",
    };
  }

  return null;
}

function renumberFollowingNumberedLines(
  text: string,
  fromLineIdx: number,
  {
    indent,
    delimiter,
    startNumber,
  }: {
    indent: string;
    delimiter: "." | ")";
    startNumber: number;
  }
): string {
  const lines = text.split("\n");
  let nextNumber = startNumber;

  for (let i = fromLineIdx; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*)(\d+)([.)])(\s+)(.*)$/);
    if (!match) break;
    if ((match[1] ?? "") !== indent || (match[3] ?? ".") !== delimiter) break;

    const spacing = match[4] ?? " ";
    const content = match[5] ?? "";
    lines[i] = `${indent}${nextNumber}${delimiter}${spacing}${content}`;
    nextNumber++;
  }

  return lines.join("\n");
}

export function applyListContinuationOnEnter(
  value: string,
  selectionStart: number,
  selectionEnd: number
): { value: string; nextSelectionStart: number; handled: boolean } {
  const safeSelectionStart = Math.max(0, Math.min(selectionStart, value.length));
  const safeSelectionEnd = Math.max(
    safeSelectionStart,
    Math.min(selectionEnd, value.length)
  );

  const lineStart = value.lastIndexOf("\n", Math.max(0, safeSelectionStart - 1)) + 1;
  const lineEndIdx = value.indexOf("\n", safeSelectionEnd);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const currentLine = value.slice(lineStart, lineEnd);

  const listMatch = matchListPrefix(currentLine);
  if (!listMatch) {
    return {
      value,
      nextSelectionStart: safeSelectionStart,
      handled: false,
    };
  }

  const before = value.slice(0, safeSelectionStart);
  const after = value.slice(safeSelectionEnd);

  const continuationPrefix =
    listMatch.kind === "BULLET"
      ? `${listMatch.indent}${listMatch.marker}${listMatch.spacing}`
      : `${listMatch.indent}${listMatch.number + 1}${listMatch.delimiter}${listMatch.spacing}`;

  let nextValue = `${before}\n${continuationPrefix}${after}`;
  const nextSelectionStart = before.length + 1 + continuationPrefix.length;

  if (listMatch.kind === "NUMBERED") {
    const insertedLineIdx = before.split("\n").length;
    nextValue = renumberFollowingNumberedLines(nextValue, insertedLineIdx + 1, {
      indent: listMatch.indent,
      delimiter: listMatch.delimiter,
      startNumber: listMatch.number + 2,
    });
  }

  return {
    value: nextValue,
    nextSelectionStart,
    handled: true,
  };
}
