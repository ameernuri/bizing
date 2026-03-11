import { useAppSelector } from "../../store/hooks";
import { selectors } from "../../store/selectors";
import { Info } from "lucide-react";
import { editorTheme } from "../../theme";
export function FooterTip() {
  const isTextBeingWritten = useAppSelector(
    (state) => selectors.currentEditedText(state.diagram) != null
  );
  const isLineToolSelected = useAppSelector(
    (state) => state.diagram.selectedTool === "LINE"
  );
  const isMultiSegmentLineToolSelected = useAppSelector(
    (state) => state.diagram.selectedTool === "MULTI_SEGMENT_LINE"
  );

  const isSingleTextShapeSelected = useAppSelector(
    (state) =>
      selectors.hasSingleSelectedShape(state.diagram) &&
      selectors.selectedShapeObj(state.diagram)?.shape.type === "TEXT"
  );

  const isSelectToolSelected = useAppSelector(
    (state) => state.diagram.selectedTool === "SELECT"
  );

  const tip: string | null = isTextBeingWritten
    ? "Press Ctrl+Enter to complete editing text."
    : isLineToolSelected
    ? "Click-and-Drag to create a line or arrow."
    : isMultiSegmentLineToolSelected
    ? "Click once, and then click again to position segments. Double-click to finish creating the line."
    : isSingleTextShapeSelected && !isTextBeingWritten
    ? "Double-click to edit text."
    : isSelectToolSelected
    ? "Click to select a shape. Drag or Ctrl+Click to select multiple shapes. Ctrl+A to select all shapes."
    : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: editorTheme.chrome.accentSoft,
      }}
    >
      {tip && (
        <>
          <Info size={14} />
          <span className="text-xs">{tip}</span>
        </>
      )}
    </div>
  );
}
