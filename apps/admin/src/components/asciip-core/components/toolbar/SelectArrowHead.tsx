import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { ShapeObject, diagramActions } from "../../store/diagramSlice";
import { Style } from "../../models/style";
import { selectors } from "../../store/selectors";
import _ from "lodash";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ArrowHeadValue = "NONE" | "END" | "START" | "START_END";

export function SelectArrowHead() {
  const dispatch = useAppDispatch();

  const globalStyle = useAppSelector((state) => state.diagram.globalStyle);
  const selectedTool = useAppSelector((state) => state.diagram.selectedTool);
  const selectedShapeObjs: ShapeObject[] = useAppSelector((state) =>
    selectors.selectedShapeObjs(state.diagram)
  );

  const isArrowHeadSelectEnabled = (): boolean => {
    if (selectedTool === "LINE" || selectedTool === "MULTI_SEGMENT_LINE")
      return true;

    if (
      selectedTool === "SELECT" &&
      selectedShapeObjs.length > 0 &&
      selectedShapeObjs.every(
        (s) => s.shape.type === "LINE" || s.shape.type === "MULTI_SEGMENT_LINE"
      )
    )
      return true;

    return false;
  };

  const handleArrowHeadStyleChange = (value: string) => {
    const shapeIds: string[] | undefined =
      selectedShapeObjs.length === 0
        ? undefined
        : selectedShapeObjs.map((shapeObj) => shapeObj.id);

    const resolved =
      value === "START_END"
        ? { arrowStartHead: true, arrowEndHead: true }
        : value === "START"
        ? { arrowStartHead: true, arrowEndHead: false }
        : value === "END"
        ? { arrowStartHead: false, arrowEndHead: true }
        : { arrowStartHead: false, arrowEndHead: false };

    dispatch(
      diagramActions.setStyle({
        style: resolved,
        shapeIds,
      })
    );
  };

  const getArrowHeadSelectValue = (style: Partial<Style>): ArrowHeadValue => {
    if (style.arrowEndHead && style.arrowStartHead) return "START_END";
    if (style.arrowEndHead && !style.arrowStartHead) return "END";
    if (!style.arrowEndHead && style.arrowStartHead) return "START";
    return "NONE";
  };

  const getValue = (): ArrowHeadValue | undefined => {
    if (selectedShapeObjs.length === 0) {
      return getArrowHeadSelectValue(globalStyle);
    }

    const values = selectedShapeObjs.map((shapeObj) =>
      shapeObj.style?.arrowStartHead !== undefined &&
      shapeObj.style?.arrowEndHead !== undefined
        ? getArrowHeadSelectValue(shapeObj.style)
        : getArrowHeadSelectValue(globalStyle)
    );

    if (_.uniq(values).length === 1) {
      return values[0];
    }
    return undefined;
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-300">Arrow</span>
      <Select
        value={getValue()}
        onValueChange={handleArrowHeadStyleChange}
        disabled={!isArrowHeadSelectEnabled()}
      >
        <SelectTrigger className="h-8 w-[120px]">
          <SelectValue placeholder="Mixed" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NONE">‒ ― ‒</SelectItem>
          <SelectItem value="END">‒ ― ▶</SelectItem>
          <SelectItem value="START">◀ ― ‒</SelectItem>
          <SelectItem value="START_END">◀ ― ▶</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
