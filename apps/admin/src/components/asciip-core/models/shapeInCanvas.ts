import _ from "lodash";
import { ShapeObject } from "../store/diagramSlice";
import { getAbstractShapeRepresentation } from "./representation";
import { Coords, Shape } from "./shapes";
import { getResizePoints } from "./transformation";
import { Style, defaultStyle, resolveRectangleBorder } from "./style";
import {
  getRectangleLabelArea,
  getRectangleLabelCellValueMap,
} from "./rectangleText";

export type BoundingBox = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type BoundingBoxHandle = "TL" | "TR" | "BR" | "BL";

export function getBoundingBoxResizePoints(
  bb: BoundingBox
): { name: BoundingBoxHandle; coords: Coords }[] {
  return [
    { name: "TL", coords: { r: bb.top, c: bb.left } },
    { name: "TR", coords: { r: bb.top, c: bb.right } },
    { name: "BR", coords: { r: bb.bottom, c: bb.right } },
    { name: "BL", coords: { r: bb.bottom, c: bb.left } },
  ];
}

export function getBoundingBoxResizeHandleAtCoords(
  bb: BoundingBox,
  coords: Coords
): BoundingBoxHandle | null {
  const hit = getBoundingBoxResizePoints(bb).find((point) =>
    _.isEqual(point.coords, coords)
  );
  return hit?.name ?? null;
}

export function getBoundingBox(shape: Shape): BoundingBox {
  switch (shape.type) {
    case "RECTANGLE": {
      return {
        top: shape.tl.r,
        bottom: shape.br.r,
        left: shape.tl.c,
        right: shape.br.c,
      };
    }
    case "LINE": {
      return {
        top: Math.min(shape.start.r, shape.end.r),
        bottom: Math.max(shape.start.r, shape.end.r),
        left: Math.min(shape.start.c, shape.end.c),
        right: Math.max(shape.start.c, shape.end.c),
      };
    }
    case "MULTI_SEGMENT_LINE": {
      const points = [
        ...shape.segments.map((s) => s.start),
        ...shape.segments.map((s) => s.end),
      ];

      return {
        top: Math.min(...points.map((p) => p.r)),
        bottom: Math.max(...points.map((p) => p.r)),
        left: Math.min(...points.map((p) => p.c)),
        right: Math.max(...points.map((p) => p.c)),
      };
    }
    case "TEXT": {
      const lineCount = shape.lines.length;
      const longestLineLength = Math.max(
        ...shape.lines.map((line) => line.length)
      );

      return {
        top: shape.start.r,
        bottom: shape.start.r + lineCount,
        left: shape.start.c,
        right: shape.start.c + longestLineLength,
      };
    }
  }
}

export function getBoundingBoxOfAll(shapes: Shape[]): BoundingBox | null {
  if (shapes.length === 0) return null;

  const bb = getBoundingBox(shapes[0]);
  shapes.slice(1).forEach((shape) => {
    const sbb = getBoundingBox(shape);
    bb.top = Math.min(bb.top, sbb.top);
    bb.bottom = Math.max(bb.bottom, sbb.bottom);
    bb.left = Math.min(bb.left, sbb.left);
    bb.right = Math.max(bb.right, sbb.right);
  });
  return bb;
}

export function isShapeAtCoords(shape: Shape, { r, c }: Coords): boolean {
  const repr = getAbstractShapeRepresentation(shape);
  return r in repr && c in repr[r];
}

export function isShapeObjAtCoords(shapeObj: ShapeObject, coords: Coords): boolean {
  if (isShapeAtCoords(shapeObj.shape, coords)) {
    return true;
  }

  if (
    shapeObj.shape.type === "RECTANGLE" &&
    shapeObj.shape.labelLines &&
    shapeObj.shape.labelLines.some((line) => line.length > 0)
  ) {
    const style: Style = {
      ...defaultStyle(),
      ...(shapeObj.style ?? {}),
    };
    const labelRepr = getRectangleLabelCellValueMap(
      shapeObj.shape,
      shapeObj.shape.labelLines,
      {
        alignH: style.rectangleTextAlignH,
        alignV: style.rectangleTextAlignV,
        overflow: style.rectangleTextOverflow,
        padding: style.rectangleTextPadding,
      }
    );

    if (labelRepr[coords.r] && labelRepr[coords.r][coords.c]) {
      return true;
    }

    const area = getRectangleLabelArea(
      shapeObj.shape,
      style.rectangleTextPadding
    );
    if (
      coords.r >= area.top &&
      coords.r <= area.bottom &&
      coords.c >= area.left &&
      coords.c <= area.right
    ) {
      return true;
    }
  }

  if (
    shapeObj.shape.type === "RECTANGLE" &&
    shapeObj.style?.rectangleFill === "SOLID"
  ) {
    const style: Style = {
      ...defaultStyle(),
      ...(shapeObj.style ?? {}),
    };
    const borderMode = resolveRectangleBorder(style);
    const canInset =
      shapeObj.shape.br.r - shapeObj.shape.tl.r >= 2 &&
      shapeObj.shape.br.c - shapeObj.shape.tl.c >= 2;
    const insetCells =
      borderMode === "LINE"
        ? 1
        : borderMode === "NONE" && canInset
        ? 1
        : 0;

    return (
      coords.r >= shapeObj.shape.tl.r + insetCells &&
      coords.r <= shapeObj.shape.br.r - insetCells &&
      coords.c >= shapeObj.shape.tl.c + insetCells &&
      coords.c <= shapeObj.shape.br.c - insetCells
    );
  }

  return false;
}

export function hasResizePointAtCoords(shape: Shape, coords: Coords): boolean {
  const resizePoints = getResizePoints(shape);

  return resizePoints.some((rp) => _.isEqual(rp.coords, coords));
}

/**
 *
 * @returns the shapes whose edge touch the coordinate. If there are multiple shapes, they are returned in the same order than shapes[]
 */
export function getShapeObjsAtCoords(
  shapeObjs: ShapeObject[],
  coords: Coords
): ShapeObject[] {
  return shapeObjs.filter((obj) => isShapeObjAtCoords(obj, coords));
}

/**
 *
 * @returns a single shape whose visible footprint touches the coordinate.
 * If there are multiple shapes returns according to pos.
 */
export function getShapeObjAtCoords(
  shapes: ShapeObject[],
  coords: Coords,
  priorityId?: string // If multiple shapes ate at coords, return the shape that has id = priorityId, else return the last one
): ShapeObject | null {
  const touchedShapes = getShapeObjsAtCoords(shapes, coords);

  if (touchedShapes.length === 0) return null;

  if (priorityId) {
    const priorityShape = touchedShapes.find((s) => s.id === priorityId);
    return priorityShape ?? touchedShapes[touchedShapes.length - 1];
  } else return touchedShapes[touchedShapes.length - 1];
}

export function getShapeObjAtCoordsPreferSelected(
  shapes: ShapeObject[],
  coords: Coords,
  selectedShapeIds: string[]
): ShapeObject | null {
  const touchedShapes = getShapeObjsAtCoords(shapes, coords);
  if (touchedShapes.length === 0) return null;

  if (selectedShapeIds.length > 0) {
    const selectedIdSet = new Set(selectedShapeIds);
    const touchedSelectedShapes = touchedShapes.filter((shapeObj) =>
      selectedIdSet.has(shapeObj.id)
    );
    if (touchedSelectedShapes.length > 0) {
      return touchedSelectedShapes[touchedSelectedShapes.length - 1];
    }
  }

  return touchedShapes[touchedShapes.length - 1];
}

export function getShapeObjsInBox(
  shapes: ShapeObject[],
  tl: Coords,
  br: Coords
): ShapeObject[] {
  return shapes.filter((obj) => {
    const repr = getAbstractShapeRepresentation(obj.shape);
    for (const r_s in repr) {
      for (const c_s in repr[r_s]) {
        const [r, c] = [parseInt(r_s), parseInt(c_s)];
        if (r >= tl.r && r <= br.r && c >= tl.c && c <= br.c) return true;
      }
    }

    return false;
  });
}

export function areShapesTouching(shape1: Shape, shape2: Shape): boolean {
  const repr1 = getAbstractShapeRepresentation(shape1);
  const repr2 = getAbstractShapeRepresentation(shape2);

  for (const r in repr1) {
    if (r in repr2) {
      for (const c in repr1[r]) {
        if (c in repr2[r]) return true;
      }
    }
  }

  return false;
}

/**
 * Finds the index of the first shape in front of shapes[shapeIdx] and touching it.
 *
 * @param {Shape[]} shapes - An array of shapes.
 * @param {number} shapeIdx - The index of the shape to check against others.

* @returns {number|null} - The index of the first shape that is touching the specified shape.
 *                          Returns null if no such shape is found.
 * @throws {RangeError} - If shapeIdx is out of the bounds of the shapes array.
 */
export function getIndexOfShapeInFront(
  shapes: Shape[],
  shapeIdx: number
): number | null {
  if (shapeIdx < 0 || shapeIdx >= shapes.length)
    throw new RangeError(`shapeIdx must be within shapes's range`);

  for (let i = shapeIdx + 1; i < shapes.length; i++) {
    if (areShapesTouching(shapes[shapeIdx], shapes[i])) return i;
  }

  return null;
}

export function getIndexOfShapeInBack(
  shapes: Shape[],
  shapeIdx: number
): number | null {
  if (shapeIdx < 0 || shapeIdx >= shapes.length)
    throw new RangeError(`shapeIdx must be within shapes's range`);

  for (let i = shapeIdx - 1; i >= 0; i--) {
    if (areShapesTouching(shapes[shapeIdx], shapes[i])) return i;
  }

  return null;
}

/**
 * Moves a shape to the front of the array with the following rules :
 * - If there's a shape in front that's touching it, the shape is placed right above it
 * - If there's no shape in front that's touching it, the shape is placed in front of all shapes
 * - Text shapes are always placed in front of non-text shapes
 *
 * @param {ShapeObject[]} shapes - The array of shapes. This function will not modify but will return a new array
 * @param {string} shapeId - The ID of the shape to move to the front.
 * @returns {ShapeObject[]} A new array with the specified shape moved to the front.
 *
 */
export function moveShapeToFront(
  shapes: ShapeObject[],
  shapeId: string
): ShapeObject[] {
  const shapeArray = [...shapes];
  const selectedShapeIdx = shapeArray.findIndex((shape) => shape.id === shapeId);
  if (selectedShapeIdx < 0) return shapeArray;

  const [selectedShapeObj] = shapeArray.splice(selectedShapeIdx, 1);
  shapeArray.push(selectedShapeObj);
  return shapeArray;
}

/**
 * Moves a shape to the the back of the array with the following rules :
 * - If there's a shape behind that's touching it, the shape is placed right behind it
 * - If there's no shape behind that's touching it, the shape is placed behind all shapes
 * - Text shapes are always placed in front of non-text shapes
 *
 * @param {ShapeObject[]} shapes - The array of shapes. This function will not modify but will return a new array
 * @param {string} shapeId - The ID of the shape to move to the back.
 * @returns {ShapeObject[]} A new array with the specified shape moved to the back.
 *
 */
export function moveShapeToBack(
  shapes: ShapeObject[],
  shapeId: string
): ShapeObject[] {
  const shapeArray = [...shapes];
  const selectedShapeIdx = shapeArray.findIndex((shape) => shape.id === shapeId);
  if (selectedShapeIdx < 0) return shapeArray;

  const [selectedShapeObj] = shapeArray.splice(selectedShapeIdx, 1);
  shapeArray.unshift(selectedShapeObj);
  return shapeArray;
}
