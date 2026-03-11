import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { diagramActions } from "../../store/diagramSlice";
import { CELL_HEIGHT, CELL_WIDTH, FONT, FONT_FAMILY, FONT_SIZE } from "./draw";
import { applyListContinuationOnEnter, getStringFromShape } from "../../models/text";
import {
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { selectors } from "../../store/selectors";
import { editorTheme } from "../../theme";
import { defaultStyle } from "../../models/style";
import {
  getRectangleEditorLayout,
  getRectangleLabelArea,
} from "../../models/rectangleText";
import { Textarea } from "@/components/ui/textarea";

function getCursorCell(value: string, selectionStart: number): { row: number; col: number } {
  const safeIndex = Math.max(0, Math.min(selectionStart, value.length));
  const prefix = value.slice(0, safeIndex);
  const lines = prefix.split("\n");
  return {
    row: Math.max(0, lines.length - 1),
    col: Array.from(lines[lines.length - 1] ?? "").length,
  };
}

export function TextShapeInput() {
  const dispatch = useAppDispatch();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSelectionRef = useRef<number | null>(null);
  const diagramState = useAppSelector((state) => state.diagram);

  const currentEditedText = useAppSelector((state) =>
    selectors.currentEditedText(state.diagram)
  )!;
  const textValue = getStringFromShape(currentEditedText);

  const rectangleEditConfig = useMemo(() => {
    const editMode = diagramState.mode;
    if (editMode.M !== "RECTANGLE_TEXT_EDIT") {
      return null;
    }
    const shapeObj = diagramState.shapes.find(
      (shape) => shape.id === editMode.shapeId
    );
    if (!shapeObj || shapeObj.shape.type !== "RECTANGLE") {
      return null;
    }
    const mergedStyle = {
      ...defaultStyle(),
      ...diagramState.globalStyle,
      ...(shapeObj.style ?? {}),
    };
    return {
      rectangle: shapeObj.shape,
      area: getRectangleLabelArea(
        shapeObj.shape,
        mergedStyle.rectangleTextPadding
      ),
      alignH: mergedStyle.rectangleTextAlignH,
      alignV: mergedStyle.rectangleTextAlignV,
      padding: mergedStyle.rectangleTextPadding,
      isSolidFill: mergedStyle.rectangleFill === "SOLID",
      layout: getRectangleEditorLayout(
        shapeObj.shape.labelLines ?? [],
        shapeObj.shape,
        mergedStyle.rectangleTextAlignV,
        mergedStyle.rectangleTextPadding
      ),
    };
  }, [diagramState.globalStyle, diagramState.mode, diagramState.shapes]);

  const toAbsoluteCursor = (value: string, selectionStart: number) => {
    const cursor = getCursorCell(value, selectionStart);
    return {
      r: currentEditedText.start.r + cursor.row,
      c: currentEditedText.start.c + cursor.col,
    };
  };

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    dispatch(diagramActions.updateText(event.target.value));
    if (rectangleEditConfig) {
      dispatch(diagramActions.setTextCursor(null));
      return;
    }
    const cursor = toAbsoluteCursor(
      event.target.value,
      event.target.selectionStart ?? event.target.value.length
    );
    dispatch(
      diagramActions.setTextCursor(cursor)
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;
    const result = applyListContinuationOnEnter(
      input.value,
      selectionStart,
      selectionEnd
    );
    if (!result.handled) {
      return;
    }

    event.preventDefault();
    pendingSelectionRef.current = result.nextSelectionStart;
    dispatch(diagramActions.updateText(result.value));

    if (rectangleEditConfig) {
      dispatch(diagramActions.setTextCursor(null));
      return;
    }

    const cursor = toAbsoluteCursor(result.value, result.nextSelectionStart);
    dispatch(diagramActions.setTextCursor(cursor));
  };

  const syncCursorFromInput = () => {
    const input = inputRef.current;
    if (!input) return;
    if (rectangleEditConfig) {
      dispatch(diagramActions.setTextCursor(null));
      return;
    }
    const cursor = toAbsoluteCursor(input.value, input.selectionStart ?? 0);
    dispatch(diagramActions.setTextCursor(cursor));
  };

  const inputBoxSize = useMemo(() => {
    if (rectangleEditConfig) {
      const widthCells = Math.max(1, rectangleEditConfig.layout.area.width);
      const contentRows = Math.max(1, rectangleEditConfig.layout.contentRows);
      const topOffsetRows = Math.max(0, rectangleEditConfig.layout.topOffsetRows);
      const heightRows = Math.max(
        rectangleEditConfig.layout.area.height,
        topOffsetRows + contentRows
      );
      return {
        width: widthCells * CELL_WIDTH,
        height: heightRows * CELL_HEIGHT,
        rows: 1,
        topOffsetRows: 0,
        paddingTop: topOffsetRows * CELL_HEIGHT,
      };
    }
    const maxLineLength = currentEditedText.lines.reduce(
      (acc, line) => Math.max(acc, line.length),
      0
    );
    return {
      width: Math.max(8, maxLineLength + 1) * CELL_WIDTH + 8,
      height: Math.max(1, currentEditedText.lines.length || 1) * CELL_HEIGHT + 6,
      rows: Math.max(1, currentEditedText.lines.length || 1),
      topOffsetRows: 0,
      paddingTop: 0,
    };
  }, [currentEditedText.lines, rectangleEditConfig]);

  // At mount, put the cursor to the end of the input
  useEffect(() => {
    const pendingSelection = pendingSelectionRef.current;
    if (inputRef.current && pendingSelection != null) {
      inputRef.current.setSelectionRange(pendingSelection, pendingSelection);
      pendingSelectionRef.current = null;
    }
  }, [textValue]);

  useEffect(() => {
    if (inputRef.current) {
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
      if (rectangleEditConfig) {
        dispatch(diagramActions.setTextCursor(null));
        return;
      }
      dispatch(
        diagramActions.setTextCursor(
          toAbsoluteCursor(inputRef.current.value, length)
        )
      );
    }
  }, [
    currentEditedText.start.c,
    currentEditedText.start.r,
    dispatch,
  ]);

  useEffect(() => {
    return () => {
      dispatch(diagramActions.setTextCursor(null));
    };
  }, [dispatch]);

  return (
    <div
      style={{
        position: "absolute",
        left: `${currentEditedText.start.c * CELL_WIDTH}px`,
        top: `${(currentEditedText.start.r + inputBoxSize.topOffsetRows) * CELL_HEIGHT}px`,
        zIndex: 3,
      }}
    >
      <Textarea
        id="text-shape-input"
        ref={inputRef}
        autoFocus
        spellCheck={false}
        rows={inputBoxSize.rows}
        wrap={rectangleEditConfig ? "soft" : "off"}
        value={textValue}
        onKeyDown={handleKeyDown}
        onChange={handleTextChange}
        onSelect={syncCursorFromInput}
        onKeyUp={syncCursorFromInput}
        onClick={syncCursorFromInput}
        className="min-h-0 resize-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
        style={{
          width: `${inputBoxSize.width}px`,
          height: `${inputBoxSize.height}px`,
          margin: 0,
          padding: `${inputBoxSize.paddingTop}px 0 0 0`,
          borderRadius: 2,
          overflow: "hidden",
          boxSizing: rectangleEditConfig ? "border-box" : "content-box",
          font: FONT,
          fontFamily: FONT_FAMILY,
          fontSize: `${FONT_SIZE}px`,
          lineHeight: `${CELL_HEIGHT}px`,
          background: "transparent",
          color: rectangleEditConfig
            ? rectangleEditConfig.isSolidFill
              ? editorTheme.canvas.background
              : editorTheme.canvas.selectedShape
            : "transparent",
          caretColor: rectangleEditConfig ? "#ffffff" : "transparent",
          outline: "none",
          whiteSpace: rectangleEditConfig ? "break-spaces" : "pre",
          overflowWrap: rectangleEditConfig ? "break-word" : "normal",
          wordBreak: rectangleEditConfig ? "break-word" : "normal",
          textAlign:
            rectangleEditConfig?.alignH === "RIGHT"
              ? "right"
              : rectangleEditConfig?.alignH === "CENTER"
              ? "center"
              : "left",
        }}
      />
    </div>
  );
}
