import type { ReactNode } from "react";

interface ErrorBannerProps {
  message: string;
  children?: ReactNode;
  onRetry?: () => void;
}

/** 화면 위쪽의 오류 문장. 다시 시도할 수 있으면 버튼을 붙인다 */
export function ErrorBanner({ message, onRetry, children }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      {children}
      {onRetry && (
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
