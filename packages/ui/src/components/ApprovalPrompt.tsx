import { useState } from "react";
import * as api from "../api";

export function ApprovalPrompt({
  toolCallId,
  approvalStatus,
}: {
  toolCallId: string;
  approvalStatus: string | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  const resolved = localStatus || (approvalStatus !== "pending" ? approvalStatus : null);

  const handleApprove = async () => {
    setSubmitting(true);
    setLocalStatus("approved");
    try {
      await api.approveToolCall(toolCallId);
    } catch (err) {
      console.error("Failed to approve:", err);
      setLocalStatus(null);
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    setLocalStatus("rejected");
    try {
      await api.rejectToolCall(toolCallId);
    } catch (err) {
      console.error("Failed to reject:", err);
      setLocalStatus(null);
      setSubmitting(false);
    }
  };

  if (resolved) {
    return (
      <div
        style={{
          marginTop: 6,
          fontSize: 12,
          color: resolved === "approved" ? "#059669" : "#dc2626",
          fontWeight: 500,
        }}
      >
        {resolved === "approved" ? "Approved" : "Rejected"}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
      <button
        onClick={handleApprove}
        disabled={submitting}
        style={{
          padding: "4px 12px",
          fontSize: 13,
          backgroundColor: "#059669",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: submitting ? "default" : "pointer",
        }}
      >
        Approve
      </button>
      <button
        onClick={handleReject}
        disabled={submitting}
        style={{
          padding: "4px 12px",
          fontSize: 13,
          backgroundColor: "#dc2626",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: submitting ? "default" : "pointer",
        }}
      >
        Reject
      </button>
    </div>
  );
}
