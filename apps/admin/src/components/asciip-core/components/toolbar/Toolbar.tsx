import type { ReactNode } from "react";
import { ToolbarTools } from "./ToolbarTools";
import { ToolbarStyleMode } from "./ToolbarStyleMode";

import { ToolbarStyles } from "./ToolbarStyles";
import { ToolbarDiagrams } from "./ToolbarDiagrams";
import { ToolbarExport } from "./ToolbarExport";
import { ToolbarOrder } from "./ToolbarOrder";
import { Separator } from "@/components/ui/separator";
import { editorTheme } from "../../theme";
import { FooterHistory } from "../footer/FooterHistory";
import { FooterCanvasSize } from "../footer/FooterCanvasSize";

export default function Toolbar({
  leadingContent,
  trailingContent,
}: {
  leadingContent?: ReactNode;
  trailingContent?: ReactNode;
}) {
  return (
    <header
      style={{
        borderBottom: `1px solid ${editorTheme.chrome.border}`,
        background: editorTheme.chrome.background,
      }}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div id="left-toolbar" className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          {leadingContent ? (
            <>
              <div className="flex min-w-0 items-center gap-2">{leadingContent}</div>
              <Separator orientation="vertical" className="h-7 bg-slate-700" />
            </>
          ) : null}
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto scrollbar-none">
            <ToolbarTools />
            <Separator orientation="vertical" className="h-7 bg-slate-700" />
            <ToolbarStyles />
            <Separator orientation="vertical" className="h-7 bg-slate-700" />
            <ToolbarStyleMode />
            <Separator orientation="vertical" className="h-7 bg-slate-700" />
            <ToolbarOrder />
          </div>
        </div>
        <div id="right-toolbar" className="flex flex-none items-center gap-2">
          <FooterHistory />
          <Separator orientation="vertical" className="h-7 bg-slate-700" />
          <FooterCanvasSize />
          <Separator orientation="vertical" className="h-7 bg-slate-700" />
          <ToolbarExport />
          <ToolbarDiagrams />
          {trailingContent ? (
            <>
              <Separator orientation="vertical" className="h-7 bg-slate-700" />
              <div className="flex items-center gap-2">{trailingContent}</div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
