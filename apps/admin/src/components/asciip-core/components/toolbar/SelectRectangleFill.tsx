import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { ShapeObject, diagramActions } from "../../store/diagramSlice";
import { RECTANGLE_FILL } from "../../models/style";
import { selectors } from "../../store/selectors";
import _ from "lodash";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SelectRectangleFill() {
  const dispatch = useAppDispatch();

  const globalStyle = useAppSelector((state) => state.diagram.globalStyle);
  const selectedTool = useAppSelector((state) => state.diagram.selectedTool);
  const selectedShapeObjs: ShapeObject[] = useAppSelector((state) =>
    selectors.selectedShapeObjs(state.diagram)
  );

  const isRectangleFillSelectEnabled = (): boolean => {
    if (selectedTool === "RECTANGLE") return true;

    if (
      selectedTool === "SELECT" &&
      selectedShapeObjs.length > 0 &&
      selectedShapeObjs.every((s) => s.shape.type === "RECTANGLE")
    ) {
      return true;
    }

    return false;
  };

  const handleRectangleFillChange = (value: string) => {
    const shapeIds: string[] | undefined =
      selectedShapeObjs.length === 0
        ? undefined
        : selectedShapeObjs.map((shapeObj) => shapeObj.id);

    dispatch(
      diagramActions.setStyle({
        style: { rectangleFill: value as RECTANGLE_FILL },
        shapeIds,
      })
    );
  };

  const getValue = (): RECTANGLE_FILL | undefined => {
    if (selectedShapeObjs.length === 0) {
      return globalStyle.rectangleFill;
    }

    const values = selectedShapeObjs.map(
      (shapeObj) => shapeObj?.style?.rectangleFill ?? globalStyle.rectangleFill
    );

    if (_.uniq(values).length === 1) {
      return values[0];
    }
    return undefined;
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-300">Fill</span>
      <Select
        value={getValue()}
        onValueChange={handleRectangleFillChange}
        disabled={!isRectangleFillSelectEnabled()}
      >
        <SelectTrigger className="h-8 w-[110px]">
          <SelectValue placeholder="Mixed" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NONE">None</SelectItem>
          <SelectItem value="SOLID">Solid</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
