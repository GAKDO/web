import type { ComponentPropsWithoutRef } from "react";
import { LoaderCircle } from "lucide-react";
import { Button as UiButton } from "@/components/ui/button";

interface ButtonProps extends ComponentPropsWithoutRef<typeof UiButton> {
  /** 처리 중이면 다시 누를 수 없다(FR-033). 처리 중 표시는 돌림표 + "처리 중…"이고 폭은 그대로 */
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
      {busy ? (
        // 11/8: 원래 문장 자리를 숨긴 채 남겨 버튼 폭이 바뀌지 않게 하고, 그 위에 돌림표와 "처리 중…"을 겹친다
        <span className="m-busy">
          <span aria-hidden="true" className="invisible inline-flex items-center gap-2">
            {children}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            처리 중…
          </span>
        </span>
      ) : (
        children
      )}
    </UiButton>
  );
}
