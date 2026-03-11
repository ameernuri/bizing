import _ from "lodash";
import {
  AlignCenter,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  AlignEndVertical,
  AlignStartVertical,
  Minus,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { ShapeObject, diagramActions } from "../../store/diagramSlice";
import { selectors } from "../../store/selectors";
import {
  RECTANGLE_TEXT_ALIGN_H,
  RECTANGLE_TEXT_ALIGN_V,
  Style,
} from "../../models/style";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function RectangleTextFloatingControls() {
  const dispatch = useAppDispatch();

  const selectedTool = useAppSelector((state) => state.diagram.selectedTool);
  const globalStyle = useAppSelector((state) => state.diagram.globalStyle);
  const selectedShapeObjs: ShapeObject[] = useAppSelector((state) =>
    selectors.selectedShapeObjs(state.diagram)
  );

  const rectangleShapeObjs = selectedShapeObjs.filter(
    (shapeObj) => shapeObj.shape.type === "RECTANGLE"
  );
  const shouldShow =
    selectedTool === "RECTANGLE" || rectangleShapeObjs.length > 0;

  if (!shouldShow) {
    return null;
  }

  const shapeIds: string[] | undefined =
    selectedShapeObjs.length > 0
      ? selectedShapeObjs.map((shapeObj) => shapeObj.id)
      : undefined;

  const resolveStyleValue = <T extends keyof Style>(key: T): Style[T] | undefined => {
    if (rectangleShapeObjs.length === 0) {
      return globalStyle[key];
    }
    const values = rectangleShapeObjs.map(
      (shapeObj) => (shapeObj.style?.[key] ?? globalStyle[key]) as Style[T]
    );
    const unique = _.uniq(values);
    return unique.length === 1 ? unique[0] : undefined;
  };

  const alignH = resolveStyleValue("rectangleTextAlignH") as
    | RECTANGLE_TEXT_ALIGN_H
    | undefined;
  const alignV = resolveStyleValue("rectangleTextAlignV") as
    | RECTANGLE_TEXT_ALIGN_V
    | undefined;
  const overflow = resolveStyleValue("rectangleTextOverflow");
  const padding = resolveStyleValue("rectangleTextPadding");
  const basePadding = Math.max(
    0,
    Math.floor(
      Number.isFinite(Number(padding))
        ? Number(padding)
        : Number(globalStyle.rectangleTextPadding ?? 1)
    )
  );
  const isTruncate = overflow !== "HIDE";
  const displayedPadding = padding == null ? "—" : String(basePadding);

  const setPadding = (value: number) => {
    const clamped = Math.max(0, Math.min(8, Math.floor(value)));
    dispatch(
      diagramActions.setStyle({
        style: { rectangleTextPadding: clamped },
        shapeIds,
      })
    );
  };

  return (
    <div className="pointer-events-auto rounded-xl border bg-background px-2 py-1.5 shadow-sm">
      <div className="flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={alignH}
          onValueChange={(value) => {
            if (!value) return;
            dispatch(
              diagramActions.setStyle({
                style: { rectangleTextAlignH: value as RECTANGLE_TEXT_ALIGN_H },
                shapeIds,
              })
            );
          }}
          className="gap-1"
        >
          <ToggleGroupItem
            value="LEFT"
            size="sm"
            variant="outline"
            aria-label="Align left"
            className="h-8 w-8 p-0"
          >
            <AlignLeft />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="CENTER"
            size="sm"
            variant="outline"
            aria-label="Align center"
            className="h-8 w-8 p-0"
          >
            <AlignCenter />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="RIGHT"
            size="sm"
            variant="outline"
            aria-label="Align right"
            className="h-8 w-8 p-0"
          >
            <AlignRight />
          </ToggleGroupItem>
        </ToggleGroup>

        <Separator orientation="vertical" className="h-6" />

        <ToggleGroup
          type="single"
          value={alignV}
          onValueChange={(value) => {
            if (!value) return;
            dispatch(
              diagramActions.setStyle({
                style: { rectangleTextAlignV: value as RECTANGLE_TEXT_ALIGN_V },
                shapeIds,
              })
            );
          }}
          className="gap-1"
        >
          <ToggleGroupItem
            value="TOP"
            size="sm"
            variant="outline"
            aria-label="Align top"
            className="h-8 w-8 p-0"
          >
            <AlignStartVertical />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="MIDDLE"
            size="sm"
            variant="outline"
            aria-label="Align middle"
            className="h-8 w-8 p-0"
          >
            <AlignCenterVertical />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="BOTTOM"
            size="sm"
            variant="outline"
            aria-label="Align bottom"
            className="h-8 w-8 p-0"
          >
            <AlignEndVertical />
          </ToggleGroupItem>
        </ToggleGroup>

        <Toggle
          variant="outline"
          size="sm"
          pressed={isTruncate}
          aria-label="Toggle truncate overflow"
          className="h-8 min-w-8 px-2 text-base leading-none"
          onPressedChange={(pressed) => {
            dispatch(
              diagramActions.setStyle({
                style: {
                  rectangleTextOverflow: pressed ? "TRUNCATE" : "HIDE",
                },
                shapeIds,
              })
            );
          }}
        >
          <MoreHorizontal />
        </Toggle>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center rounded-md border border-input bg-background shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-r-none px-0"
            aria-label="Decrease text padding"
            onClick={() => setPadding(basePadding - 1)}
          >
            <Minus />
          </Button>
          <div className="min-w-10 px-2 text-center text-xs font-medium tabular-nums">
            {displayedPadding}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-l-none px-0"
            aria-label="Increase text padding"
            onClick={() => setPadding(basePadding + 1)}
          >
            <Plus />
          </Button>
        </div>
      </div>
    </div>
  );
}
