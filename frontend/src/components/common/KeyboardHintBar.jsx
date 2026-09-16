// KeyboardHintBar.jsx — persistent bottom hint bar showing context-sensitive keyboard
// shortcuts, matching Tally's iconic function-key bar. Not in Section 5's file tree, but
// explicitly requested — added as the smallest reasonable new file, alongside its
// sibling common/ components.
export default function KeyboardHintBar({ hints }) {
  if (!hints || hints.length === 0) return null;

  return (
    <div className="keyboard-hint-bar">
      {hints.map((h) => (
        <span className="hint-item" key={h.key}>
          <kbd>{h.key}</kbd>
          {h.label}
        </span>
      ))}
    </div>
  );
}
