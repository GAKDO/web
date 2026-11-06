import { maskSerial } from "./maskSerial";

test("시리얼은 뒤 4자리만 보이고 앞은 가려진다", () => {
  expect(maskSerial("K7QX2M9P4T")).toBe("••••••9P4T");
  expect(maskSerial("C02")).toBe("C02");
  expect(maskSerial("7HXK2Q3")).toBe("•••K2Q3");
});
