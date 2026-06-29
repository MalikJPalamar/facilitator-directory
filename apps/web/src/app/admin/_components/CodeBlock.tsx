"use client";

import { CopyButton } from "./CopyButton.tsx";

/**
 * Dark, monospaced code block with a built-in copy button and optional language
 * tag. Used for the connect/MCP/CLI snippets in the developer surfaces. Styling
 * keys off the design tokens so it stays consistent without touching globals.
 */
export function CodeBlock({
  code,
  lang,
}: {
  code: string;
  lang?: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: "var(--color-ink)",
        color: "#e6edf3",
        borderRadius: "var(--radius)",
        padding: "var(--space-5)",
        paddingTop: lang ? "var(--space-6)" : "var(--space-5)",
        overflowX: "auto",
        border: "1px solid var(--color-border)",
      }}
    >
      {lang && (
        <span
          style={{
            position: "absolute",
            top: 8,
            left: 14,
            fontSize: "0.68rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)",
            fontWeight: 600,
          }}
        >
          {lang}
        </span>
      )}
      <CopyButton
        value={code}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "rgba(255,255,255,0.1)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "var(--radius-pill)",
          padding: "5px 12px",
          fontSize: "var(--fs-xs)",
          fontWeight: 590,
          cursor: "pointer",
        }}
        className=""
      />
      <pre
        style={{
          margin: 0,
          whiteSpace: "pre",
          fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
          fontSize: "0.82rem",
          lineHeight: 1.65,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
