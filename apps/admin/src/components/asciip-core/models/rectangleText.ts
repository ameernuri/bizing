import { Rectangle, TextShape } from "./shapes";
import {
  RECTANGLE_TEXT_ALIGN_H,
  RECTANGLE_TEXT_ALIGN_V,
  RECTANGLE_TEXT_OVERFLOW,
} from "./style";

type RectangleLabelArea = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
};

export type RectangleLabelLayoutOptions = {
  alignH: RECTANGLE_TEXT_ALIGN_H;
  alignV: RECTANGLE_TEXT_ALIGN_V;
  overflow: RECTANGLE_TEXT_OVERFLOW;
  padding: number;
};

export type RectangleEditorLayout = {
  area: RectangleLabelArea;
  contentRows: number;
  topOffsetRows: number;
};

type RectangleLabelLayoutLine = {
  row: number;
  col: number;
  text: string;
};

type CellValueMap = {
  [key: number]: { [key: number]: string };
};
const ASCII_ELLIPSIS = "...";

function normalizePadding(padding: number | undefined): number {
  if (padding == null || !Number.isFinite(padding)) return 0;
  return Math.max(0, Math.floor(padding));
}

export function getRectangleLabelArea(
  rectangle: Rectangle,
  padding?: number
): RectangleLabelArea {
  let top = rectangle.tl.r + 1;
  let bottom = rectangle.br.r - 1;
  let left = rectangle.tl.c + 1;
  let right = rectangle.br.c - 1;

  if (top > bottom) {
    top = rectangle.tl.r;
    bottom = rectangle.br.r;
  }
  if (left > right) {
    left = rectangle.tl.c;
    right = rectangle.br.c;
  }

  const baseWidth = Math.max(1, right - left + 1);
  const baseHeight = Math.max(1, bottom - top + 1);
  const maxInset = Math.max(
    0,
    Math.floor((Math.min(baseWidth, baseHeight) - 1) / 2)
  );
  const inset = Math.min(normalizePadding(padding), maxInset);

  top += inset;
  bottom -= inset;
  left += inset;
  right -= inset;

  return {
    top,
    bottom,
    left,
    right,
    width: Math.max(1, right - left + 1),
    height: Math.max(1, bottom - top + 1),
  };
}

function countChars(line: string): number {
  return Array.from(line).length;
}

function sliceChars(line: string, limit: number): string {
  return Array.from(line).slice(0, Math.max(0, limit)).join("");
}

function chunkLine(line: string, width: number): string[] {
  if (width <= 0) return [];
  const chars = Array.from(line);
  if (chars.length === 0) return [""];
  const chunks: string[] = [];
  for (let i = 0; i < chars.length; i += width) {
    chunks.push(chars.slice(i, i + width).join(""));
  }
  return chunks;
}

function wrapLineByWords(line: string, width: number): string[] {
  if (width <= 0) return [];
  if (line.length === 0) return [""];

  const tokens = line.match(/\S+\s*/g) ?? [line];
  const wrapped: string[] = [];
  let current = "";

  tokens.forEach((token) => {
    const tokenLen = countChars(token);
    const currentLen = countChars(current);
    if (currentLen === 0 && tokenLen <= width) {
      current = token;
      return;
    }
    if (currentLen + tokenLen <= width) {
      current += token;
      return;
    }
    if (currentLen > 0) {
      wrapped.push(current.trimEnd());
      current = "";
    }
    if (tokenLen <= width) {
      current = token.trimStart();
      return;
    }
    const tokenChunks = chunkLine(token.trim(), width);
    wrapped.push(...tokenChunks.slice(0, -1));
    current = tokenChunks[tokenChunks.length - 1] ?? "";
  });

  if (current.length > 0 || wrapped.length === 0) {
    wrapped.push(current.trimEnd());
  }
  return wrapped;
}

function expandLinesWithWrap(
  lines: string[],
  width: number
): string[] {
  // Horizontal overflow is always handled through wrapping.
  return lines.flatMap((line) => wrapLineByWords(line, width));
}

function getAlignedStartCol(
  area: RectangleLabelArea,
  lineLength: number,
  alignH: RECTANGLE_TEXT_ALIGN_H
): number {
  if (alignH === "LEFT") return area.left;
  if (alignH === "RIGHT") return Math.max(area.left, area.right - lineLength + 1);
  return Math.max(
    area.left,
    area.left + Math.floor((area.width - lineLength) / 2)
  );
}

function getAlignedStartRow(
  area: RectangleLabelArea,
  lineCount: number,
  alignV: RECTANGLE_TEXT_ALIGN_V
): number {
  if (alignV === "TOP") return area.top;
  if (alignV === "BOTTOM") return Math.max(area.top, area.bottom - lineCount + 1);
  return Math.max(
    area.top,
    area.top + Math.round((area.height - lineCount) / 2)
  );
}

export function layoutRectangleLabelLines(
  rectangle: Rectangle,
  labelLines: string[],
  opts: RectangleLabelLayoutOptions
): RectangleLabelLayoutLine[] {
  const area = getRectangleLabelArea(rectangle, opts.padding);
  const expandedLines = expandLinesWithWrap(labelLines, area.width);
  const fittedLines = expandedLines.map((line) => ({
    text: sliceChars(line, area.width),
    clipped: false,
  }));

  let visible = fittedLines.slice(0, area.height);
  if (
    opts.overflow === "TRUNCATE" &&
    fittedLines.length > area.height &&
    visible.length > 0
  ) {
    const lastIdx = visible.length - 1;
    const base = visible[lastIdx].text;
    const baseLen = countChars(base);
    const next =
      area.width <= ASCII_ELLIPSIS.length
        ? ".".repeat(area.width)
        : baseLen <= area.width - ASCII_ELLIPSIS.length
        ? `${base}${ASCII_ELLIPSIS}`
        : `${sliceChars(base, area.width - ASCII_ELLIPSIS.length)}${ASCII_ELLIPSIS}`;
    visible[lastIdx] = {
      text: sliceChars(next, area.width),
      clipped: true,
    };
  }

  const lineCount = Math.max(1, visible.length);
  const startRow = getAlignedStartRow(area, lineCount, opts.alignV);

  const positioned: RectangleLabelLayoutLine[] = [];
  visible.forEach((line, idx) => {
    const text = line.text;
    const lineLen = countChars(text);
    const row = startRow + idx;
    if (row < area.top || row > area.bottom) return;
    const col = getAlignedStartCol(area, lineLen, opts.alignH);
    positioned.push({
      row,
      col,
      text,
    });
  });

  return positioned;
}

export function getRectangleLabelCellValueMap(
  rectangle: Rectangle,
  labelLines: string[],
  opts: RectangleLabelLayoutOptions
): CellValueMap {
  const map: CellValueMap = {};
  const lines = layoutRectangleLabelLines(rectangle, labelLines, opts);
  lines.forEach(({ row, col, text }) => {
    if (!map[row]) {
      map[row] = {};
    }
    Array.from(text).forEach((char, idx) => {
      map[row][col + idx] = char;
    });
  });
  return map;
}

export function getRectangleLabelEditorCellValueMap(
  rectangle: Rectangle,
  labelLines: string[],
  padding?: number
): CellValueMap {
  const area = getRectangleLabelArea(rectangle, padding);
  const map: CellValueMap = {};
  let rowOffset = 0;
  labelLines.forEach((line) => {
    const wrappedLines = wrapLineByWords(line, area.width);
    wrappedLines.forEach((wrappedLine) => {
      const row = area.top + rowOffset;
      rowOffset++;
      if (!map[row]) {
        map[row] = {};
      }
      Array.from(wrappedLine).forEach((char, charIdx) => {
        map[row][area.left + charIdx] = char;
      });
    });
    if (wrappedLines.length === 0) {
      rowOffset++;
    }
  });
  return map;
}

export function getRectangleLabelEditorTextShape(
  rectangle: Rectangle,
  labelLines: string[],
  padding?: number
): TextShape {
  const area = getRectangleLabelArea(rectangle, padding);
  return {
    type: "TEXT",
    start: {
      r: area.top,
      c: area.left,
    },
    lines: labelLines,
  };
}

export function getRectangleLabelCursorCoords(
  value: string,
  selectionStart: number,
  rectangle: Rectangle,
  padding?: number
): { r: number; c: number } {
  const area = getRectangleLabelArea(rectangle, padding);
  const safeIndex = Math.max(0, Math.min(selectionStart, value.length));
  const prefix = value.slice(0, safeIndex);
  const logicalLines = prefix.split("\n");

  let visualRow = 0;
  let visualCol = 0;
  logicalLines.forEach((line, idx) => {
    const isLast = idx === logicalLines.length - 1;

    const wrapped = wrapLineByWords(line, area.width);
    if (isLast) {
      visualRow += Math.max(0, wrapped.length - 1);
      visualCol = countChars(wrapped[wrapped.length - 1] ?? "");
    } else {
      visualRow += Math.max(1, wrapped.length);
    }
  });

  return {
    r: area.top + Math.max(0, visualRow),
    c: area.left + Math.max(0, visualCol),
  };
}

export function getRectangleEditorVisualLineCount(
  lines: string[],
  rectangle: Rectangle,
  padding?: number
): number {
  const area = getRectangleLabelArea(rectangle, padding);
  const wrapped = lines.flatMap((line) => wrapLineByWords(line, area.width));
  return Math.max(1, wrapped.length);
}

export function getRectangleEditorLayout(
  lines: string[],
  rectangle: Rectangle,
  alignV: RECTANGLE_TEXT_ALIGN_V,
  padding?: number
): RectangleEditorLayout {
  const area = getRectangleLabelArea(rectangle, padding);
  const contentRows = getRectangleEditorVisualLineCount(lines, rectangle, padding);
  const visibleRows = Math.min(area.height, contentRows);
  const alignedStartRow =
    contentRows > area.height ? area.top : getAlignedStartRow(area, visibleRows, alignV);

  return {
    area,
    contentRows,
    topOffsetRows: Math.max(0, alignedStartRow - area.top),
  };
}

export function getRectangleLabelTextShape(
  rectangle: Rectangle,
  labelLines: string[],
  alignH: RECTANGLE_TEXT_ALIGN_H,
  alignV: RECTANGLE_TEXT_ALIGN_V,
  opts?: {
    minWidth?: number;
    minHeight?: number;
    padding?: number;
  }
): TextShape {
  const positioned = layoutRectangleLabelLines(rectangle, labelLines, {
    alignH,
    alignV,
    overflow: "HIDE",
    padding: opts?.padding ?? 0,
  });
  const minWidth = Math.max(0, opts?.minWidth ?? 0);
  const minHeight = Math.max(0, opts?.minHeight ?? 0);

  if (positioned.length === 0) {
    const area = getRectangleLabelArea(rectangle, opts?.padding ?? 0);
    return {
      type: "TEXT",
      start: {
        r: area.top,
        c: area.left,
      },
      lines: [],
    };
  }

  const startRow = positioned[0].row;
  const startCol = Math.min(...positioned.map((line) => line.col));
  const endCol = Math.max(
    ...positioned.map((line) => line.col + countChars(line.text) - 1)
  );
  const width = Math.max(minWidth, endCol - startCol + 1);
  const height = Math.max(minHeight, positioned.length);
  const lines: string[] = Array.from({ length: height }, () => " ".repeat(width));

  positioned.forEach((line, lineIdx) => {
    const rowIdx = line.row - startRow;
    if (rowIdx < 0 || rowIdx >= lines.length) return;
    const leading = Math.max(0, line.col - startCol);
    const content = `${" ".repeat(leading)}${line.text}`;
    lines[rowIdx] = `${content}${" ".repeat(Math.max(0, width - countChars(content)))}`;
  });

  return {
    type: "TEXT",
    start: {
      r: startRow,
      c: startCol,
    },
    lines,
  };
}
