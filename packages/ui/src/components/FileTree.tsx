import { useState, useCallback } from "react";
import { listFiles, type FileEntry } from "../api";

interface TreeNode {
  entry: FileEntry;
  path: string;
  children: TreeNode[] | null;
  expanded: boolean;
  loading: boolean;
}

export function FileTree({
  onSelectFile,
  selectedPath,
}: {
  onSelectFile: (path: string) => void;
  selectedPath: string | null;
}) {
  const [roots, setRoots] = useState<TreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = useCallback(async (path: string): Promise<TreeNode[]> => {
    const entries = await listFiles(path);
    return entries.map((entry) => ({
      entry,
      path: path ? `${path}/${entry.name}` : entry.name,
      children: null,
      expanded: false,
      loading: false,
    }));
  }, []);

  const loadRoots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nodes = await loadDirectory("");
      setRoots(nodes);
    } catch (err: any) {
      setError(err.message || "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [loadDirectory]);

  // Load on first render
  if (roots === null && !loading && !error) {
    loadRoots();
  }

  const toggleDir = useCallback(
    async (nodePath: string) => {
      const updateNodes = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
        const result: TreeNode[] = [];
        for (const node of nodes) {
          if (node.path === nodePath) {
            if (node.expanded) {
              result.push({ ...node, expanded: false });
            } else {
              if (node.children === null) {
                result.push({ ...node, loading: true });
                try {
                  const children = await loadDirectory(node.path);
                  result[result.length - 1] = { ...node, children, expanded: true, loading: false };
                } catch {
                  result[result.length - 1] = { ...node, loading: false };
                }
              } else {
                result.push({ ...node, expanded: true });
              }
            }
          } else if (node.children && node.expanded) {
            result.push({ ...node, children: await updateNodes(node.children) });
          } else {
            result.push(node);
          }
        }
        return result;
      };

      if (roots) {
        setRoots(await updateNodes(roots));
      }
    },
    [roots, loadDirectory],
  );

  const renderNode = (node: TreeNode, depth: number) => {
    const isDir = node.entry.type === "directory";
    const isSelected = node.path === selectedPath;

    return (
      <div key={node.path}>
        <button
          onClick={() => (isDir ? toggleDir(node.path) : onSelectFile(node.path))}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            width: "100%",
            border: "none",
            background: isSelected ? "#e0e7ff" : "transparent",
            padding: "3px 8px",
            paddingLeft: 8 + depth * 16,
            cursor: "pointer",
            fontSize: 13,
            fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
            color: isDir ? "#374151" : "#6b7280",
            fontWeight: isDir ? 500 : 400,
            textAlign: "left",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            borderRadius: 3,
          }}
          title={node.path}
        >
          <span style={{ width: 16, flexShrink: 0, fontSize: 11, color: "#9ca3af" }}>
            {isDir ? (node.loading ? "..." : node.expanded ? "\u25BE" : "\u25B8") : " "}
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{node.entry.name}</span>
        </button>
        {isDir && node.expanded && node.children && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "10px 12px",
          fontSize: 12,
          fontWeight: 600,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Workspace Files (read-only)</span>
        <button
          onClick={loadRoots}
          title="Refresh"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            color: "#9ca3af",
            padding: "0 2px",
          }}
        >
          {"\u21BB"}
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        {loading && <div style={{ padding: 12, fontSize: 13, color: "#9ca3af" }}>Loading...</div>}
        {error && (
          <div style={{ padding: 12, fontSize: 13, color: "#ef4444" }}>
            {error}
            <br />
            <button
              onClick={loadRoots}
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#6366f1",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              Retry
            </button>
          </div>
        )}
        {roots && roots.length === 0 && (
          <div style={{ padding: 12, fontSize: 13, color: "#9ca3af" }}>Workspace is empty</div>
        )}
        {roots && roots.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
}
