import { useReviewQueue } from "../api/reviews";

/** 메뉴 숫자에 쓰는 검수 대기 목록 상한. 검사 결과 화면 맨 위 목록과 같은 값이라 같은 캐시를 함께 쓴다 */
const LIMIT = 20;
/** 다른 관리 화면에 있을 때 다시 읽는 간격. 검사 결과 화면을 열면 그 화면의 5초 간격이 함께 적용된다 */
const POLL_MS = 30_000;

/** 대기 건수 글. 상한만큼 왔으면 더 있을 수 있어 "20+"로 쓴다 */
export function pendingLabel(count: number, limit = LIMIT): string {
  return count >= limit ? `${limit}+` : String(count);
}

/**
 * 관리 메뉴 "검사 결과" 옆에 붙일 검수 대기 건수(11/12). 부스가 새로 찍어 사람 검수를 기다리는 시점이 있으면
 * 어느 관리 화면에 있든 보이게 한다. 대기가 없거나 아직 모르면 null(숫자를 그리지 않음).
 * enabled=false(고객·공개 화면 헤더)면 서버에 묻지 않는다
 */
export function usePendingReviewLabel(enabled: boolean): string | null {
  const queue = useReviewQueue("PENDING", LIMIT, POLL_MS, enabled);
  const count = enabled ? (queue.data?.items.length ?? 0) : 0;
  return count === 0 ? null : pendingLabel(count);
}

/**
 * 메뉴 링크 안 빨간 숫자. 링크 이름은 "검사 결과" 그대로 두려고 숫자는 화면 읽기에서 숨기고,
 * 같은 뜻의 글(hidden)을 링크 설명(aria-describedby)으로 읽힌다
 */
export function PendingReviewBadge({ label, descriptionId }: { label: string; descriptionId: string }) {
  return (
    <>
      <span aria-hidden="true" className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[0.6875rem] leading-5 font-semibold text-white tabular-nums">
        {label}
      </span>
      <span id={descriptionId} hidden>
        검수 대기 {label}건
      </span>
    </>
  );
}
