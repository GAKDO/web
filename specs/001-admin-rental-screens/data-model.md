# Data Model: WE1 (화면이 다루는 모양)

원본은 contracts C1(`4234950`)이다. 아래는 화면이 쓰는 필드와 화면 쪽 규칙만 적는다. 타입은 생성 코드(`src/shared/api/generated/`)의 별칭으로 쓴다. 모든 ID는 `PublicId`(`^[A-Za-z0-9_-]{21}$`).

## AdminSession (화면 메모리, 서버 모양 아님)

| 필드 | 출처 | 규칙 |
| --- | --- | --- |
| accessToken | `TokenResponse.accessToken` | 메모리에만. 저장소에 쓰지 않음 |
| role | `TokenResponse.role` | ADMIN이 아니면 세션을 만들지 않음 |
| expiresAt | 받은 시각 + `expiresIn`초 | 표시용. 만료 판단은 서버 401로 |

상태: `unknown`(시작, refresh 시도 중) → `authenticated` | `anonymous`. 로그아웃·refresh 실패 → `anonymous`.

## DeviceModel / DeviceModelSummary

`modelCode`(`^[A-Z0-9][A-Z0-9-]{1,63}$`), `name`, `manufacturer?`, `formFactor`(CLAMSHELL), `spec?{cpu, ramGb≥1, ssdGb≥1}`, `dimensions{widthMm, depthMm, baseHMm, lidHMm}`(모두 > 0).
등록·수정은 같은 `PUT /device-models/{modelCode}`(FR-014). 화면 검증: 코드 형식, 이름 필수, 치수 4개 필수·양수.

## Device

`deviceId`, `serial`(등록 뒤 읽기 전용), `modelCode`·`modelName`(읽기 전용), `os`(MACOS·WINDOWS), `color?`, `assetNo?`, `status`, `retiredAt?`, `createdAt`, `updatedAt`.

상태 바꾸기(FR-011, 화면 규칙):

```text
ACTIVE ⇄ MAINTENANCE        (확인 없음)
ACTIVE|MAINTENANCE → RETIRED (확인 창)
RETIRED → MAINTENANCE        (확인 창)
RETIRED → ACTIVE             (화면에 없음)
```

서버 409 `DEVICE_HAS_OPEN_RENTAL`이면 상태를 그대로 두고 목록을 다시 읽는다.

## Rental / RentalSummary / Checkpoint

- Rental: `rentalId`, `deviceId`, `renterRef`(1~128자), `status`(OPEN·RETURNED·CLOSED), `startedAt?`, `endedAt?`, `createdAt`, `checkpoints[]`(OUT·RCV·RET 순, 최대 3).
- RentalSummary(목록): `rentalId`, `deviceId`, `serial`, `modelCode`, `status`, `createdAt`. **`renterRef`와 지금 시점이 없음** → c1-questions 4번.
- Checkpoint: `checkpointId`, `type`, `status`(OPEN·CAPTURED·GRADED·SEALED), `occurredAt?`.

화면이 계산하는 다음 동작 `nextAction(rental)`:

앞 시점이 봉인(SEALED)된 뒤에만 다음 시점·종료를 연다(11/02 C 결정, rental-server도 같은 규칙임을 A가 확인함 — c1-questions 11. 그래도 서버가 409를 주면 문장 + 다시 읽기로 처리한다).

| checkpoints | 다음 동작 |
| --- | --- |
| 없음 | 출고 시작 |
| OUT(SEALED 아님) | 없음 — 수령 버튼 옆 "출고 기록이 봉인되면 시작할 수 있습니다" |
| OUT(SEALED) | 수령 시작 |
| OUT, RCV(SEALED 아님) | 없음 — 반납 버튼 옆 "수령 기록이 봉인되면 시작할 수 있습니다" |
| OUT, RCV(SEALED) | 반납 시작 |
| …, RET(SEALED 아님) | 없음 — "반납 기록이 봉인되면 종료할 수 있습니다" |
| …, RET(SEALED) | 렌탈 종료 |
| rental.status = CLOSED | 없음 — "종료된 렌탈" |

## ApiError (화면 모양)

`{ status: number, code: ErrorCode | null, detail: string | null }` — Problem Details에서 만든다. 네트워크 오류는 `status: 0`.
