interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

/** 화면 위쪽의 오류 문장. 다시 시도할 수 있으면 버튼을 붙인다 */
export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
