import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { appActions } from "../../store/appSlice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RenameDiagramFormDialog() {
  const dispatch = useAppDispatch();

  const renamedDiagramId = useAppSelector(
    (state) => state.app.renameDiagramInProgress
  )!;

  const renamedDiagramName: string = useAppSelector(
    (state) => state.app.diagrams.find((diagram) => diagram.id === renamedDiagramId)!.name
  );

  const confirmRename = (name: string) => {
    dispatch(appActions.renameDiagram({ id: renamedDiagramId, newName: name }));
  };

  const cancelRename = () => {
    dispatch(appActions.cancelRenameDiagram());
  };

  return (
    <Dialog open onOpenChange={(open) => !open && cancelRename()}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const formJson = Object.fromEntries(formData.entries());
            const name = String(formJson.name ?? "");
            confirmRename(name);
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Rename Diagram</DialogTitle>
            <DialogDescription>Type the new diagram name.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="diagram_name">Diagram name</Label>
            <Input
              autoFocus
              required
              id="diagram_name"
              name="name"
              type="text"
              defaultValue={renamedDiagramName}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={cancelRename}>
              Cancel
            </Button>
            <Button type="submit" variant="outline">
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
