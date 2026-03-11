import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { Tool, diagramActions } from "../../store/diagramSlice";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GitBranch, Minus, MousePointer2, Square, Type } from "lucide-react";

const TOOL_VALUES: Tool[] = [
  "SELECT",
  "RECTANGLE",
  "LINE",
  "MULTI_SEGMENT_LINE",
  "TEXT",
];

function isToolValue(value: string): value is Tool {
  return TOOL_VALUES.includes(value as Tool);
}

export function ToolbarTools() {
  const dispatch = useAppDispatch();

  const selectedTool = useAppSelector((state) => state.diagram.selectedTool);
  const baseToolButtonClass =
    "h-9 w-9 border transition-colors [&_svg]:size-4";
  const toolButtonClass = (tool: Tool) =>
    `${baseToolButtonClass} ${
      selectedTool === tool
        ? "border-sky-300 bg-sky-500 text-white shadow-[0_0_0_1px_rgba(125,211,252,0.95)_inset,0_0_14px_rgba(14,165,233,0.42)]"
        : "border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100"
    }`;

  const handleToolChange = (newTool: string) => {
    if (!isToolValue(newTool) || newTool === selectedTool) {
      return;
    }
    dispatch(diagramActions.setTool(newTool));
  };

  return (
    <ToggleGroup
      type="single"
      value={selectedTool}
      onValueChange={handleToolChange}
      className="gap-1"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem
            value="SELECT"
            aria-label="Select tool"
            variant="default"
            className={toolButtonClass("SELECT")}
          >
            <MousePointer2 />
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>Select (V)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem
            value="RECTANGLE"
            aria-label="Create Rectangle"
            variant="default"
            className={toolButtonClass("RECTANGLE")}
          >
            <Square />
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>Add rectangle (R)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem
            value="LINE"
            aria-label="Create Simple Line"
            variant="default"
            className={toolButtonClass("LINE")}
          >
            <Minus />
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>Add line (L) / arrow (A)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem
            value="MULTI_SEGMENT_LINE"
            aria-label="Create Multi-segment Line"
            variant="default"
            className={toolButtonClass("MULTI_SEGMENT_LINE")}
          >
            <GitBranch />
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>Add multi-segment line (P)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem
            value="TEXT"
            aria-label="Add Text"
            variant="default"
            className={toolButtonClass("TEXT")}
          >
            <Type />
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>Add text (T)</TooltipContent>
      </Tooltip>
    </ToggleGroup>
  );
}
