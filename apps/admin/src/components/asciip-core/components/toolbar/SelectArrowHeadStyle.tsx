import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { ShapeObject, diagramActions } from "../../store/diagramSlice";
import { ARROW_STYLE, arrow_repr } from "../../models/style";
import { selectors } from "../../store/selectors";
import _ from "lodash";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const arrowHeadStyleDisplay: Record<
  ARROW_STYLE,
  {
    name: string;
    repr: string;
  }
> = {
  ASCII: {
    name: "ASCII",
    repr: arrow_repr.ARROW_RIGHT.ASCII,
  },
  FILLED: {
    name: "Filled",
    repr: arrow_repr.ARROW_RIGHT.FILLED,
  },
  OUTLINED: {
    name: "Outlined",
    repr: arrow_repr.ARROW_RIGHT.OUTLINED,
  },
};

export function SelectArrowHeadStyle() {
  const dispatch = useAppDispatch();

  const styleMode = useAppSelector((state) => state.diagram.styleMode);
  const globalStyle = useAppSelector((state) => state.diagram.globalStyle);
  const selectedTool = useAppSelector((state) => state.diagram.selectedTool);
  const selectedShapeObjs: ShapeObject[] = useAppSelector((state) =>
    selectors.selectedShapeObjs(state.diagram)
  );

  const isArrowStyleSelectEnabled = (): boolean => {
    if (styleMode === "ASCII") return false;

    if (selectedTool === "LINE" || selectedTool === "MULTI_SEGMENT_LINE")
      return true;

    if (
      selectedTool === "SELECT" &&
      selectedShapeObjs.length > 0 &&
      selectedShapeObjs.every(
        (shapeObj) =>
          shapeObj.shape.type === "LINE" ||
          shapeObj.shape.type === "MULTI_SEGMENT_LINE"
      )
    )
      return true;

    return false;
  };

  const handleArrowStyleChange = (value: string) => {
    const shapeIds: string[] | undefined =
      selectedShapeObjs.length === 0
        ? undefined
        : selectedShapeObjs.map((shapeObj) => shapeObj.id);

    dispatch(
      diagramActions.setStyle({
        style: { arrowStyle: value as ARROW_STYLE },
        shapeIds,
      })
    );
  };

  const getValue = (): ARROW_STYLE | undefined => {
    if (selectedShapeObjs.length === 0) {
      return globalStyle.arrowStyle;
    }

    const values = selectedShapeObjs.map(
      (shapeObj) => shapeObj?.style?.arrowStyle ?? globalStyle.arrowStyle
    );

    if (_.uniq(values).length === 1) {
      return values[0];
    }
    return undefined;
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-300">Head</span>
      <Select
        value={getValue()}
        onValueChange={handleArrowStyleChange}
        disabled={!isArrowStyleSelectEnabled()}
      >
        <SelectTrigger className="h-8 w-[130px]">
          <SelectValue placeholder="Mixed" />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(arrowHeadStyleDisplay).map((value) => (
            <SelectItem key={value} value={value}>
              <span className="flex w-full items-center justify-between gap-4">
                <span>{arrowHeadStyleDisplay[value as ARROW_STYLE].name}</span>
                <span className="font-mono">
                  {arrowHeadStyleDisplay[value as ARROW_STYLE].repr}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
