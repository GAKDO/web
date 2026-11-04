/** 날짜만 "2026. 11. 4." (서울 시간) */
export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });

/** 날짜와 시각 "2026. 11. 4. 오전 9:30" (서울 시간) */
export const formatDateTime = (iso: string | null | undefined) =>
  !iso
    ? "—"
    : new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
