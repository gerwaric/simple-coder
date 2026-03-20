import type { Message } from "@simple-coder/shared";
import { ApprovalPrompt } from "./ApprovalPrompt";
import { AskHumanPrompt } from "./AskHumanPrompt";

function formatArgs(toolName: string, args: Record<string, unknown> | null): JSX.Element {
  if (!args) return <span>No arguments</span>;

  if (toolName === "bash") {
    return (
      <pre
        style={{
          margin: "4px 0 0",
          padding: "6px 8px",
          backgroundColor: "#1e1e1e",
          color: "#d4d4d4",
          borderRadius: 4,
          fontSize: 12,
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowX: "auto",
        }}
      >
        $ {String(args.command || "")}
      </pre>
    );
  }

  if (toolName === "read_file") {
    return <code style={{ fontSize: 12 }}>{String(args.path || args.filePath || "")}</code>;
  }

  if (toolName === "write_file") {
    const path = String(args.path || args.filePath || "");
    const content = String(args.content || "");
    const truncated = content.length > 200 ? content.slice(0, 200) + "..." : content;
    return (
      <div>
        <code style={{ fontSize: 12 }}>{path}</code>
        <pre
          style={{
            margin: "4px 0 0",
            padding: "6px 8px",
            backgroundColor: "#f8f8f8",
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 120,
            overflowY: "auto",
          }}
        >
          {truncated}
        </pre>
      </div>
    );
  }

  if (toolName === "context") {
    return (
      <span style={{ fontSize: 12 }}>
        {String(args.action || "")} — {JSON.stringify(args.messageIds || args.summaryId || "")}
      </span>
    );
  }

  if (toolName === "ask_human") {
    return (
      <div
        style={{
          marginTop: 4,
          padding: "6px 8px",
          backgroundColor: "#fef3c7",
          borderRadius: 4,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {String(args.question || args.message || "")}
      </div>
    );
  }

  // Generic fallback
  return (
    <pre
      style={{
        margin: "4px 0 0",
        padding: "6px 8px",
        backgroundColor: "#f8f8f8",
        borderRadius: 4,
        fontSize: 12,
        fontFamily: "monospace",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {JSON.stringify(args, null, 2)}
    </pre>
  );
}

export function ToolCallMessage({ message }: { message: Message }) {
  const toolName = message.toolName || "unknown";
  const isPending = message.approvalStatus === "pending";
  const needsApproval = isPending && (toolName === "bash" || toolName === "write_file");
  const isAskHuman = isPending && toolName === "ask_human";

  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 2 }}>
        Tool: {toolName}
      </div>
      {formatArgs(toolName, message.toolArgs)}
      {needsApproval && message.toolCallId && (
        <ApprovalPrompt toolCallId={message.toolCallId} approvalStatus={message.approvalStatus} />
      )}
      {isAskHuman && message.toolCallId && (
        <AskHumanPrompt toolCallId={message.toolCallId} approvalStatus={message.approvalStatus} />
      )}
      {!isPending && message.approvalStatus && (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: message.approvalStatus === "approved" ? "#059669" : "#dc2626",
            fontWeight: 500,
          }}
        >
          {message.approvalStatus === "approved" ? "Approved" : "Rejected"}
        </div>
      )}
    </div>
  );
}
