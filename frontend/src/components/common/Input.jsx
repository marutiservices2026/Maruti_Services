// Input.jsx — shared Input component (works directly with react-hook-form's register)
import { forwardRef, useState } from 'react';

const EyeIcon = ({ off }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    {off && <path d="M2 14 14 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />}
  </svg>
);

const Input = forwardRef(function Input({ label, error, className = '', ...props }, ref) {
  // react-hook-form's register() sets `name` but not `id` — without an explicit id here,
  // the label's htmlFor never actually matches the input, breaking the programmatic
  // label/control association (Section 15's accessibility floor).
  const id = props.id || props.name;
  const [visible, setVisible] = useState(false);
  const isPassword = props.type === 'password';

  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      {isPassword ? (
        <div className="password-input-wrap">
          <input
            ref={ref}
            className={`input ${className}`.trim()}
            {...props}
            type={visible ? 'text' : 'password'}
            id={id}
          />
          <button
            type="button"
            className="password-input-toggle"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            <EyeIcon off={visible} />
          </button>
        </div>
      ) : (
        <input ref={ref} className={`input ${className}`.trim()} {...props} id={id} />
      )}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
});

export default Input;
