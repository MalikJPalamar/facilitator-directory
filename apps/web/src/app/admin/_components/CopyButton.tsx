"use client";

import { useState } from "react";

/**
 * Copy-to-clipboard button used across the admin developer surfaces (keys, MCP
 * config, CLI snippets, webhook URLs). Falls back to a hidden textarea +
 * execCommand when the async Clipboard API isn't available (older/embedded
 * webviews). Style via `className` (defaults to a small outline button) or
 * `style` for placement on dark code blocks.
 */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied ✓",
  className = "btn btn-outline btn-sm",
  style,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button type="button" onClick={copy} className={className} style={style}>
      {copied ? copiedLabel : label}
    </button>
  );
}
