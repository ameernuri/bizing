import _ from "lodash";
import { Coords, Shape } from "../../models/shapes";
import {
  CellValueMap,
  Char,
  getAbstractShapeRepresentation,
} from "../../models/representation";
import { ResizePoint, getResizePoints } from "../../models/transformation";
import {
  Style,
  StyleMode,
  getCharRepr,
  resolveRectangleBorder,
} from "../../models/style";
import { ShapeObject } from "../../store/diagramSlice";
import {
  BoundingBox,
  getBoundingBoxResizePoints,
} from "../../models/shapeInCanvas";
import { getRectangleLabelCellValueMap } from "../../models/rectangleText";

export const FONT_SIZE = 16;
export const FONT_WIDTH = 9.603; // see https://stackoverflow.com/a/56379770/471461
export const CELL_WIDTH = FONT_WIDTH;
export const CELL_HEIGHT = FONT_SIZE * 1.1;

export const FONT_FAMILY = "monospace";
export const FONT = `${FONT_SIZE}px ${FONT_FAMILY}`;
const BORDERLESS_SOLID_EDGE_INSET_PX = 0;

function setBackground(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

function drawVerticalGridLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  height: number,
  color: string
) {
  ctx.beginPath();
  ctx.moveTo(x, 0); // Starting point
  ctx.lineTo(x, height); // Ending point
  ctx.strokeStyle = color; // Line color
  ctx.stroke(); // Draw the line
}

function drawHorizontalGridLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  color: string
) {
  ctx.beginPath();
  ctx.moveTo(0, y); // Starting point
  ctx.lineTo(width, y); // Ending point
  ctx.strokeStyle = color; // Line color
  ctx.stroke(); // Draw the line
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  rowCount: number,
  colCount: number,
  color: string
) {
  drawVerticalGridLine(ctx, 0, canvasHeight, color);
  _.forEach(_.range(0, colCount), (col) => {
    drawVerticalGridLine(ctx, col * CELL_WIDTH, canvasHeight, color);
  });

  drawHorizontalGridLine(ctx, 0, canvasWidth, color);
  _.forEach(_.range(0, rowCount), (row) => {
    drawHorizontalGridLine(ctx, row * CELL_HEIGHT, canvasWidth, color);
  });
}

function drawSelectBox(
  ctx: CanvasRenderingContext2D,
  boxTL: Coords,
  boxBR: Coords,
  color: string
) {
  ctx.strokeStyle = color;
  ctx.setLineDash([2, 2]);
  ctx.lineWidth = 1;

  // Draw the unfilled rectangle
  ctx.strokeRect(
    boxTL.c * CELL_WIDTH,
    boxTL.r * CELL_HEIGHT,
    (boxBR.c - boxTL.c) * CELL_WIDTH,
    (boxBR.r - boxTL.r) * CELL_HEIGHT
  );
}

function drawBoundingBox(
  ctx: CanvasRenderingContext2D,
  bounds: BoundingBox,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  ctx.strokeRect(
    bounds.left * CELL_WIDTH,
    bounds.top * CELL_HEIGHT,
    (bounds.right - bounds.left) * CELL_WIDTH,
    (bounds.bottom - bounds.top) * CELL_HEIGHT
  );
  ctx.restore();
}

function drawBoundingBoxResizePoints(
  ctx: CanvasRenderingContext2D,
  bounds: BoundingBox,
  color: string
) {
  getBoundingBoxResizePoints(bounds).forEach(({ coords: { r, c } }) => {
    ctx.beginPath();
    ctx.arc(
      c * CELL_WIDTH + 0.5 * CELL_WIDTH,
      r * CELL_HEIGHT + 0.5 * CELL_HEIGHT,
      0.5 * CELL_HEIGHT,
      0,
      Math.PI * 2
    );
    ctx.save();
    ctx.globalAlpha = 0.66;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
    ctx.closePath();
  });
}

function drawHoveredCell(ctx: CanvasRenderingContext2D, cell: Coords) {
  ctx.fillStyle = "LightBlue";
  ctx.fillRect(
    cell.c * CELL_WIDTH,
    cell.r * CELL_HEIGHT,
    CELL_WIDTH,
    CELL_HEIGHT
  );
}

function drawBlockCursor(
  ctx: CanvasRenderingContext2D,
  cell: Coords,
  _color: string
) {
  const x = Math.round(cell.c * CELL_WIDTH);
  const y = Math.round(cell.r * CELL_HEIGHT);
  const w = Math.max(1, Math.ceil(CELL_WIDTH));
  const h = Math.max(1, Math.ceil(CELL_HEIGHT));
  ctx.save();
  // Terminal-style block cursor with fixed high-contrast colors.
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
  ctx.restore();
}

export type DrawOptions = {
  color: string;
  drawResizePoints: boolean;
  renderRectangleLabelAsEditor?: boolean;
};

type CellGraphicElemMap = {
  [key: number]: {
    [key: number]: {
      char?: string;
      charColor?: string;
      fillColor?: string;
      fillInset?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
      };
    };
  };
};

function getContrastTextColor(backgroundColor: string): string {
  const hex = backgroundColor.trim();
  const normalized =
    hex.startsWith("#") && hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;

  const match = normalized.match(/^#([0-9a-fA-F]{6})$/);
  if (!match) return "#f9fafb";

  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.6 ? "#111827" : "#f9fafb";
}

function getGraphicCanvasRepresentation(
  shapes: ShapeObject[] | Shape[],
  styleMode: StyleMode,
  globalStyle: Style,
  drawOpts: DrawOptions[]
): CellGraphicElemMap {
  function isShapeObject(shape: ShapeObject | Shape): shape is ShapeObject {
    return "id" in shape;
  }

  let graphicCanvasRepr: CellGraphicElemMap = {};

  shapes.forEach((s, idx) => {
    const shape = isShapeObject(s) ? s.shape : s;
    const shapeStyle = isShapeObject(s) ? s.style : undefined;
    const color = drawOpts[idx].color;
    const mergedStyle: Style = {
      ...globalStyle,
      ...(shapeStyle ?? {}),
    };
    const rectangleBorderMode =
      shape.type === "RECTANGLE" ? resolveRectangleBorder(mergedStyle) : "LINE";

    const abstractShapeRepr: CellValueMap = getAbstractShapeRepresentation(shape);

    const graphicShapeRepr: CellGraphicElemMap = {};
    for (const row in abstractShapeRepr) {
      graphicShapeRepr[row] = {};
      for (const col in abstractShapeRepr[row]) {
        const abstractChar = abstractShapeRepr[row][col];
        const isRectBorderChar =
          shape.type === "RECTANGLE" && isRectangleBorderChar(abstractChar);

        if (isRectBorderChar && rectangleBorderMode === "NONE") {
          continue;
        }

        if (isRectBorderChar && rectangleBorderMode === "BLOCK") {
          graphicShapeRepr[row][col] = {
            fillColor: color,
            fillInset: { top: 0, right: 0, bottom: 0, left: 0 },
          };
          continue;
        }

        const styledChar = getCharRepr(abstractChar, {
          styleMode,
          globalStyle,
          shapeStyle,
        });
        const borderColor = color;
        graphicShapeRepr[row][col] = {
          char: styledChar,
          charColor: borderColor,
        };
      }
    }
    if (shape.type === "RECTANGLE" && mergedStyle.rectangleFill === "SOLID") {
      const canInset =
        shape.br.r - shape.tl.r >= 2 && shape.br.c - shape.tl.c >= 2;
      const insetCells =
        rectangleBorderMode === "LINE"
          ? 1
          : rectangleBorderMode === "NONE" && canInset
          ? 1
          : 0;
      const fromR = shape.tl.r + insetCells;
      const toR = shape.br.r - insetCells;
      const fromC = shape.tl.c + insetCells;
      const toC = shape.br.c - insetCells;

      for (let r = fromR; r <= toR; r++) {
        if (!graphicShapeRepr[r]) {
          graphicShapeRepr[r] = {};
        }
        for (let c = fromC; c <= toC; c++) {
          if (!graphicShapeRepr[r][c]) {
            graphicShapeRepr[r][c] = {};
          }
          graphicShapeRepr[r][c].fillColor = color;
          graphicShapeRepr[r][c].fillInset =
            rectangleBorderMode === "NONE"
              ? {
                  top:
                    r === fromR ? BORDERLESS_SOLID_EDGE_INSET_PX : 0,
                  right:
                    c === toC ? BORDERLESS_SOLID_EDGE_INSET_PX : 0,
                  bottom:
                    r === toR ? BORDERLESS_SOLID_EDGE_INSET_PX : 0,
                  left:
                    c === fromC ? BORDERLESS_SOLID_EDGE_INSET_PX : 0,
                }
              : { top: 0, right: 0, bottom: 0, left: 0 };
        }
      }
    }

    if (
      shape.type === "RECTANGLE" &&
      shape.labelLines &&
      shape.labelLines.some((line) => line.length > 0)
    ) {
      if (!drawOpts[idx].renderRectangleLabelAsEditor) {
        const labelRepr: CellValueMap = getRectangleLabelCellValueMap(
          shape,
          shape.labelLines,
          {
            alignH: mergedStyle.rectangleTextAlignH,
            alignV: mergedStyle.rectangleTextAlignV,
            overflow: mergedStyle.rectangleTextOverflow,
            padding: mergedStyle.rectangleTextPadding,
          }
        );
        for (const row in labelRepr) {
          if (!graphicShapeRepr[row]) {
            graphicShapeRepr[row] = {};
          }
          for (const col in labelRepr[row]) {
            const labelChar = labelRepr[row][col];
            if (!graphicShapeRepr[row][col]) {
              graphicShapeRepr[row][col] = {};
            }
            graphicShapeRepr[row][col].char = labelChar;
            graphicShapeRepr[row][col].charColor =
              mergedStyle.rectangleFill === "SOLID" && /\S/u.test(labelChar)
                ? getContrastTextColor(color)
                : color;
          }
        }
      }
    }

    for (const row in graphicShapeRepr) {
      if (!graphicCanvasRepr[row]) {
        graphicCanvasRepr[row] = {};
      }
      for (const col in graphicShapeRepr[row]) {
        const nextCell = graphicShapeRepr[row][col];
        const prevCell = graphicCanvasRepr[row][col] ?? {};
        const mergedCell = { ...prevCell };

        if (nextCell.fillColor) {
          mergedCell.fillColor = nextCell.fillColor;
          mergedCell.fillInset = nextCell.fillInset ?? {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          };
        }
        if (nextCell.char && nextCell.char.length > 0) {
          mergedCell.char = nextCell.char;
          if (/\S/u.test(nextCell.char) && mergedCell.fillColor) {
            mergedCell.charColor = getContrastTextColor(mergedCell.fillColor);
          } else {
            mergedCell.charColor = nextCell.charColor;
          }
        }

        graphicCanvasRepr[row][col] = mergedCell;
      }
    }
  });

  return graphicCanvasRepr;
}

function isRectangleBorderChar(char: Char): boolean {
  return (
    char === "LINE_HORIZONTAL" ||
    char === "LINE_VERTICAL" ||
    char === "CORNER_TR" ||
    char === "CORNER_TL" ||
    char === "CORNER_BR" ||
    char === "CORNER_BL"
  );
}

function drawShapes(
  ctx: CanvasRenderingContext2D,
  shapes: ShapeObject[] | Shape[],
  styleMode: StyleMode,
  globalStyle: Style,
  opts: DrawOptions[]
): void {
  if (shapes.length === 0) return;

  const repr: CellGraphicElemMap = getGraphicCanvasRepresentation(
    shapes,
    styleMode,
    globalStyle,
    opts
  );

  ctx.font = FONT;
  ctx.textBaseline = "middle"; // To align the text in the middle of the cell (the default value "alphabetic" does not align the text in the middle)
  for (const row in repr) {
    for (const col in repr[row]) {
      const { char, charColor, fillColor } = repr[row][col];
      const fillInset = repr[row][col].fillInset ?? {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      };
      const x = parseInt(col) * CELL_WIDTH;
      const y = parseInt(row) * CELL_HEIGHT;
      if (fillColor) {
        ctx.fillStyle = fillColor;
        const w = Math.max(0, CELL_WIDTH - fillInset.left - fillInset.right);
        const h = Math.max(0, CELL_HEIGHT - fillInset.top - fillInset.bottom);
        if (w > 0 && h > 0) {
          ctx.fillRect(x + fillInset.left, y + fillInset.top, w, h);
        }
      }
      if (char && char.length > 0) {
        ctx.fillStyle = charColor ?? "#ffffff";
        ctx.fillText(char, x, y + 0.5 * CELL_HEIGHT);
      }
    }
  }

  // Draw resize points
  function isShapeObject(shape: ShapeObject | Shape): shape is ShapeObject {
    return "id" in shape;
  }
  shapes.forEach((s, idx) => {
    if (opts[idx].drawResizePoints) {
      const resizePoints: ResizePoint[] = getResizePoints(
        isShapeObject(s) ? s.shape : s
      );
      resizePoints.forEach(({ coords: { r, c } }) => {
        ctx.beginPath(); // Start a new path
        ctx.arc(
          c * CELL_WIDTH + 0.5 * CELL_WIDTH,
          r * CELL_HEIGHT + 0.5 * CELL_HEIGHT,
          0.5 * CELL_HEIGHT,
          0,
          Math.PI * 2
        ); // Create a circular path
        ctx.save();
        ctx.globalAlpha = 0.66;
        ctx.fillStyle = opts[idx].color; // Set the fill color
        ctx.fill(); // Fill the path with the color
        ctx.restore();
        ctx.closePath(); // Close the path
      });
    }
  });
}

export const canvasDraw = {
  setBackground,
  drawGrid,
  drawHoveredCell,
  drawBlockCursor,
  drawShapes,
  drawSelectBox,
  drawBoundingBox,
  drawBoundingBoxResizePoints,
};
