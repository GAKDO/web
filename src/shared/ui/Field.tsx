import { useId, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
}

/** 레이블과 오류 문장이 붙은 입력 칸 */
export function Field({ label, error, ...input }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} {...input} />
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | null;
}

/** 레이블이 붙은 선택 칸 */
export function SelectField({ label, error, children, ...select }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} aria-invalid={error ? true : undefined} {...select}>
        {children}
      </select>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
