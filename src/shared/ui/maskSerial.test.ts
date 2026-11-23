// 이 파일이 확인하는 것: 화면에 기기 시리얼 번호를 보여 줄 때 가리는 규칙(개인정보·자산 정보 보호).

import { maskSerial } from "./maskSerial";

// [상황] 10자리, 3자리, 7자리 시리얼을 가린다.
// [기대] 뒤 4자리만 보이고 앞은 •로 가린다. 4자리 이하로 짧으면 그대로 보인다.
test("시리얼은 뒤 4자리만 보이고 앞은 가려진다", () => {
  expect(maskSerial("K7QX2M9P4T")).toBe("••••••9P4T");
  expect(maskSerial("C02")).toBe("C02");
  expect(maskSerial("7HXK2Q3")).toBe("•••K2Q3");
});
