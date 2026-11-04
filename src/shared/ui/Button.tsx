import type { ComponentPropsWithoutRef } from "react";
import { Button as UiButton } from "@/components/ui/button";

interface ButtonProps extends ComponentPropsWithoutRef<typeof UiButton> {
  /** 처리 중이면 다시 누를 수 없다(FR-033) */
  busy?: boolean;
}

/**
 * 화면 공통 버튼(shadcn/ui Button). 제출 버튼은 브랜드 빨강(주 동작), 나머지는 흰 바탕(보조)이 기본이다
 */
export function Button({ busy = false, disabled, children, type = "button", variant, ...rest }: ButtonProps) {
  return (
    <UiButton
      type={type}
      variant={variant ?? (type === "submit" ? "default" : "outline")}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? "처리 중…" : children}
    </UiButton>
  );
}
