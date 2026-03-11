import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import {
  Coords,
  MultiSegment,
  Shape,
  TextShape,
  isShapeLegal,
  normalizeMultiSegmentLine,
  normalizeTlBr,
} from "../models/shapes";
import {
  BoundingBox,
  BoundingBoxHandle,
  getBoundingBoxResizeHandleAtCoords,
  getShapeObjAtCoords,
  getShapeObjAtCoordsPreferSelected,
  getBoundingBoxOfAll,
  getShapeObjsInBox,
  hasResizePointAtCoords,
  isShapeObjAtCoords,
  moveShapeToBack,
  moveShapeToFront,
} from "../models/shapeInCanvas";
import _ from "lodash";
import { v4 as uuidv4 } from "uuid";
import { resize, translateAll } from "../models/transformation";
import { createLineSegment, createZeroWidthSegment } from "../models/create";
import { capText, getLines } from "../models/text";
import { Style, StyleMode, defaultStyle } from "../models/style";

const DEFAULT_CANVAS_SIZE: CanvasSize = {
  rows: 75,
  cols: 250,
};

export type Tool =
  | "SELECT"
  | "RECTANGLE"
  | "LINE"
  | "MULTI_SEGMENT_LINE"
  | "TEXT";

export type ShapeObject = { id: string; shape: Shape; style?: Partial<Style> };
export type CanvasSize = {
  rows: number;
  cols: number;
};

export type ActionMode =
  | { M: "BEFORE_CREATING" }
  | {
      M: "CREATE";
      start: Coords;
      curr: Coords;
      checkpoint: Shape | null;
      shape: Shape;
    }
  | { M: "SELECT"; shapeIds: string[] }
  | {
      M: "SELECT_DRAG";
      start: Coords;
      curr: Coords;
      shapeIds: string[];
      baseShapeIds: string[];
      invert: boolean;
    }
  | {
      M: "MOVE";
      start: Coords;
      shapeIds: string[];
      startShapes: Shape[];
      duplicated: boolean;
    }
  | { M: "RESIZE"; resizePoint: Coords; shapeId: string; startShape: Shape }
  | {
      M: "RESIZE_MULTI";
      shapeIds: string[];
      startShapes: Shape[];
      startBounds: BoundingBox;
      handle: BoundingBoxHandle;
      anchor: Coords;
    }
  | { M: "TEXT_EDIT"; shapeId: string; startShape: TextShape }
  | { M: "RECTANGLE_TEXT_EDIT"; shapeId: string; startLines: string[] };

export type DiagramData = {
  canvasSize: CanvasSize;
  shapes: ShapeObject[];
  styleMode: StyleMode;
  globalStyle: Style;
};

export type DiagramState = DiagramData & {
  /* Edition & Navigation State of the canvas */
  currentHoveredCell: Coords | null;

  selectedTool: Tool;
  mode: ActionMode;

  history: DiagramData[];
  historyIdx: number;
  clipboard: ShapeObject[];
  textCursorCell: Coords | null;

  /* Other state of the app */
  exportInProgress: boolean;
};

export const initDiagramData = (opt?: Partial<DiagramData>): DiagramData => {
  const mergedGlobalStyle: Style = {
    ...defaultStyle(),
    ...(opt?.globalStyle ?? {}),
  };
  const { globalStyle: _globalStyleIgnored, ...restOpt } = opt ?? {};

  return {
    canvasSize: { ...DEFAULT_CANVAS_SIZE },
    shapes: [],
    styleMode: "UNICODE",
    globalStyle: mergedGlobalStyle,

    ...restOpt,
  };
};

export const initDiagramState = (opt?: Partial<DiagramData>): DiagramState => {
  const diagramData = initDiagramData(opt);

  return {
    ...diagramData,

    currentHoveredCell: null,

    selectedTool: "RECTANGLE",
    mode: { M: "BEFORE_CREATING" },

    history: [_.cloneDeep(diagramData)],
    historyIdx: 0,
    clipboard: [],
    textCursorCell: null,

    exportInProgress: false,
  };
};

export const diagramSlice = createSlice({
  name: "diagram",
  initialState: initDiagramState(),
  reducers: {
    loadDiagram: (state, action: PayloadAction<DiagramData>) => {
      return initDiagramState(action.payload);
    },

    //#region Canvas actions
    expandCanvas: (state) => {
      const { rows, cols } = state.canvasSize;
      state.canvasSize = {
        rows: rows + 40,
        cols: cols + 125,
      };
    },
    shrinkCanvasToFit: (state) => {
      if (state.shapes.length === 0) {
        state.canvasSize = {
          rows: Math.min(state.canvasSize.rows, DEFAULT_CANVAS_SIZE.rows),
          cols: Math.min(state.canvasSize.cols, DEFAULT_CANVAS_SIZE.cols),
        };
      } else {
        const bb = getBoundingBoxOfAll(state.shapes.map((so) => so.shape))!;
        state.canvasSize = {
          rows: bb.bottom + 1,
          cols: bb.right + 1,
        };
      }
    },
    setTool: (state, action: PayloadAction<Tool>) => {
      if (state.selectedTool !== action.payload) {
        if (action.payload === "SELECT") {
          state.mode = { M: "SELECT", shapeIds: [] };
        } else {
          state.mode = { M: "BEFORE_CREATING" };
        }
      }
      if (action.payload !== "TEXT") {
        state.textCursorCell = null;
      }

      state.selectedTool = action.payload;
    },
    setTextCursor: (state, action: PayloadAction<Coords | null>) => {
      state.textCursorCell = action.payload;
    },
    //#endregion
    //#region Mouse actions
    onCellDoubleClick: (state, action: PayloadAction<Coords>) => {
      if (
        state.mode.M === "SELECT" ||
        state.mode.M === "TEXT_EDIT" ||
        state.mode.M === "RECTANGLE_TEXT_EDIT"
      ) {
        if (state.mode.M === "TEXT_EDIT") {
          completeTextEditing(state, { goToSelect: false });
        } else if (state.mode.M === "RECTANGLE_TEXT_EDIT") {
          completeRectangleTextEditing(state, { goToSelect: false });
        }

        const shapeObj = getShapeObjAtCoords(state.shapes, action.payload);
        if (shapeObj?.shape.type === "TEXT") {
          state.mode = {
            M: "TEXT_EDIT",
            shapeId: shapeObj.id,
            startShape: { ...shapeObj.shape },
          };
          state.textCursorCell = null;
          return;
        }
        if (shapeObj?.shape.type === "RECTANGLE") {
          state.mode = {
            M: "RECTANGLE_TEXT_EDIT",
            shapeId: shapeObj.id,
            startLines: _.cloneDeep(shapeObj.shape.labelLines ?? []),
          };
          state.textCursorCell = null;
        }
      } else if (
        state.mode.M === "CREATE" &&
        state.mode.shape.type === "MULTI_SEGMENT_LINE"
      ) {
        // Complete creating multi-segment line
        const createMode = state.mode;

        const newShape: MultiSegment | null = isShapeLegal(
          createMode.shape as MultiSegment
        )
          ? (createMode.shape as MultiSegment)
          : (createMode.checkpoint as MultiSegment | null);

        if (newShape) {
          const createdShapeId = addNewShape(
            state,
            normalizeMultiSegmentLine(newShape)
          );
          pushHistory(state);
          state.selectedTool = "SELECT";
          state.mode = { M: "SELECT", shapeIds: [createdShapeId] };
        } else {
          state.selectedTool = "SELECT";
          state.mode = { M: "SELECT", shapeIds: [] };
        }
      }
    },
    onCellClick: (
      state,
      action: PayloadAction<{
        coords: Coords;
        ctrlKey?: boolean;
        shiftKey?: boolean;
      }>
    ) => {
      const { coords, ctrlKey = false, shiftKey = false } = action.payload;
      if (state.mode.M === "SELECT") {
        const selectMode = state.mode;
        const shapeObj = getShapeObjAtCoordsPreferSelected(
          state.shapes,
          coords,
          selectMode.shapeIds
        );

        let shapeIds: string[];
        if (shiftKey) {
          if (shapeObj) {
            if (selectMode.shapeIds.includes(shapeObj.id)) {
              shapeIds = selectMode.shapeIds.filter((id) => id !== shapeObj.id);
            } else {
              shapeIds = [...selectMode.shapeIds, shapeObj.id];
            }
          } else {
            shapeIds = selectMode.shapeIds;
          }
        } else if (ctrlKey) {
          // If ctrl is pressed
          if (shapeObj) {
            if (selectMode.shapeIds.includes(shapeObj.id)) {
              // click on a already selected shape => deselect it
              shapeIds = selectMode.shapeIds.filter((id) => id !== shapeObj.id);
            } else {
              // click on an unselected shape => add it to selection
              shapeIds = [...state.mode.shapeIds, shapeObj.id];
            }
          } else {
            // Click on an empty cell => don't change selection
            shapeIds = selectMode.shapeIds;
          }
        } else {
          // ctrl is not pressed
          if (shapeObj) {
            // Click on a shape => This shape is now selected (other shapes are deselected)
            shapeIds = [shapeObj.id];
          } else {
            // Click on an empty cell => clear selection
            shapeIds = [];
          }
        }

        state.mode = {
          M: "SELECT",
          shapeIds,
        };
      } else if (state.mode.M === "TEXT_EDIT") {
        // Complete editing text
        completeTextEditing(state, { goToSelect: false });
        const shape = getShapeObjAtCoords(state.shapes, coords);
        state.mode = {
          M: "SELECT",
          shapeIds: shape ? [shape.id] : [],
        };
      } else if (state.mode.M === "RECTANGLE_TEXT_EDIT") {
        completeRectangleTextEditing(state, { goToSelect: false });
        const shape = getShapeObjAtCoords(state.shapes, coords);
        state.mode = {
          M: "SELECT",
          shapeIds: shape ? [shape.id] : [],
        };
      } else if (
        state.mode.M === "BEFORE_CREATING" &&
        state.selectedTool === "MULTI_SEGMENT_LINE"
      ) {
        state.mode = {
          M: "CREATE",
          start: coords,
          curr: coords,
          checkpoint: null,
          shape: {
            type: "MULTI_SEGMENT_LINE",
            segments: [createZeroWidthSegment(coords)],
          },
        };
      } else if (
        state.mode.M === "CREATE" &&
        state.selectedTool === "MULTI_SEGMENT_LINE"
      ) {
        const createMode = state.mode;
        if (isShapeLegal(createMode.shape)) {
          createMode.shape = normalizeMultiSegmentLine(
            createMode.shape as MultiSegment
          );
          createMode.checkpoint = _.cloneDeep(createMode.shape as MultiSegment);

          const lastPoint =
            createMode.shape.segments[createMode.shape.segments.length - 1].end;
          createMode.start = lastPoint;
          createMode.shape.segments.push(createZeroWidthSegment(lastPoint));
        }
      } else if (
        state.mode.M === "BEFORE_CREATING" &&
        state.selectedTool === "TEXT"
      ) {
        const shapeObj = getShapeObjAtCoords(state.shapes, coords);
        if (shapeObj?.shape.type === "TEXT") {
          state.mode = {
            M: "TEXT_EDIT",
            shapeId: shapeObj.id,
            startShape: { ...shapeObj.shape },
          };
          state.textCursorCell = null;
          return;
        }
        state.mode = {
          M: "CREATE",
          start: coords,
          curr: coords,
          checkpoint: null,
          shape: { type: "TEXT", start: coords, lines: [] },
        };
        state.textCursorCell = null;
      } else if (
        state.mode.M === "CREATE" &&
        state.selectedTool === "TEXT" &&
        state.mode.shape.type === "TEXT"
      ) {
        const shapeObj = getShapeObjAtCoords(state.shapes, coords);
        if (
          shapeObj?.shape.type === "TEXT" &&
          isTextShapeEmpty(state.mode.shape)
        ) {
          state.mode = {
            M: "TEXT_EDIT",
            shapeId: shapeObj.id,
            startShape: { ...shapeObj.shape },
          };
          state.textCursorCell = null;
          return;
        }
        // Complete creating text
        completeTextCreation(state, { goToSelect: false });
      }
    },
    onCellMouseDown: (
      state,
      action: PayloadAction<{
        coords: Coords;
        duplicate?: boolean;
        shiftKey?: boolean;
      }>
    ) => {
      const { coords, duplicate = false, shiftKey = false } = action.payload;
      if (state.mode.M === "SELECT") {
        if (shiftKey) {
          state.mode = {
            M: "SELECT_DRAG",
            start: coords,
            curr: coords,
            shapeIds: state.mode.shapeIds,
            baseShapeIds: state.mode.shapeIds,
            invert: true,
          };
          return;
        }

        if (state.mode.shapeIds.length > 1) {
          const selectedShapeObjs = toShapeObjects(state.shapes, state.mode.shapeIds);
          const selectedBounds = getBoundingBoxOfAll(
            selectedShapeObjs.map((shapeObj) => shapeObj.shape)
          );
          if (selectedBounds) {
            const handle = getBoundingBoxResizeHandleAtCoords(
              selectedBounds,
              coords
            );
            if (handle) {
              state.mode = {
                M: "RESIZE_MULTI",
                shapeIds: state.mode.shapeIds,
                startShapes: selectedShapeObjs.map((shapeObj) =>
                  _.cloneDeep(shapeObj.shape)
                ),
                startBounds: _.cloneDeep(selectedBounds),
                handle,
                anchor: getBoundingBoxAnchorForHandle(selectedBounds, handle),
              };
              return;
            }
          }
        }

        const shapeObjAtCoords = getShapeObjAtCoordsPreferSelected(
          state.shapes,
          coords,
          state.mode.shapeIds
        );
        if (!shapeObjAtCoords) {
          state.mode = {
            M: "SELECT_DRAG",
            start: coords,
            curr: coords,
            shapeIds: [],
            baseShapeIds: state.mode.shapeIds,
            invert: false,
          };
          return;
        }

        const clickedShapeIsSelected = state.mode.shapeIds.includes(
          shapeObjAtCoords.id
        );

        // Dragging an unselected shape should select+drag it in one gesture.
        if (!clickedShapeIsSelected) {
          if (duplicate) {
            const duplicatedShapeId = addNewShape(
              state,
              _.cloneDeep(shapeObjAtCoords.shape),
              shapeObjAtCoords.style
            );
            const duplicatedShapeObj = toShapeObject(
              state.shapes,
              duplicatedShapeId
            );
            state.mode = {
              M: "MOVE",
              shapeIds: [duplicatedShapeId],
              start: coords,
              startShapes: [_.cloneDeep(duplicatedShapeObj.shape)],
              duplicated: true,
            };
          } else {
            state.mode = {
              M: "MOVE",
              shapeIds: [shapeObjAtCoords.id],
              start: coords,
              startShapes: [_.cloneDeep(shapeObjAtCoords.shape)],
              duplicated: false,
            };
          }
          return;
        }

        if (state.mode.shapeIds.length === 1) {
          const shapeObj = shapeObjAtCoords;

          if (duplicate && isShapeObjAtCoords(shapeObj, coords)) {
            const duplicatedShapeId = addNewShape(
              state,
              _.cloneDeep(shapeObj.shape),
              shapeObj.style
            );
            const duplicatedShapeObj = toShapeObject(state.shapes, duplicatedShapeId);
            state.mode = {
              M: "MOVE",
              shapeIds: [duplicatedShapeId],
              start: coords,
              startShapes: [_.cloneDeep(duplicatedShapeObj.shape)],
              duplicated: true,
            };
          } else if (hasResizePointAtCoords(shapeObj.shape, coords)) {
            state.mode = {
              M: "RESIZE",
              shapeId: shapeObj.id,
              resizePoint: coords,
              startShape: { ...shapeObj.shape },
            };
          } else if (isShapeObjAtCoords(shapeObj, coords)) {
            state.mode = {
              M: "MOVE",
              shapeIds: [shapeObj.id],
              start: coords,
              startShapes: [{ ...shapeObj.shape }],
              duplicated: false,
            };
          }
          return;
        }

        if (state.mode.shapeIds.length > 1) {
          const shapeObjs = toShapeObjects(state.shapes, state.mode.shapeIds);
          if (shapeObjs.some((so) => isShapeObjAtCoords(so, coords))) {
            if (duplicate) {
              const duplicatedShapeIds = shapeObjs.map((shapeObj) =>
                addNewShape(state, _.cloneDeep(shapeObj.shape), shapeObj.style)
              );
              const duplicatedShapeObjs = toShapeObjects(
                state.shapes,
                duplicatedShapeIds
              );
              state.mode = {
                M: "MOVE",
                shapeIds: duplicatedShapeIds,
                start: coords,
                startShapes: duplicatedShapeObjs.map((so) => _.cloneDeep(so.shape)),
                duplicated: true,
              };
              return;
            }
            state.mode = {
              M: "MOVE",
              shapeIds: state.mode.shapeIds,
              start: coords,
              startShapes: shapeObjs.map((so) => _.cloneDeep(so.shape)),
              duplicated: false,
            };
          }
          return;
        }
      } else if (
        state.mode.M === "BEFORE_CREATING" &&
        state.selectedTool === "RECTANGLE"
      ) {
        state.mode = {
          M: "CREATE",
          start: coords,
          curr: coords,
          checkpoint: null,
          shape: {
            type: "RECTANGLE",
            tl: coords,
            br: coords,
          },
        };
      } else if (
        state.mode.M === "BEFORE_CREATING" &&
        state.selectedTool === "LINE"
      ) {
        state.mode = {
          M: "CREATE",
          start: coords,
          curr: coords,
          checkpoint: null,
          shape: { type: "LINE", ...createZeroWidthSegment(coords) },
        };
      }
    },
    onCellMouseUp: (state, action: PayloadAction<Coords>) => {
      if (state.mode.M === "SELECT_DRAG") {
        state.mode = {
          M: "SELECT",
          shapeIds: state.mode.shapeIds,
        };
      } else if (state.mode.M === "MOVE") {
        // Complete moving a shape
        pushHistory(state);
        state.mode = {
          M: "SELECT",
          shapeIds: state.mode.shapeIds,
        };
      } else if (state.mode.M === "RESIZE") {
        // Complete resizing a shape
        pushHistory(state);
        state.mode = {
          M: "SELECT",
          shapeIds: [state.mode.shapeId],
        };
      } else if (state.mode.M === "RESIZE_MULTI") {
        pushHistory(state);
        state.mode = {
          M: "SELECT",
          shapeIds: state.mode.shapeIds,
        };
      } else if (
        state.mode.M === "CREATE" &&
        (state.mode.shape.type === "RECTANGLE" ||
          state.mode.shape.type === "LINE")
      ) {
        // Complete creating a rectangle or a line
        const newShape: Shape | null = isShapeLegal(state.mode.shape)
          ? state.mode.shape
          : null;

        if (newShape) {
          const createdShapeId = addNewShape(state, newShape);
          pushHistory(state);
          state.selectedTool = "SELECT";
          state.mode = { M: "SELECT", shapeIds: [createdShapeId] };
        } else {
          state.selectedTool = "SELECT";
          state.mode = { M: "SELECT", shapeIds: [] };
        }
      }
    },
    onCellHover: (state, action: PayloadAction<Coords>) => {
      state.currentHoveredCell = action.payload;

      if (state.mode.M === "SELECT_DRAG") {
        const selectDragMode = state.mode;
        const curr = action.payload;

        const [tl, br] = normalizeTlBr(selectDragMode.start, curr);

        const selectedShapes = getShapeObjsInBox(state.shapes, tl, br);
        const selectedShapeIds = selectedShapes.map((s) => s.id);
        const shapeIds = selectDragMode.invert
          ? (() => {
              const selectedSet = new Set(selectedShapeIds);
              const baseSet = new Set(selectDragMode.baseShapeIds);
              const keptBase = selectDragMode.baseShapeIds.filter(
                (id) => !selectedSet.has(id)
              );
              const added = selectedShapeIds.filter((id) => !baseSet.has(id));
              return [...keptBase, ...added];
            })()
          : selectedShapeIds;

        state.mode = {
          ...selectDragMode,
          curr,
          shapeIds,
        };
      } else if (state.mode.M === "MOVE") {
        const moveMode = state.mode;
        //* I'm currently moving a Shape and I change mouse position => Update shape position
        // Get selected shape

        const from = moveMode.start;
        const to = action.payload;
        const delta = { r: to.r - from.r, c: to.c - from.c };
        const translatedShapes: Shape[] = translateAll(
          moveMode.startShapes,
          delta,
          state.canvasSize
        );

        moveMode.shapeIds.forEach((id, idx) => {
          replaceShape(state, id, translatedShapes[idx]);
        });
      } else if (state.mode.M === "RESIZE") {
        const resizeMode = state.mode;
        //* I'm currently resizing a Shape and I change mouse position => Update shape

        // Get selected shape
        const selectedShapeIdx: number = state.shapes.findIndex(
          (s) => s.id === resizeMode.shapeId
        )!;
        // Resize shape
        const resizePoint = resizeMode.resizePoint;
        const to = action.payload;
        const delta = { r: to.r - resizePoint.r, c: to.c - resizePoint.c };
        const resizedShape: Shape = resize(
          resizeMode.startShape,
          resizePoint,
          delta,
          state.canvasSize
        );
        if (isShapeLegal(resizedShape)) {
          // Replace resized shape
          state.shapes[selectedShapeIdx].shape = resizedShape;
        }
      } else if (state.mode.M === "RESIZE_MULTI") {
        const resizeMultiMode = state.mode;
        const resizedBounds = getBoundingBoxFromAnchorAndPointer(
          resizeMultiMode.anchor,
          action.payload
        );
        const resizedShapes = resizeShapeGroup(
          resizeMultiMode.startShapes,
          resizeMultiMode.startBounds,
          resizedBounds,
          state.canvasSize
        );

        resizeMultiMode.shapeIds.forEach((shapeId, idx) => {
          replaceShape(state, shapeId, resizedShapes[idx]);
        });
      } else if (
        state.mode.M === "CREATE" &&
        (state.selectedTool === "RECTANGLE" ||
          state.selectedTool === "LINE" ||
          state.selectedTool === "MULTI_SEGMENT_LINE")
      ) {
        const creationMode = state.mode;
        if (!_.isEqual(creationMode.curr, action.payload)) {
          const curr = action.payload;
          switch (creationMode.shape.type) {
            case "RECTANGLE": {
              const [tl, br] = normalizeTlBr(creationMode.start, curr);

              state.mode = {
                ...creationMode,
                curr,
                shape: {
                  ...creationMode.shape,
                  tl,
                  br,
                },
              };
              break;
            }
            case "LINE": {
              state.mode = {
                ...creationMode,
                curr,
                shape: {
                  type: "LINE",
                  ...createLineSegment(creationMode.start, curr),
                },
              };
              break;
            }
            case "MULTI_SEGMENT_LINE": {
              const newSegment = createLineSegment(creationMode.start, curr);
              creationMode.shape.segments.pop();
              creationMode.shape.segments.push(newSegment);
              break;
            }
          }
        }
      }
    },
    onCanvasMouseLeave: (state) => {
      state.currentHoveredCell = null;
    },
    //#endregion
    //#region Keyboard actions
    onCtrlEnterPress: (state) => {
      if (state.mode.M === "CREATE" && state.selectedTool === "TEXT") {
        completeTextCreation(state, { goToSelect: false });
      } else if (state.mode.M === "TEXT_EDIT") {
        completeTextEditing(state, { goToSelect: false });
      } else if (state.mode.M === "RECTANGLE_TEXT_EDIT") {
        completeRectangleTextEditing(state, { goToSelect: false });
      }
    },
    onEnterPress: (state) => {
      if (
        state.mode.M === "CREATE" &&
        state.selectedTool === "MULTI_SEGMENT_LINE"
      ) {
        const createMode = state.mode;
        const newShape: MultiSegment | null = isShapeLegal(
          createMode.shape as MultiSegment
        )
          ? (createMode.shape as MultiSegment)
          : (createMode.checkpoint as MultiSegment | null);

        if (newShape) {
          const createdShapeId = addNewShape(
            state,
            normalizeMultiSegmentLine(newShape)
          );
          pushHistory(state);
          state.mode = { M: "SELECT", shapeIds: [createdShapeId] };
        } else {
          state.mode = { M: "SELECT", shapeIds: [] };
        }
      }
    },
    onExitEditModePress: (state) => {
      if (state.mode.M === "CREATE" && state.selectedTool === "TEXT") {
        completeTextCreation(state, { goToSelect: true });
        return;
      }
      if (state.mode.M === "TEXT_EDIT") {
        completeTextEditing(state, { goToSelect: true });
        return;
      }
      if (state.mode.M === "RECTANGLE_TEXT_EDIT") {
        completeRectangleTextEditing(state, { goToSelect: true });
        return;
      }

      if (
        state.mode.M === "CREATE" &&
        (state.mode.shape.type === "RECTANGLE" ||
          state.mode.shape.type === "LINE")
      ) {
        const newShape: Shape | null = isShapeLegal(state.mode.shape)
          ? state.mode.shape
          : null;
        if (newShape) {
          const createdShapeId = addNewShape(state, newShape);
          pushHistory(state);
          state.mode = { M: "SELECT", shapeIds: [createdShapeId] };
        } else {
          state.mode = { M: "SELECT", shapeIds: [] };
        }
      } else if (
        state.mode.M === "CREATE" &&
        state.mode.shape.type === "MULTI_SEGMENT_LINE"
      ) {
        const createMode = state.mode;

        const newShape: MultiSegment | null = isShapeLegal(
          createMode.shape as MultiSegment
        )
          ? (createMode.shape as MultiSegment)
          : (createMode.checkpoint as MultiSegment | null);

        if (newShape) {
          const createdShapeId = addNewShape(
            state,
            normalizeMultiSegmentLine(newShape)
          );
          pushHistory(state);
          state.mode = { M: "SELECT", shapeIds: [createdShapeId] };
        } else {
          state.mode = { M: "SELECT", shapeIds: [] };
        }
      } else if (state.mode.M === "MOVE") {
        pushHistory(state);
        state.mode = { M: "SELECT", shapeIds: state.mode.shapeIds };
      } else if (state.mode.M === "RESIZE") {
        pushHistory(state);
        state.mode = { M: "SELECT", shapeIds: [state.mode.shapeId] };
      } else if (state.mode.M === "RESIZE_MULTI") {
        pushHistory(state);
        state.mode = { M: "SELECT", shapeIds: state.mode.shapeIds };
      } else if (state.mode.M === "SELECT_DRAG") {
        state.mode = { M: "SELECT", shapeIds: state.mode.shapeIds };
      } else if (state.mode.M === "SELECT") {
        state.mode = { M: "SELECT", shapeIds: state.mode.shapeIds };
      } else {
        state.mode = { M: "SELECT", shapeIds: [] };
      }

      state.selectedTool = "SELECT";
      state.textCursorCell = null;
    },
    onDeletePress: (state) => {
      if (state.mode.M === "SELECT" && state.mode.shapeIds.length > 0) {
        deleteShapes(state, state.mode.shapeIds);
        pushHistory(state);
        state.mode = { M: "SELECT", shapeIds: [] };
      }
    },
    onCtrlAPress: (state) => {
      if (state.mode.M === "SELECT") {
        state.mode.shapeIds = state.shapes.map((s) => s.id);
      }
    },
    onEnableMoveDuplication: (state) => {
      if (state.mode.M !== "MOVE" || state.mode.duplicated) return;
      const moveMode = state.mode;
      const sourceShapeObjs = toShapeObjects(state.shapes, moveMode.shapeIds);

      // Restore originals to their initial position before creating duplicates.
      moveMode.shapeIds.forEach((shapeId, idx) => {
        replaceShape(state, shapeId, _.cloneDeep(moveMode.startShapes[idx]));
      });

      const duplicatedShapeIds = moveMode.startShapes.map((shape, idx) =>
        addNewShape(state, _.cloneDeep(shape), sourceShapeObjs[idx]?.style)
      );
      moveMode.shapeIds = duplicatedShapeIds;
      moveMode.startShapes = moveMode.startShapes.map((shape) =>
        _.cloneDeep(shape)
      );
      moveMode.duplicated = true;
    },
    onCopyPress: (state) => {
      if (state.mode.M !== "SELECT" || state.mode.shapeIds.length === 0) return;
      state.clipboard = _.cloneDeep(toShapeObjects(state.shapes, state.mode.shapeIds));
    },
    onPastePress: (state) => {
      if (state.clipboard.length === 0) return;

      const clipboardShapes = state.clipboard.map((shapeObj) =>
        _.cloneDeep(shapeObj.shape)
      );
      const clipboardBb = getBoundingBoxOfAll(clipboardShapes);
      if (!clipboardBb) return;

      const pasteAnchor = state.currentHoveredCell ?? {
        r: clipboardBb.top + 1,
        c: clipboardBb.left + 1,
      };
      const translatedShapes = translateAll(
        clipboardShapes,
        { r: pasteAnchor.r - clipboardBb.top, c: pasteAnchor.c - clipboardBb.left },
        state.canvasSize
      );

      const createdShapeIds = translatedShapes.map((shape, idx) =>
        addNewShape(state, shape, state.clipboard[idx]?.style)
      );

      pushHistory(state);
      state.selectedTool = "SELECT";
      state.mode = { M: "SELECT", shapeIds: createdShapeIds };
    },
    //#endregion

    updateText: (state, action: PayloadAction<string>) => {
      if (state.mode.M === "CREATE" && state.mode.shape.type === "TEXT") {
        state.mode.shape.lines = capText(
          state.mode.shape.start,
          getLines(action.payload),
          state.canvasSize
        );
      } else if (state.mode.M === "TEXT_EDIT") {
        const textEditMode = state.mode;

        const selectedTextShapeObjIdx = state.shapes.findIndex(
          (s) => s.id === textEditMode.shapeId
        );

        const selectTextShape = state.shapes[selectedTextShapeObjIdx]
          .shape as TextShape;

        selectTextShape.lines = capText(
          selectTextShape.start,
          getLines(action.payload),
          state.canvasSize
        );
      } else if (state.mode.M === "RECTANGLE_TEXT_EDIT") {
        const editMode = state.mode;
        const rectShapeObj = state.shapes.find((s) => s.id === editMode.shapeId);
        if (rectShapeObj?.shape.type !== "RECTANGLE") return;
        const nextLines = getLines(action.payload);
        rectShapeObj.shape = {
          ...rectShapeObj.shape,
          labelLines: nextLines,
        };
      }
    },
    onMoveToFrontButtonClick: (state) => {
      if (state.mode.M === "SELECT" && state.mode.shapeIds.length === 1) {
        state.shapes = moveShapeToFront(state.shapes, state.mode.shapeIds[0]);
        pushHistory(state);
      }
    },
    onMoveToBackButtonClick: (state) => {
      if (state.mode.M === "SELECT" && state.mode.shapeIds.length === 1) {
        state.shapes = moveShapeToBack(state.shapes, state.mode.shapeIds[0]);
        pushHistory(state);
      }
    },
    //#region history actions
    moveInHistory: (state, action: PayloadAction<"UNDO" | "REDO">) => {
      if (
        state.mode.M !== "TEXT_EDIT" &&
        state.mode.M !== "RECTANGLE_TEXT_EDIT"
      ) {
        action.payload === "UNDO" ? undoHistory(state) : redoHistory(state);
        state.mode =
          state.selectedTool === "SELECT"
            ? { M: "SELECT", shapeIds: [] }
            : { M: "BEFORE_CREATING" };
        state.textCursorCell = null;
      }
    },

    //#endregion

    //#region Styling actions
    setStyleMode: (state, action: PayloadAction<StyleMode>) => {
      state.styleMode = action.payload;

      /*
        If the user switched to ASCII, styles won't matter anymore, but for simplicity, we will still save
        style information with each new shape.

        To prevent surprises, if the user goes back to Unicode, in ASCII mode, all new shapes will have default styles
      */
      if (action.payload === "ASCII") {
        state.globalStyle = defaultStyle();
      }
      pushHistory(state);
    },
    setStyle: (
      state,
      action: PayloadAction<{ style: Partial<Style>; shapeIds?: string[] }>
    ) => {
      const { style, shapeIds } = action.payload;
      if (!shapeIds) {
        _.merge(state.globalStyle, style);
      } else {
        shapeIds.forEach((sid) => {
          const shapeObj = state.shapes.find((s) => s.id === sid);
          if (shapeObj) {
            if ("style" in shapeObj) {
              _.merge(shapeObj.style, style);
            } else {
              shapeObj.style = style;
            }
          }
        });
      }
      pushHistory(state);
    },
    //#endregion
    //#region Other App actions
    openExport: (state) => {
      state.exportInProgress = true;
    },
    closeExport: (state) => {
      state.exportInProgress = false;
    }, //#endregion
  },
});

//#region Helper state function that mutate directly the state
function isTextShapeEmpty(shape: TextShape): boolean {
  return shape.lines.length === 0 || shape.lines.every((line) => line.length === 0);
}

function completeTextCreation(
  state: DiagramState,
  opts: { goToSelect: boolean }
): void {
  if (state.mode.M !== "CREATE" || state.mode.shape.type !== "TEXT") return;

  const createdShape = state.mode.shape;
  if (isTextShapeEmpty(createdShape)) {
    state.textCursorCell = null;
    if (opts.goToSelect) {
      state.selectedTool = "SELECT";
      state.mode = { M: "SELECT", shapeIds: [] };
    } else {
      state.mode = { M: "BEFORE_CREATING" };
    }
    return;
  }

  const createdShapeId = addNewShape(state, createdShape);
  pushHistory(state);
  if (opts.goToSelect) {
    state.selectedTool = "SELECT";
    state.mode = { M: "SELECT", shapeIds: [createdShapeId] };
  } else {
    state.mode = { M: "BEFORE_CREATING" };
  }
  state.textCursorCell = null;
}

function completeTextEditing(
  state: DiagramState,
  opts: { goToSelect: boolean }
): void {
  if (state.mode.M !== "TEXT_EDIT") return;

  const textEditMode = state.mode;
  const selectedTextShapeObjIdx = state.shapes.findIndex(
    (s) => s.id === textEditMode.shapeId
  );

  if (selectedTextShapeObjIdx < 0) {
    state.mode = { M: "SELECT", shapeIds: [] };
    if (opts.goToSelect) state.selectedTool = "SELECT";
    state.textCursorCell = null;
    return;
  }

  const selectedTextShapeObj = state.shapes[selectedTextShapeObjIdx];
  const selectedTextShape = selectedTextShapeObj.shape as TextShape;
  const changed = !_.isEqual(selectedTextShape, textEditMode.startShape);

  let nextSelection: string[] = [textEditMode.shapeId];
  if (isTextShapeEmpty(selectedTextShape)) {
    state.shapes.splice(selectedTextShapeObjIdx, 1);
    nextSelection = [];
  }
  if (changed) {
    pushHistory(state);
  }

  state.mode = { M: "SELECT", shapeIds: nextSelection };
  if (opts.goToSelect) {
    state.selectedTool = "SELECT";
  }
  state.textCursorCell = null;
}

function completeRectangleTextEditing(
  state: DiagramState,
  opts: { goToSelect: boolean }
): void {
  if (state.mode.M !== "RECTANGLE_TEXT_EDIT") return;

  const editMode = state.mode;
  const rectShapeObj = state.shapes.find((s) => s.id === editMode.shapeId);
  if (!rectShapeObj || rectShapeObj.shape.type !== "RECTANGLE") {
    state.mode = { M: "SELECT", shapeIds: [] };
    if (opts.goToSelect) state.selectedTool = "SELECT";
    state.textCursorCell = null;
    return;
  }

  const currentLines = rectShapeObj.shape.labelLines ?? [];
  const changed = !_.isEqual(currentLines, editMode.startLines);

  if (currentLines.length === 0 || currentLines.every((line) => line.length === 0)) {
    rectShapeObj.shape = {
      ...rectShapeObj.shape,
      labelLines: [],
    };
  }

  if (changed) {
    pushHistory(state);
  }

  state.mode = { M: "SELECT", shapeIds: [editMode.shapeId] };
  if (opts.goToSelect) {
    state.selectedTool = "SELECT";
  }
  state.textCursorCell = null;
}

function addNewShape(
  state: DiagramState,
  shape: Shape,
  style?: Partial<Style>
): string {
  const id = uuidv4();
  const newShapeObj: ShapeObject = {
    id,
    shape,
    style: _.cloneDeep(style ?? state.globalStyle),
  };

  // New shapes are added on top by default, regardless of shape type.
  state.shapes.push(newShapeObj);

  return id;
}

function replaceShape(
  state: DiagramState,
  shapeId: string,
  shape: Shape
): void {
  const idx = state.shapes.findIndex((s) => s.id === shapeId);
  state.shapes[idx].shape = shape;
}

function deleteShapes(state: DiagramState, shapeIds: string[]): void {
  shapeIds.forEach((shapeId) => {
    const shapeIdx = state.shapes.findIndex((s) => s.id === shapeId);
    if (shapeIdx >= 0) {
      state.shapes.splice(shapeIdx, 1);
    }
  });
}

function pushHistory(state: DiagramState): void {
  const { canvasSize, shapes, styleMode, globalStyle } = state;
  state.history = [
    ...state.history.slice(0, state.historyIdx + 1),
    _.cloneDeep({ canvasSize, shapes, styleMode, globalStyle }),
  ];

  state.historyIdx++;
}

function undoHistory(state: DiagramState): void {
  if (state.historyIdx > 0) {
    const { canvasSize, shapes, styleMode, globalStyle } = _.cloneDeep(
      state.history[state.historyIdx - 1]
    );
    state.canvasSize = canvasSize;
    state.shapes = shapes;
    state.styleMode = styleMode;
    state.globalStyle = globalStyle;

    state.historyIdx--;
  }
}

function redoHistory(state: DiagramState): void {
  if (state.historyIdx < state.history.length - 1) {
    const { canvasSize, shapes, styleMode, globalStyle } = _.cloneDeep(
      state.history[state.historyIdx + 1]
    );
    state.canvasSize = canvasSize;
    state.shapes = shapes;
    state.styleMode = styleMode;
    state.globalStyle = globalStyle;

    state.historyIdx++;
  }
}
//#endregion

//#region Utilities
function toShapeObjects(
  shapes: ShapeObject[],
  shapeIds: string[]
): ShapeObject[] {
  return shapeIds.map((shapeId) => shapes.find((s) => s.id === shapeId)!);
}

function toShapeObject(shapes: ShapeObject[], shapeId: string): ShapeObject {
  return shapes.find((s) => s.id === shapeId)!;
}

function getBoundingBoxAnchorForHandle(
  bounds: BoundingBox,
  handle: BoundingBoxHandle
): Coords {
  switch (handle) {
    case "TL":
      return { r: bounds.bottom, c: bounds.right };
    case "TR":
      return { r: bounds.bottom, c: bounds.left };
    case "BR":
      return { r: bounds.top, c: bounds.left };
    case "BL":
      return { r: bounds.top, c: bounds.right };
  }
}

function getBoundingBoxFromAnchorAndPointer(
  anchor: Coords,
  pointer: Coords
): BoundingBox {
  return {
    top: Math.min(anchor.r, pointer.r),
    bottom: Math.max(anchor.r, pointer.r),
    left: Math.min(anchor.c, pointer.c),
    right: Math.max(anchor.c, pointer.c),
  };
}

function scaleCoordWithinBounds(
  value: number,
  sourceMin: number,
  sourceMax: number,
  targetMin: number,
  targetMax: number
): number {
  const sourceSpan = sourceMax - sourceMin;
  if (sourceSpan === 0) {
    return Math.round(targetMin);
  }

  const ratio = (value - sourceMin) / sourceSpan;
  return Math.round(targetMin + ratio * (targetMax - targetMin));
}

function scaleCoordsWithinBounds(
  coords: Coords,
  sourceBounds: BoundingBox,
  targetBounds: BoundingBox
): Coords {
  return {
    r: scaleCoordWithinBounds(
      coords.r,
      sourceBounds.top,
      sourceBounds.bottom,
      targetBounds.top,
      targetBounds.bottom
    ),
    c: scaleCoordWithinBounds(
      coords.c,
      sourceBounds.left,
      sourceBounds.right,
      targetBounds.left,
      targetBounds.right
    ),
  };
}

function resizeShapeGroup(
  shapes: Shape[],
  sourceBounds: BoundingBox,
  targetBounds: BoundingBox,
  canvasSize: CanvasSize
): Shape[] {
  return shapes.map((shape) =>
    resizeShapeWithinBounds(shape, sourceBounds, targetBounds, canvasSize)
  );
}

function resizeShapeWithinBounds(
  shape: Shape,
  sourceBounds: BoundingBox,
  targetBounds: BoundingBox,
  canvasSize: CanvasSize
): Shape {
  const scaledShape = scaleShapeWithinBounds(shape, sourceBounds, targetBounds);
  if (isShapeWithinCanvas(scaledShape, canvasSize) && isShapeLegal(scaledShape)) {
    return scaledShape;
  }
  return shape;
}

function scaleShapeWithinBounds(
  shape: Shape,
  sourceBounds: BoundingBox,
  targetBounds: BoundingBox
): Shape {
  switch (shape.type) {
    case "RECTANGLE": {
      const newTl = scaleCoordsWithinBounds(shape.tl, sourceBounds, targetBounds);
      const newBr = scaleCoordsWithinBounds(shape.br, sourceBounds, targetBounds);
      const [tl, br] = normalizeTlBr(newTl, newBr);
      return { ...shape, tl, br };
    }
    case "LINE": {
      const start = scaleCoordsWithinBounds(
        shape.start,
        sourceBounds,
        targetBounds
      );
      const end = scaleCoordsWithinBounds(shape.end, sourceBounds, targetBounds);
      if (shape.axis === "HORIZONTAL") {
        const direction =
          start.c <= end.c ? "LEFT_TO_RIGHT" : "RIGHT_TO_LEFT";
        return { ...shape, start: { ...start, r: start.r }, end: { ...end, r: start.r }, direction };
      }
      const direction = start.r <= end.r ? "DOWN" : "UP";
      return { ...shape, start: { ...start, c: start.c }, end: { ...end, c: start.c }, direction };
    }
    case "MULTI_SEGMENT_LINE": {
      if (shape.segments.length === 0) {
        return shape;
      }

      let curr = scaleCoordsWithinBounds(
        shape.segments[0].start,
        sourceBounds,
        targetBounds
      );
      const scaledSegments = shape.segments.map((segment) => {
        if (segment.axis === "HORIZONTAL") {
          const scaledEndCol = scaleCoordWithinBounds(
            segment.end.c,
            sourceBounds.left,
            sourceBounds.right,
            targetBounds.left,
            targetBounds.right
          );
          const next = { r: curr.r, c: scaledEndCol };
          const scaled = {
            ...segment,
            start: curr,
            end: next,
            direction:
              curr.c <= next.c ? ("LEFT_TO_RIGHT" as const) : ("RIGHT_TO_LEFT" as const),
          };
          curr = next;
          return scaled;
        }

        const scaledEndRow = scaleCoordWithinBounds(
          segment.end.r,
          sourceBounds.top,
          sourceBounds.bottom,
          targetBounds.top,
          targetBounds.bottom
        );
        const next = { r: scaledEndRow, c: curr.c };
        const scaled = {
          ...segment,
          start: curr,
          end: next,
          direction: curr.r <= next.r ? ("DOWN" as const) : ("UP" as const),
        };
        curr = next;
        return scaled;
      });

      return normalizeMultiSegmentLine({
        ...shape,
        segments: scaledSegments,
      });
    }
    case "TEXT": {
      return {
        ...shape,
        start: scaleCoordsWithinBounds(shape.start, sourceBounds, targetBounds),
      };
    }
  }
}

function isShapeWithinCanvas(shape: Shape, canvasSize: CanvasSize): boolean {
  const bb = getBoundingBoxOfAll([shape]);
  if (!bb) return false;
  return (
    bb.top >= 0 &&
    bb.left >= 0 &&
    bb.bottom < canvasSize.rows &&
    bb.right < canvasSize.cols
  );
}

//#endregion

export const diagramReducer = diagramSlice.reducer;
export const diagramActions = diagramSlice.actions;
