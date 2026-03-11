import { useAppDispatch } from "../../store/hooks";
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

export function CreateDiagramFormDialog() {
  const dispatch = useAppDispatch();

  const confirmCreate = (name: string) => {
    dispatch(appActions.createDiagram(name));
  };

  const cancelCreate = () => {
    dispatch(appActions.cancelCreateDiagram());
  };

  return (
    <Dialog open onOpenChange={(open) => !open && cancelCreate()}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const formJson = Object.fromEntries(formData.entries());
            const name = String(formJson.name ?? "");
            confirmCreate(name);
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>New Diagram</DialogTitle>
            <DialogDescription>Choose the diagram name.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="diagram_name">Diagram name</Label>
            <Input autoFocus required id="diagram_name" name="name" type="text" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={cancelCreate}>
              Cancel
            </Button>
            <Button type="submit" variant="outline">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
