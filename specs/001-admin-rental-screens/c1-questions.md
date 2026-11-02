# WE1이 C1(rental·auth OpenAPI)에 묻는 것

C1(contracts PR #1)이 머지됐습니다. 아래는 WE1 화면이 정했거나 가정한 것 중 C1과 맞춰야 하는 것입니다. C1이 정한 것은 C1을 따릅니다. (작성: C, 2026-11-02)

## 답이 나온 것

1. **렌탈 종료 조건** — C1 `closeRental`: 반납(RET) 시점이 봉인(SEALED)된 렌탈만, 아니면 409 `RENTAL_NOT_CLOSABLE`. 화면은 처음에 GRADED 이후로 정했다가 계약대로 SEALED로 바꿨습니다.

## 아직 열린 것 (A에게)

2. **폐기 되돌리기:** 화면은 RETIRED → MAINTENANCE만 허용합니다(RETIRED → ACTIVE 없음). `PATCH /devices/{deviceId}`가 RETIRED → ACTIVE를 거절하나요? 거절한다면 오류 `code`가 필요합니다(지금 `error_code`에 없음). 되돌릴 때 `retiredAt`은 비워지는데, 폐기했던 이력은 어디에 남나요?
3. **ID 형식:** OpenAPI의 `Uuid`(rental-server 12곳 등)를 헌법 1.1.0의 publicId(NanoID 21자)로 언제 바꾸나요? 바뀐 뒤에 화면의 API 타입을 다시 만듭니다.
4. **렌탈 목록 필드(더하는 변경 요청):** `RentalSummary`에 `renterRef`와 지금 시점(마지막 시점의 type·status)을 더해 줄 수 있나요? 관리자가 목록에서 누구에게 나간 렌탈이 어디까지 왔는지 봐야 합니다.
5. **렌탈 상세 필드(더하는 변경 요청):** `Rental`에 `serial`·`modelCode`(또는 `GET /devices/{deviceId}`)를 더해 줄 수 있나요? 지금은 상세 주소로 바로 들어오면 기기 시리얼을 보일 방법이 없습니다.
6. **리프레시 쿠키와 출처(GW1):** web(8315)과 gateway(8314)는 출처가 달라, 쿠키(`Path=/api/v1/auth; SameSite=Strict`)가 실리려면 gateway CORS가 web 출처를 credentials 허용으로 열거나 web nginx가 `/api`를 gateway로 넘겨야 합니다. 어느 쪽으로 할까요?
