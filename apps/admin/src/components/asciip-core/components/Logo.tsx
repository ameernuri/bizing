import { editorTheme } from "../theme";

export function Logo() {
  return (
    <span
      style={{
        fontFamily: "MartianMono, monospace",
        fontWeight: 600,
        color: editorTheme.chrome.text,
      }}
    >
      AsciiP
    </span>
  );
}
