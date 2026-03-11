import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { ShapeObject, diagramActions } from "../../store/diagramSlice";
import { LINE_STYLE, Style, line_repr, resolveRectangleBorder } from "../../models/style";
import { selectors } from "../../store/selectors";
import _ from "lodash";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const lineStyleDisplay: Record<
  LINE_STYLE,
  {
    name: string;
    repr: string;
  }
> = {
  ASCII: {
    name: "ASCII",
    repr: `${line_repr.LINE_HORIZONTAL.ASCII}${line_repr.LINE_HORIZONTAL.ASCII}${line_repr.CORNER_TR.ASCII}`,
  },
  LIGHT: {
    name: "Light",
    repr: `${line_repr.LINE_HORIZONTAL.LIGHT}${line_repr.LINE_HORIZONTAL.LIGHT}${line_repr.CORNER_TR.LIGHT}`,
  },
  LIGHT_ROUNDED: {
    name: "Light rounded",
    repr: `${line_repr.LINE_HORIZONTAL.LIGHT_ROUNDED}${line_repr.LINE_HORIZONTAL.LIGHT_ROUNDED}${line_repr.CORNER_TR.LIGHT_ROUNDED}`,
  },
  HEAVY: {
    name: "Heavy",
    repr: `${line_repr.LINE_HORIZONTAL.HEAVY}${line_repr.LINE_HORIZONTAL.HEAVY}${line_repr.CORNER_TR.HEAVY}`,
  },
  DOUBLE: {
    name: "Double",
    repr: `${line_repr.LINE_HORIZONTAL.DOUBLE}${line_repr.LINE_HORIZONTAL.DOUBLE}${line_repr.CORNER_TR.DOUBLE}`,
  },
};

type LineSelectorValue = LINE_STYLE | "NONE";

export function SelectLineStyle() {
  const dispatch = useAppDispatch();

  const styleMode = useAppSelector((state) => state.diagram.styleMode);
  const globalStyle = useAppSelector((state) => state.diagram.globalStyle);
  const selectedTool = useAppSelector((state) => state.diagram.selectedTool);
  const selectedShapeObjs: ShapeObject[] = useAppSelector((state) =>
    selectors.selectedShapeObjs(state.diagram)
  );

  const hasRectangleContext = (): boolean =>
    selectedTool === "RECTANGLE" ||
    (selectedTool === "SELECT" &&
      selectedShapeObjs.some((shapeObj) => shapeObj.shape.type === "RECTANGLE"));

  const isLineStyleSelectEnabled = (): boolean => {
    if (styleMode === "ASCII") return false;

    if (
      selectedTool === "RECTANGLE" ||
      selectedTool === "LINE" ||
      selectedTool === "MULTI_SEGMENT_LINE"
    )
      return true;

    if (
      selectedTool === "SELECT" &&
      selectedShapeObjs.length > 0 &&
      selectedShapeObjs.every(
        (shapeObj) =>
          shapeObj.shape.type === "RECTANGLE" ||
          shapeObj.shape.type === "LINE" ||
          shapeObj.shape.type === "MULTI_SEGMENT_LINE"
      )
    )
      return true;

    return false;
  };

  const handleLineStyleChange = (value: string) => {
    const shapeIds: string[] | undefined =
      selectedShapeObjs.length === 0
        ? undefined
        : selectedShapeObjs.map((shapeObj) => shapeObj.id);

    if (hasRectangleContext() && value === "NONE") {
      dispatch(
        diagramActions.setStyle({
          style: { rectangleBorder: "NONE" },
          shapeIds,
        })
      );
      return;
    }

    const lineStyle = value as LINE_STYLE;
    const stylePatch = hasRectangleContext()
      ? { lineStyle, rectangleBorder: "LINE" as const }
      : { lineStyle };

    dispatch(
      diagramActions.setStyle({
        style: stylePatch,
        shapeIds,
      })
    );
  };

  const getValue = (): LineSelectorValue | undefined => {
    if (hasRectangleContext()) {
      if (selectedShapeObjs.length === 0) {
        return resolveRectangleBorder(globalStyle) === "NONE"
          ? "NONE"
          : globalStyle.lineStyle;
      }

      const values = selectedShapeObjs.map((shapeObj) => {
        const style: Style = {
          ...globalStyle,
          ...(shapeObj.style ?? {}),
        };
        return shapeObj.shape.type === "RECTANGLE" &&
          resolveRectangleBorder(style) === "NONE"
          ? "NONE"
          : style.lineStyle;
      });

      if (_.uniq(values).length === 1) {
        return values[0];
      }
      return undefined;
    }

    if (selectedShapeObjs.length === 0) {
      return globalStyle.lineStyle;
    }

    const values = selectedShapeObjs.map(
      (shapeObj) => shapeObj?.style?.lineStyle ?? globalStyle.lineStyle
    );

    if (_.uniq(values).length === 1) {
      return values[0];
    }
    return undefined;
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-300">Line</span>
      <Select
        value={getValue()}
        onValueChange={handleLineStyleChange}
        disabled={!isLineStyleSelectEnabled()}
      >
        <SelectTrigger className="h-8 w-[150px]">
          <SelectValue placeholder="Mixed" />
        </SelectTrigger>
        <SelectContent>
          {hasRectangleContext() && <SelectItem value="NONE">None</SelectItem>}
          {Object.keys(lineStyleDisplay).map((value) => (
            <SelectItem key={value} value={value}>
              <span className="flex w-full items-center justify-between gap-4">
                <span>{lineStyleDisplay[value as LINE_STYLE].name}</span>
                <span className="font-mono">
                  {lineStyleDisplay[value as LINE_STYLE].repr}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
