/** 지문을 앞 4자…뒤 4자로 줄인다(계약 설명의 예 7f3a…e21b) */
export function shortHash(hash: string): string {
  return hash.length <= 9 ? hash : `${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

const KST = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** 서버 시각을 한국 시간으로 보인다 */
export function formatKst(iso: string): string {
  return KST.format(new Date(iso));
}
