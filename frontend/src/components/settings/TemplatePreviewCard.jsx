// TemplatePreviewCard.jsx — thumbnail + description for one template option (Section 16).
// Thumbnails are static PNGs pre-rendered from each real template with sample invoice
// data (frontend/public/template-previews/<key>.png) — not generated on the fly, since
// the three layouts are fixed/code-defined for v1 (no live preview endpoint exists; see
// template.controller.js's own comment on that). Re-render them the same way if a
// template's HTML/CSS ever changes — see understand.md for how they were made.
export default function TemplatePreviewCard({ template, selected, onSelect }) {
  return (
    <div
      className={`template-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <img
        className="template-thumb"
        src={`/template-previews/${template.key}.png`}
        alt={`${template.label} preview`}
      />
      <h4 style={{ margin: '10px 0 6px' }}>{template.label}</h4>
      <p className="small muted" style={{ margin: 0 }}>
        {template.description}
      </p>
      {selected && (
        <span className="badge badge-finalized" style={{ marginTop: 8, display: 'inline-block' }}>
          Selected
        </span>
      )}
    </div>
  );
}
