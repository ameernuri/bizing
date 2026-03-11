import { useState } from "react";
import { InfoDialog } from "../dialogs/InfoDialog";
import { Github, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FooterInfo() {
  const [infoDialogOpen, setInfoDialogOpen] = useState<boolean>(false);

  return (
    <>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="info"
              size="icon"
              variant="ghost"
              onClick={() => setInfoDialogOpen(true)}
            >
              <Info />
            </Button>
          </TooltipTrigger>
          <TooltipContent>What is this?</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="View GitHub repo"
              size="icon"
              variant="ghost"
              onClick={() =>
                window.open("https://github.com/hhourani27/asciip", "_blank")
              }
            >
              <Github />
            </Button>
          </TooltipTrigger>
          <TooltipContent>View GitHub repo</TooltipContent>
        </Tooltip>
      </div>
      {infoDialogOpen && (
        <InfoDialog onClose={() => setInfoDialogOpen(false)} />
      )}
    </>
  );
}
