import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { Coords, normalizeTlBr } from "../../models/shapes";
import { diagramActions } from "../../store/diagramSlice";
import { CELL_HEIGHT, CELL_WIDTH, DrawOptions, canvasDraw } from "./draw";
import _ from "lodash";
import { TextShapeInput } from "./TextShapeInput";
import { RectangleTextFloatingControls } from "./RectangleTextFloatingControls";
import { selectors } from "../../store/selectors";
import { getBoundingBoxOfAll } from "../../models/shapeInCanvas";
import { editorTheme } from "../../theme";

export default function Canvas() {
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // This ref is used to prevent firing unnecessary cell hover events if the hovered cell didn't change.
  const hoveredCellRef = useRef<Coords | null>(null);
  // This ref is used to distinguish between a series of mouseup and down and a click.
  const pendingMouseDown = useRef<{
    timestamp: number;
    cell: Coords;
    timeoutId: number | null;
    pendingMoveActions: Coords[];
    duplicate: boolean;
    shiftKey: boolean;
  } | null>(null);

  //#region selectors
  const rowCount = useAppSelector((state) => state.diagram.canvasSize.rows);
  const colCount = useAppSelector((state) => state.diagram.canvasSize.cols);
  const canvasWidth = colCount * CELL_WIDTH;
  const canvasHeight = rowCount * CELL_HEIGHT;

  const currentHoveredCell = useAppSelector(
    (state) => state.diagram.currentHoveredCell
  );

  const styleMode = useAppSelector((state) => state.diagram.styleMode);
  const globalStyle = useAppSelector((state) => state.diagram.globalStyle);
  const shapeObjs = useAppSelector((state) => state.diagram.shapes);
  const selectedShapeObjs = useAppSelector((state) =>
    selectors.selectedShapeObjs(state.diagram)
  );
  const selectedBounds = useMemo(
    () => getBoundingBoxOfAll(selectedShapeObjs.map((shapeObj) => shapeObj.shape)),
    [selectedShapeObjs]
  );
  const newShape = useAppSelector((state) =>
    selectors.currentCreatedShape(state.diagram)
  );
  const currentEditedText = useAppSelector((state) =>
    selectors.currentEditedText(state.diagram)
  );
  const textCursorCell = useAppSelector((state) => state.diagram.textCursorCell);

  const nextActionOnClick = useAppSelector((state) =>
    selectors.getPointer(state.diagram)
  );
  const mode = useAppSelector((state) => state.diagram.mode);
  const [cursorBlinkOn, setCursorBlinkOn] = useState(true);
  const resolvedCursorCell = useMemo(() => {
    if (!currentEditedText) return null;
    if (textCursorCell) return textCursorCell;

    const lines = currentEditedText.lines;
    const lastRowOffset = Math.max(0, lines.length - 1);
    const lastLine = lines[lastRowOffset] ?? "";
    const lastColOffset = Array.from(lastLine).length;
    return {
      r: currentEditedText.start.r + lastRowOffset,
      c: currentEditedText.start.c + lastColOffset,
    };
  }, [currentEditedText, textCursorCell]);

  // #endregion

  //#region helper functions
  const getCellCoords = (eventX: number, eventY: number): Coords => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = eventX - rect.left;
    const y = eventY - rect.top;

    return { r: Math.floor(y / CELL_HEIGHT), c: Math.floor(x / CELL_WIDTH) };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCellCoords(e.clientX, e.clientY);
    const duplicate = e.metaKey || e.ctrlKey || e.altKey;
    const shiftKey = e.shiftKey;
    const timeoutId = window.setTimeout(() => {
      const pending = pendingMouseDown.current;
      dispatch(
        diagramActions.onCellMouseDown({
          coords,
          duplicate: pending?.duplicate ?? duplicate,
          shiftKey: pending?.shiftKey ?? shiftKey,
        })
      );
      if (pendingMouseDown.current) {
        pendingMouseDown.current.pendingMoveActions.forEach((m) =>
          dispatch(diagramActions.onCellHover(m))
        );
      }
      pendingMouseDown.current = null;
    }, 150);

    pendingMouseDown.current = {
      timestamp: e.timeStamp,
      cell: coords,
      timeoutId,
      pendingMoveActions: [],
      duplicate,
      shiftKey,
    };
  };

  const handleMouseMove = (newCoords: Coords, e: React.MouseEvent) => {
    const duplicateModifierPressed = e.metaKey || e.ctrlKey || e.altKey;
    if (pendingMouseDown.current) {
      if (duplicateModifierPressed) {
        pendingMouseDown.current.duplicate = true;
      }
      const { pendingMoveActions } = pendingMouseDown.current;
      if (pendingMoveActions.length === 0) {
        if (!_.isEqual(hoveredCellRef.current, newCoords)) {
          pendingMoveActions.push(newCoords);
        }
      } else {
        if (!_.isEqual(_.last(pendingMoveActions), newCoords)) {
          pendingMouseDown.current.pendingMoveActions.push(newCoords);
        }
      }
    } else {
      if (mode.M === "MOVE" && duplicateModifierPressed) {
        dispatch(diagramActions.onEnableMoveDuplication());
      }
      hoveredCellRef.current = newCoords;
      dispatch(diagramActions.onCellHover(newCoords));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const coords = getCellCoords(e.clientX, e.clientY);

    // If mousedown was not fired => mouse up came up very fast => dispatch a click
    if (pendingMouseDown.current) {
      if (pendingMouseDown.current.timeoutId != null) {
        window.clearTimeout(pendingMouseDown.current.timeoutId);
        pendingMouseDown.current.pendingMoveActions.forEach((m) =>
          dispatch(diagramActions.onCellHover(m))
        );
      }
      dispatch(
        diagramActions.onCellClick({
          coords,
          ctrlKey: e.ctrlKey || e.metaKey,
          shiftKey: e.shiftKey,
        })
      );
      pendingMouseDown.current = null;
    } else {
      // mousedown was already dispatched => Dispatch mouseup
      dispatch(diagramActions.onCellMouseUp(coords));
    }
  };

  //#endregion

  useEffect(() => {
    if (!currentEditedText || !resolvedCursorCell) {
      setCursorBlinkOn(false);
      return;
    }

    setCursorBlinkOn(true);
    const intervalId = window.setInterval(() => {
      setCursorBlinkOn((prev) => !prev);
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [currentEditedText, resolvedCursorCell?.r, resolvedCursorCell?.c]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) return;
    const ctx = canvas.getContext("2d")!;

    // Set canvas dimension
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvasDraw.setBackground(
      ctx,
      canvas.width,
      canvas.height,
      editorTheme.canvas.background
    );

    // Set the cursor
    canvas.style.cursor =
      nextActionOnClick === "SELECT"
        ? "pointer"
        : nextActionOnClick === "MOVE"
        ? "move"
        : nextActionOnClick === "RESIZE"
        ? "grabbing"
        : nextActionOnClick === "CREATE"
        ? "copy"
        : "default";

    // Draw the grid
    canvasDraw.drawGrid(
      ctx,
      canvasWidth,
      canvasHeight,
      rowCount,
      colCount,
      editorTheme.canvas.grid
    );

    // Draw hovered cell
    if (currentHoveredCell && nextActionOnClick === "CREATE") {
      canvasDraw.drawHoveredCell(ctx, currentHoveredCell);
    }

    // Draw shapes
    const selectedShapeIds = selectedShapeObjs.map((s) => s.id);

    const drawOpts: DrawOptions[] = shapeObjs.map((so) => {
      const isShapeSelected = selectedShapeIds.includes(so.id);
      const color = isShapeSelected
        ? editorTheme.canvas.selectedShape
        : editorTheme.canvas.shape;
      const drawResizePoints: boolean =
        isShapeSelected &&
        selectedShapeObjs.length === 1 &&
        mode.M !== "SELECT_DRAG";

      const renderRectangleLabelAsEditor =
        mode.M === "RECTANGLE_TEXT_EDIT" && mode.shapeId === so.id;

      return { color, drawResizePoints, renderRectangleLabelAsEditor };
    });

    canvasDraw.drawShapes(ctx, shapeObjs, styleMode, globalStyle, drawOpts);

    // Draw new shape
    if (newShape) {
      canvasDraw.drawShapes(ctx, [newShape], styleMode, globalStyle, [
        { color: editorTheme.canvas.createdShape, drawResizePoints: false },
      ]);
    }

    // Draw select box if I'm drag-selecting
    if (mode.M === "SELECT_DRAG") {
      const [tl, br] = normalizeTlBr(mode.start, mode.curr);
      canvasDraw.drawSelectBox(ctx, tl, br, editorTheme.canvas.selectBox);
    }

    if (
      selectedBounds &&
      selectedShapeObjs.length > 1 &&
      mode.M !== "SELECT_DRAG"
    ) {
      canvasDraw.drawBoundingBox(
        ctx,
        selectedBounds,
        editorTheme.canvas.selectedShape
      );
      canvasDraw.drawBoundingBoxResizePoints(
        ctx,
        selectedBounds,
        editorTheme.canvas.selectedShape
      );
    }

    if (
      currentEditedText &&
      resolvedCursorCell &&
      cursorBlinkOn &&
      mode.M !== "RECTANGLE_TEXT_EDIT"
    ) {
      canvasDraw.drawBlockCursor(
        ctx,
        resolvedCursorCell,
        editorTheme.chrome.accent
      );
    }
  }, [
    canvasHeight,
    canvasWidth,
    colCount,
    currentHoveredCell,
    globalStyle,
    mode,
    newShape,
    nextActionOnClick,
    rowCount,
    textCursorCell,
    resolvedCursorCell,
    selectedBounds,
    selectedShapeObjs,
    shapeObjs,
    styleMode,
    cursorBlinkOn,
    currentEditedText,
  ]);

  return (
    <div
      id="canvas-container"
      style={{
        flex: 1,
        overflow: "scroll",
        position: "relative",
        scrollbarColor: `${editorTheme.chrome.accentSoft} ${editorTheme.chrome.background}`,
      }}
    >
      <div className="pointer-events-none sticky top-2 z-10 h-0">
        <div className="flex justify-center overflow-visible">
          <RectangleTextFloatingControls />
        </div>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={(e) =>
          handleMouseMove(getCellCoords(e.clientX, e.clientY), e)
        }
        onMouseLeave={(e) => {
          dispatch(diagramActions.onCanvasMouseLeave());
        }}
        onDoubleClick={(e) => {
          dispatch(
            diagramActions.onCellDoubleClick(
              getCellCoords(e.clientX, e.clientY)
            )
          );
        }}
      ></canvas>
      {currentEditedText && (
        <TextShapeInput
          // Add key, in order to force React to recreate a new instance when edit a new text object
          key={
            mode.M === "TEXT_EDIT" || mode.M === "RECTANGLE_TEXT_EDIT"
              ? `textinput_${mode.M}_${mode.shapeId}`
              : `textinput_r${currentEditedText.start.r}_c${currentEditedText.start.c}`
          }
        />
      )}
    </div>
  );
}
