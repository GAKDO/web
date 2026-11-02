import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 처리 중이면 다시 누를 수 없다(FR-033) */
  busy?: boolean;
}

export function Button({ busy = false, disabled, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? "처리 중…" : children}
    </button>
  );
}
