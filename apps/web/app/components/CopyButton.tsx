"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      style={{
        background: "none",
        border: "1px solid rgba(255,255,255,0.12)",
        color: copied ? "#34d399" : "rgba(255,255,255,0.35)",
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 5,
        cursor: "pointer",
        flexShrink: 0,
        transition: "color 0.15s",
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
