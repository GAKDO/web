/**
 * 목록에서 시리얼을 뒤 4자리만 보이게 가린다(시연 화면·어깨너머 노출 방지, 11/6 민서 요청).
 * 전체 시리얼은 기기를 열었을 때(고치기)와 렌탈 상세에서만 보인다. 검색은 전체 시리얼로 그대로 된다.
 */
export function maskSerial(serial: string): string {
  if (serial.length <= 4) return serial;
  return `${"•".repeat(Math.min(6, serial.length - 4))}${serial.slice(-4)}`;
}
