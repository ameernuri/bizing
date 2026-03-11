import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { diagramActions } from "../../store/diagramSlice";
import { StyleMode } from "../../models/style";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ToolbarStyleMode() {
  const dispatch = useAppDispatch();

  const styleMode = useAppSelector((state) => state.diagram.styleMode);

  const handleStyleModeChange = (newStyleMode: string) => {
    if (newStyleMode != null && newStyleMode !== styleMode) {
      dispatch(diagramActions.setStyleMode(newStyleMode as StyleMode));
    }
  };

  return (
    <ToggleGroup
      type="single"
      value={styleMode}
      onValueChange={handleStyleModeChange}
      className="gap-1"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem value="ASCII" aria-label="ASCII" variant="outline">
            ASCII
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>
          This mode ensures diagrams are displayed correctly on most monospaced fonts.
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem value="UNICODE" aria-label="Unicode" variant="outline">
            Unicode
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>
          More styling options, but may render differently on some monospaced fonts.
        </TooltipContent>
      </Tooltip>
    </ToggleGroup>
  );
}
