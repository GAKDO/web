import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  /** 칸 아래 작은 안내(오류가 있으면 오류만 보인다) */
  hint?: string;
}

const WRAP = "mb-4 grid gap-2";
/** 오류 문장은 짧게 떠오르고, 칸은 오류가 생기는 순간 한 번 흔들린다(motion.css, 움직임 줄이기면 없음) */
const ERROR = "m-field-error m-0 text-sm text-destructive";

/** 레이블과 오류 문장이 붙은 입력 칸 */
export function Field({ label, error, hint, className, ...input }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  return (
    <div className={cn(WRAP, className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {error ? (
        <p id={errorId} className={ERROR} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="m-0 text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | null;
}

/** 레이블이 붙은 선택 칸 */
export function SelectField({ label, error, children, className, ...select }: SelectFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={cn(WRAP, className)}>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} {...select}>
        {children}
      </NativeSelect>
      {error && (
        <p id={errorId} className={ERROR} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  /** 칸 아래 작은 안내(예: "관리자에게만 보입니다") */
  hint?: string;
}

/** 레이블이 붙은 여러 줄 입력 칸. 생김새는 Input과 같다 */
export function TextAreaField({ label, hint, className, ...area }: TextAreaFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={cn(WRAP, className)}>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={3}
        aria-describedby={hint ? hintId : undefined}
        className={cn(
          "min-h-20 w-full min-w-0 resize-y rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25",
        )}
        {...area}
      />
      {hint && (
        <p id={hintId} className="m-0 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
