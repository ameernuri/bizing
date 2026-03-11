import { FooterTip } from "./FooterTip";
import { FooterCanvasSize } from "./FooterCanvasSize";
import { FooterInfo } from "./FooterInfo";
import { FooterHistory } from "./FooterHistory";
import { Separator } from "@/components/ui/separator";
import { editorTheme } from "../../theme";

export function Footer() {
  return (
    <footer
      style={{
        display: "flex",
        alignItems: "center",
        padding: "2px 12px",
        background: editorTheme.chrome.background,
        borderTop: `1px solid ${editorTheme.chrome.border}`,
      }}
    >
      <div
        id="left-footer"
        style={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 12 }}
      >
        <FooterCanvasSize />
        <Separator orientation="vertical" className="h-6 bg-slate-700" />
        <FooterHistory />
        <Separator orientation="vertical" className="h-6 bg-slate-700" />
        <FooterTip />
      </div>
      <div
        id="right-footer"
        style={{ flexGrow: 0, display: "flex", alignItems: "center", gap: 8 }}
      >
        <FooterInfo />
      </div>
    </footer>
  );
}
