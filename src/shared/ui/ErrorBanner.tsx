import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "./Button";

interface ErrorBannerProps {
  message: string;
  children?: ReactNode;
  onRetry?: () => void;
}

/** 화면 위쪽의 오류 문장(shadcn/ui Alert). 다시 시도할 수 있으면 버튼을 붙인다 */
export function ErrorBanner({ message, onRetry, children }: ErrorBannerProps) {
  return (
    <Alert variant="destructive" role="alert" className="mb-4">
      <CircleAlert aria-hidden="true" />
      <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2 text-destructive">
        <span className="font-medium">{message}</span>
        {children}
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            다시 시도
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
