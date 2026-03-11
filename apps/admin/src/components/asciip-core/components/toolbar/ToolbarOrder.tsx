import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { diagramActions } from "../../store/diagramSlice";
import { selectors } from "../../store/selectors";
import { BringToFront, SendToBack } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ToolbarOrder() {
  const dispatch = useAppDispatch();

  const hasSingleSelection = useAppSelector((state) =>
    selectors.hasSingleSelectedShape(state.diagram)
  );

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="push to back"
            size="icon"
            variant="ghost"
            disabled={!hasSingleSelection}
            onClick={() => dispatch(diagramActions.onMoveToBackButtonClick())}
          >
            <SendToBack />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Push shape to back.</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="bring to front"
            size="icon"
            variant="ghost"
            disabled={!hasSingleSelection}
            onClick={() => dispatch(diagramActions.onMoveToFrontButtonClick())}
          >
            <BringToFront />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Bring shape to front.</TooltipContent>
      </Tooltip>
    </div>
  );
}
