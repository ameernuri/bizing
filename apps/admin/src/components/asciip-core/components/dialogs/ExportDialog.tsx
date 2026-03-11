import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { diagramActions } from "../../store/diagramSlice";
import { FONT_FAMILY } from "../canvas/draw";
import { COMMENT_STYLE, getTextExport } from "../../models/representation";
import { useState } from "react";
import { Copy } from "lucide-react";
import { editorTheme } from "../../theme";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const commentStyleDisplay: Record<
  COMMENT_STYLE,
  {
    name: string;
    example?: string;
    languages?: string;
  }
> = {
  NONE: { name: "None" },
  STANDARD_BLOCK: {
    name: "Standard block comment",
    example: "/* ~ */",
    languages: "Many C-style languages, CSS, Kotlin, Scala...",
  },
  STANDARD_BLOCK_ASTERISK: {
    name: "Asterisk-aligned block comment",
    example: "/* * */",
    languages: "Many C-style languages, CSS, Kotlin, Scala...",
  },
  SLASHES: {
    name: "Slashes",
    example: "//",
    languages: "Many C-style languages, Kotlin, Scala...",
  },
  HASHES: {
    name: "Hashes",
    example: "#",
    languages: "Python, Ruby, PHP, PowerShell...",
  },
  TRIPLE_QUOTES: {
    name: "Triple quote",
    example: `""" ~ """`,
    languages: "Python, Julia...",
  },
  TRIPLE_SLASH: {
    name: "Triple slash",
    example: "///",
    languages: "C#, F#",
  },
  DOUBLE_DASH: {
    name: "Double dash",
    example: "--",
    languages: "SQL, Haskell, Ada, Lua, VHDL...",
  },
  APOSTROPHE: {
    name: "Apostrophe",
    example: "'",
    languages: "Visual Basic family...",
  },
  TRIPLE_BACKTICK: {
    name: "Triple backticks",
    example: "``` ~ ```",
    languages: "Markdown",
  },
  FOUR_SPACES: {
    name: "Four spaces",
    example: "\u00a0\u00a0\u00a0\u00a0",
    languages: "Markdown",
  },
  SEMI_COLON: {
    name: "Semi-colon",
    example: ";",
    languages: "Lua, Scheme, Assembly...",
  },
  PERCENT: {
    name: "Percent",
    example: "%",
    languages: "TeX, LaTeX, PostScript, Erlang...",
  },
};

export function ExportDialog() {
  const dispatch = useAppDispatch();

  const exportInProgress = useAppSelector(
    (state) => state.diagram.exportInProgress
  );

  const shapeObjs = useAppSelector((state) => state.diagram.shapes);
  const styleMode = useAppSelector((state) => state.diagram.styleMode);
  const globalStyle = useAppSelector((state) => state.diagram.globalStyle);

  const [commentStyle, setCommentStyle] =
    useState<COMMENT_STYLE>("STANDARD_BLOCK");

  const exportText = getTextExport(
    shapeObjs,
    {
      styleMode,
      globalStyle,
    },
    commentStyle
  );

  const copyDiagramToClipboard = async () => {
    await navigator.clipboard.writeText(exportText);
  };

  return (
    <Dialog
      open={exportInProgress}
      onOpenChange={(open) => !open && dispatch(diagramActions.closeExport())}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Export diagram</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-start gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Comment style</span>
            <Select
              value={commentStyle}
              onValueChange={(value) => setCommentStyle(value as COMMENT_STYLE)}
            >
              <SelectTrigger className="h-8 w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(commentStyleDisplay).map((value) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex w-full flex-col">
                      <span className="flex items-center gap-2">
                        <span>{commentStyleDisplay[value as COMMENT_STYLE].name}</span>
                        {commentStyleDisplay[value as COMMENT_STYLE].example && (
                          <code className="rounded border px-1.5 py-0.5 text-xs">
                            {commentStyleDisplay[value as COMMENT_STYLE].example}
                          </code>
                        )}
                      </span>
                      {commentStyleDisplay[value as COMMENT_STYLE].languages && (
                        <span className="text-xs text-slate-400">
                          {commentStyleDisplay[value as COMMENT_STYLE].languages}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: "12px",
              lineHeight: 1.25,
              maxWidth: "50vw",
              maxHeight: "50vh",
              overflow: "auto",
              whiteSpace: "pre",
              padding: "8px",
              backgroundColor: editorTheme.canvas.background,
              color: editorTheme.canvas.shape,
              scrollbarColor: `${editorTheme.chrome.accentSoft} ${editorTheme.chrome.background}`,
              scrollbarWidth: "thin",
              borderRadius: "6px",
              border: `1px solid ${editorTheme.chrome.border}`,
            }}
          >
            {exportText}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={copyDiagramToClipboard} variant="outline">
            <Copy />
            Copy diagram
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
