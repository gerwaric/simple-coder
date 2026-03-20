import type { Message } from "@simple-coder/shared";

export function ToolResultMessage({ message }: { message: Message }) {
  const toolName = message.toolName || "unknown";
  const content = message.content || "";
  const isError = content.startsWith("Error:") || content.startsWith("error:");

  if (isError) {
    return (
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>
          Result: {toolName}
        </div>
        <pre
          style={{
            margin: 0,
            padding: "6px 8px",
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {content}
        </pre>
      </div>
    );
  }

  if (toolName === "bash") {
    return (
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>
          Output
        </div>
        <pre
          style={{
            margin: 0,
            padding: "6px 8px",
            backgroundColor: "#1e1e1e",
            color: "#d4d4d4",
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {content}
        </pre>
      </div>
    );
  }

  if (toolName === "read_file") {
    return (
      <div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>
          File contents
        </div>
        <pre
          style={{
            margin: 0,
            padding: "6px 8px",
            backgroundColor: "#f8f8f8",
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {content}
        </pre>
      </div>
    );
  }

  if (toolName === "context") {
    return (
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        Context: {content}
      </div>
    );
  }

  // Generic fallback
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>
        Result: {toolName}
      </div>
      <pre
        style={{
          margin: 0,
          padding: "6px 8px",
          backgroundColor: "#f8f8f8",
          borderRadius: 4,
          fontSize: 12,
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 300,
          overflowY: "auto",
        }}
      >
        {content}
      </pre>
    </div>
  );
}
