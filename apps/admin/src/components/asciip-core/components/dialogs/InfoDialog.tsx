import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InfoDialogProps = {
  onClose: () => void;
};

export function InfoDialog({ onClose }: InfoDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Canvascii</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Canvascii is a client-side ASCII diagram editor for fast sketches,
                flows, and system maps without leaving plain text.
              </p>
              <div>
                This app was inspired in large part by the following tools:
                <ul className="list-disc pl-5 pt-1">
                  <li>
                    <a
                      href="https://asciiflow.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 underline"
                    >
                      ASCIIFlow
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://textik.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 underline"
                    >
                      Textik
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
