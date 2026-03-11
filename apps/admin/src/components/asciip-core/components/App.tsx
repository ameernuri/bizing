import React, { useEffect, type ReactNode } from "react";
import Toolbar from "./toolbar/Toolbar";
import Canvas from "./canvas/Canvas";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { diagramActions } from "../store/diagramSlice";
import { selectors } from "../store/selectors";
import { editorTheme } from "../theme";
import { getTextExport } from "../models/representation";

function App({
  toolbarLeading,
  toolbarTrailing,
}: {
  toolbarLeading?: ReactNode;
  toolbarTrailing?: ReactNode;
}) {
  const dispatch = useAppDispatch();

  const shortcutsEnabled = useAppSelector((state) =>
    selectors.isShortcutsEnabled(state)
  );
  const globalStyle = useAppSelector((state) => state.diagram.globalStyle);
  const styleMode = useAppSelector((state) => state.diagram.styleMode);
  const shapeObjs = useAppSelector((state) => state.diagram.shapes);
  const selectedShapeObjs = useAppSelector((state) =>
    selectors.selectedShapeObjs(state.diagram)
  );

  useEffect(() => {
    const isTypingTarget = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return false;
      const tag = target.tagName;
      return (
        target.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const hasPrimaryModifier = event.ctrlKey || event.metaKey;
      const typingTarget = isTypingTarget(event);

      if (event.key === "Escape") {
        event.preventDefault();
        dispatch(diagramActions.onExitEditModePress());
      } else if (event.key === "Enter" && event.metaKey) {
        event.preventDefault();
        dispatch(diagramActions.onCtrlEnterPress());
      } else if (event.key === "Enter" && event.ctrlKey) {
        dispatch(diagramActions.onCtrlEnterPress());
      } else if (event.key === "Enter" && !hasPrimaryModifier && !typingTarget) {
        event.preventDefault();
        dispatch(diagramActions.onEnterPress());
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        !isTypingTarget(event)
      ) {
        if (event.key === "Backspace") event.preventDefault();
        dispatch(diagramActions.onDeletePress());
      } else if (
        (event.key === "a" || event.key === "A") &&
        hasPrimaryModifier &&
        !typingTarget
      ) {
        event.preventDefault();
        dispatch(diagramActions.onCtrlAPress());
      }

      if (shortcutsEnabled && !typingTarget) {
        if (event.key === " " && !hasPrimaryModifier) {
          event.preventDefault();
          dispatch(diagramActions.setTool("SELECT"));
        } else if (
          (event.key === "s" || event.key === "S" || event.key === "v" || event.key === "V") &&
          !hasPrimaryModifier
        ) {
          dispatch(diagramActions.setTool("SELECT"));
        } else if ((event.key === "r" || event.key === "R") && !hasPrimaryModifier) {
          dispatch(diagramActions.setTool("RECTANGLE"));
        } else if ((event.key === "l" || event.key === "L") && !hasPrimaryModifier) {
          dispatch(diagramActions.setTool("LINE"));
          dispatch(
            diagramActions.setStyle({
              style: { arrowStartHead: false, arrowEndHead: false },
            })
          );
        } else if ((event.key === "a" || event.key === "A") && !hasPrimaryModifier) {
          dispatch(diagramActions.setTool("LINE"));
          dispatch(
            diagramActions.setStyle({
              style: { arrowStartHead: false, arrowEndHead: true },
            })
          );
        } else if (
          (event.key === "p" || event.key === "P" || event.key === "w" || event.key === "W") &&
          !hasPrimaryModifier
        ) {
          dispatch(diagramActions.setTool("MULTI_SEGMENT_LINE"));
        } else if ((event.key === "t" || event.key === "T") && !hasPrimaryModifier) {
          dispatch(diagramActions.setTool("TEXT"));
        } else if ((event.key === "x" || event.key === "X") && !hasPrimaryModifier) {
          if (
            selectedShapeObjs.length > 0 &&
            selectedShapeObjs.every((shapeObj) => shapeObj.shape.type === "RECTANGLE")
          ) {
            event.preventDefault();
            const fills = selectedShapeObjs.map(
              (shapeObj) => shapeObj.style?.rectangleFill ?? globalStyle.rectangleFill
            );
            const uniqueFills = Array.from(new Set(fills));
            const nextFill =
              uniqueFills.length === 1
                ? uniqueFills[0] === "SOLID"
                  ? "NONE"
                  : "SOLID"
                : "SOLID";
            dispatch(
              diagramActions.setStyle({
                style: { rectangleFill: nextFill },
                shapeIds: selectedShapeObjs.map((shapeObj) => shapeObj.id),
              })
            );
          }
        } else if (
          (event.key === "c" || event.key === "C") &&
          hasPrimaryModifier &&
          event.shiftKey
        ) {
          event.preventDefault();
          const selectedIdSet = new Set(selectedShapeObjs.map((shapeObj) => shapeObj.id));
          const selectedShapes = shapeObjs.filter((shapeObj) =>
            selectedIdSet.has(shapeObj.id)
          );
          if (selectedShapes.length > 0) {
            const selectionText = getTextExport(
              selectedShapes,
              { styleMode, globalStyle },
              "NONE"
            );
            void navigator.clipboard.writeText(selectionText);
          }
        } else if ((event.key === "c" || event.key === "C") && hasPrimaryModifier) {
          event.preventDefault();
          dispatch(diagramActions.onCopyPress());
        } else if ((event.key === "v" || event.key === "V") && hasPrimaryModifier) {
          event.preventDefault();
          dispatch(diagramActions.onPastePress());
        } else if ((event.key === "z" || event.key === "Z") && hasPrimaryModifier) {
          event.preventDefault();
          if (event.shiftKey) {
            dispatch(diagramActions.moveInHistory("REDO"));
          } else {
            dispatch(diagramActions.moveInHistory("UNDO"));
          }
        } else if ((event.key === "y" || event.key === "Y") && event.ctrlKey) {
          event.preventDefault();
          dispatch(diagramActions.moveInHistory("REDO"));
        }
      }
    };

    const handleKeyUp = (_event: KeyboardEvent) => {};

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    dispatch,
    globalStyle,
    globalStyle.rectangleFill,
    selectedShapeObjs,
    shapeObjs,
    shortcutsEnabled,
    styleMode,
  ]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
        width: "100%",
        background: editorTheme.chrome.background,
        color: editorTheme.chrome.text,
      }}
    >
      <Toolbar leadingContent={toolbarLeading} trailingContent={toolbarTrailing} />
      <Canvas />
    </div>
  );
}

export default App;
