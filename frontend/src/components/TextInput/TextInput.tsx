import type { InputHTMLAttributes } from "react";
import "./TextInput.css";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function TextInput({ label, className = "", ...props }: TextInputProps) {
  return (
    <label className="bc-field">
      {label ? <span>{label}</span> : null}
      <input className={`bc-input ${className}`.trim()} {...props} />
    </label>
  );
}
