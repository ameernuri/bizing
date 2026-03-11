import { useAppSelector } from "../../store/hooks";
import { SelectLineStyle } from "./SelectLineStyle";
import { SelectArrowHead } from "./SelectArrowHead";
import { SelectArrowHeadStyle } from "./SelectArrowHeadStyle";
import { SelectRectangleFill } from "./SelectRectangleFill";

export function ToolbarStyles() {
  const styleMode = useAppSelector((state) => state.diagram.styleMode);

  return (
    <div className="flex items-center gap-2">
      {/* Line style*/}
      {styleMode === "UNICODE" && <SelectLineStyle />}
      {/* Arrow head presence/absence */}
      <SelectArrowHead />
      {/* Arrow head style*/}
      {styleMode === "UNICODE" && <SelectArrowHeadStyle />}
      <SelectRectangleFill />
    </div>
  );
}
