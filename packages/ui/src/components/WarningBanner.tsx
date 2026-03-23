import { useState, useEffect } from "react";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
}

export function WarningBanner({
  message,
  retryAt,
}: {
  message: string;
  retryAt?: string;
}) {
  const [displayText, setDisplayText] = useState<string | null>(null);

  useEffect(() => {
    if (!retryAt) {
      setDisplayText(null);
      return;
    }

    const retryTime = new Date(retryAt).getTime();

    const update = () => {
      const remaining = Math.ceil((retryTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setDisplayText(null); // will be replaced by static text below
      } else {
        setDisplayText(`waiting ${formatDuration(remaining)} to continue`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [retryAt]);

  const isPast = !retryAt || new Date(retryAt).getTime() <= Date.now();

  return (
    <div
      style={{
        margin: "8px 0",
        padding: "8px 12px",
        backgroundColor: isPast ? "#f5f5f4" : "#fef3c7",
        border: `1px solid ${isPast ? "#d6d3d1" : "#f59e0b"}`,
        borderRadius: 8,
        fontSize: 13,
        color: isPast ? "#78716c" : "#92400e",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      {displayText && (
        <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{displayText}</span>
      )}
    </div>
  );
}
