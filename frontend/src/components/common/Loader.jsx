// Loader.jsx — shared Loader component
export default function Loader({ label }) {
  return (
    <div className="row">
      <span className="loader" />
      {label && <span className="small muted">{label}</span>}
    </div>
  );
}
