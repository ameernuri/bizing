import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { diagramActions } from "../../store/diagramSlice";
import { Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FooterHistory() {
  const dispatch = useAppDispatch();

  const canUndo = useAppSelector((state) => state.diagram.historyIdx > 0);
  const canRedo = useAppSelector(
    (state) => state.diagram.historyIdx < state.diagram.history.length - 1
  );

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Undo"
            size="icon"
            variant="ghost"
            disabled={!canUndo}
            onClick={() => dispatch(diagramActions.moveInHistory("UNDO"))}
          >
            <Undo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Redo"
            size="icon"
            variant="ghost"
            disabled={!canRedo}
            onClick={() => dispatch(diagramActions.moveInHistory("REDO"))}
          >
            <Redo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
      </Tooltip>
    </div>
  );
}
