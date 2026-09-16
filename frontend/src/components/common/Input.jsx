// Input.jsx — shared Input component (works directly with react-hook-form's register)
import { forwardRef } from 'react';

const Input = forwardRef(function Input({ label, error, className = '', ...props }, ref) {
  // react-hook-form's register() sets `name` but not `id` — without an explicit id here,
  // the label's htmlFor never actually matches the input, breaking the programmatic
  // label/control association (Section 15's accessibility floor).
  const id = props.id || props.name;
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <input ref={ref} className={`input ${className}`.trim()} {...props} id={id} />
      {error && <div className="field-error">{error}</div>}
    </div>
  );
});

export default Input;
