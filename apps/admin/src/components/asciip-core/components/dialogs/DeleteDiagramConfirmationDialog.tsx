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

export function DeleteDiagramConfirmationDialog() {
  const dispatch = useAppDispatch();

  const deletedDiagramId: string = useAppSelector(
    (state) => state.app.deleteDiagramInProgress!
  );
  const deletedDiagramName: string = useAppSelector(
    (state) => state.app.diagrams.find((diagram) => diagram.id === deletedDiagramId)!.name
  );

  const confirmDelete = () => {
    dispatch(appActions.deleteDiagram(deletedDiagramId));
  };

  const cancelDelete = () => {
    dispatch(appActions.cancelDeleteDiagram());
  };

  return (
    <Dialog open onOpenChange={(open) => !open && cancelDelete()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Delete Diagram "${deletedDiagramName}"`}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this diagram?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={cancelDelete} variant="ghost">
            Cancel
          </Button>
          <Button onClick={confirmDelete} variant="destructive" autoFocus>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
