import { useState, useEffect } from "react";
import { readFileContent } from "../api";

export function FileViewer({ path }: { path: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);

    readFileContent(path)
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to read file");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  const lines = content?.split("\n") ?? [];
  const gutterWidth = String(lines.length).length;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "8px 12px",
          fontSize: 12,
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          color: "#374151",
          backgroundColor: "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={path}
      >
        {path} (read-only)
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading && (
          <div style={{ padding: 16, fontSize: 13, color: "#9ca3af" }}>Loading...</div>
        )}
        {error && (
          <div style={{ padding: 16, fontSize: 13, color: "#ef4444" }}>{error}</div>
        )}
        {content !== null && (
          <pre
            style={{
              margin: 0,
              padding: "8px 0",
              fontSize: 12,
              lineHeight: 1.6,
              fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
            }}
          >
            {lines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  padding: "0 12px 0 0",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: `${gutterWidth + 2}ch`,
                    textAlign: "right",
                    paddingRight: 12,
                    paddingLeft: 12,
                    color: "#d1d5db",
                    userSelect: "none",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ whiteSpace: "pre", color: "#1f2937" }}>{line}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
