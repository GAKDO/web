/**
 * 시리얼을 뒤 4자리만 보이게 가린다(시연 화면·어깨너머 노출 방지, 11/6 팀 요청).
 * 목록·제목은 이것만 쓰고, 상세·고치기는 MaskedSerial의 눈 버튼으로 전체를 볼 수 있다. 검색은 전체 시리얼로 그대로 된다.
 */
export function maskSerial(serial: string): string {
  if (serial.length <= 4) return serial;
  return `${"•".repeat(Math.min(6, serial.length - 4))}${serial.slice(-4)}`;
}
