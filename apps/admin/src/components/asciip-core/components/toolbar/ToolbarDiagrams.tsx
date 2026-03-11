import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { appActions, appSelectors } from "../../store/appSlice";
import { PlusSquare, ChevronDown, Trash2, Workflow, Pencil } from "lucide-react";
import { DeleteDiagramConfirmationDialog } from "../dialogs/DeleteDiagramConfirmationDialog";
import { CreateDiagramFormDialog } from "../dialogs/CreateDiagramFormDialog";
import { RenameDiagramFormDialog } from "../dialogs/RenameDiagramFormDialog";

export function ToolbarDiagrams() {
  const dispatch = useAppDispatch();

  const diagrams = useAppSelector((state) => state.app.diagrams);
  const activeDiagram = useAppSelector((state) =>
    appSelectors.activeDiagram(state)
  );
  const deleteDiagramInProgress = useAppSelector(
    (state) => state.app.deleteDiagramInProgress
  );
  const renameDiagramInProgress = useAppSelector(
    (state) => state.app.renameDiagramInProgress
  );
  const createDiagramInProgress = useAppSelector(
    (state) => state.app.createDiagramInProgress
  );

  const handleDiagramClick = (diagramId: string): void => {
    if (diagramId !== activeDiagram.id) {
      dispatch(appActions.setActiveDiagram(diagramId));
    }
  };

  const handleCreateDiagram = () => {
    dispatch(appActions.startCreateDiagram());
  };

  const handleDeleteDiagram = (diagramId: string) => {
    dispatch(appActions.startDeleteDiagram(diagramId));
  };

  const handleRenameDiagram = (diagramId: string) => {
    dispatch(appActions.startRenameDiagram(diagramId));
  };

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id="diagram-list"
            variant="ghost"
            className="gap-1 font-normal capitalize text-slate-100 hover:bg-slate-800 hover:text-slate-100"
          >
            {activeDiagram.name}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[280px]">
          {diagrams.map((diagram) => (
            <DropdownMenuItem
              key={diagram.id}
              className="flex items-center justify-between gap-2"
              onSelect={() => handleDiagramClick(diagram.id)}
            >
              <span className="flex items-center gap-2">
                <Workflow className="h-4 w-4" />
                <span>{diagram.name}</span>
              </span>
              <ButtonGroup className="rounded-md border border-border/60 bg-background/70">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRenameDiagram(diagram.id);
                  }}
                  aria-label={`Rename ${diagram.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteDiagram(diagram.id);
                  }}
                  aria-label={`Delete ${diagram.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </ButtonGroup>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleCreateDiagram}>
            <PlusSquare className="h-4 w-4" />
            <span>Create new diagram</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {createDiagramInProgress && <CreateDiagramFormDialog />}
      {renameDiagramInProgress && <RenameDiagramFormDialog />}
      {deleteDiagramInProgress && <DeleteDiagramConfirmationDialog />}
    </div>
  );
}
