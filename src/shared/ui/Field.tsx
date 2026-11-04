import { useId, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
}

const WRAP = "mb-4 grid gap-2";
const ERROR = "m-0 text-sm text-destructive";

/** 레이블과 오류 문장이 붙은 입력 칸 */
export function Field({ label, error, className, ...input }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={cn(WRAP, className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} {...input} />
      {error && (
        <p id={errorId} className={ERROR} role="alert">
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
export function SelectField({ label, error, children, className, ...select }: SelectFieldProps) {
  const id = useId();
  return (
    <div className={cn(WRAP, className)}>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} aria-invalid={error ? true : undefined} {...select}>
        {children}
      </NativeSelect>
      {error && (
        <p className={ERROR} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
