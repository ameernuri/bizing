import { useAppDispatch } from "../../store/hooks";
import { diagramActions } from "../../store/diagramSlice";
import { Expand, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FooterCanvasSize() {
  const dispatch = useAppDispatch();

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="expand canvas"
            size="icon"
            variant="ghost"
            onClick={() => dispatch(diagramActions.expandCanvas())}
          >
            <Expand />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Expand canvas</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Shrink canvas to fit"
            size="icon"
            variant="ghost"
            onClick={() => dispatch(diagramActions.shrinkCanvasToFit())}
          >
            <Minimize2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Shrink canvas to fit</TooltipContent>
      </Tooltip>
    </div>
  );
}
