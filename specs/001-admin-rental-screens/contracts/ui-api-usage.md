# 화면 × API × 오류 문장 (WE1)

원본 계약: contracts `openapi/auth-server.yaml`·`rental-server.yaml`(커밋 `4234950`). 이 표는 화면이 어떤 operation을 부르고, 어떤 `code`를 어떤 문장으로 보이는지 정한다. 문장은 `src/shared/api/errorMessages.ts`와 같아야 한다.

## 화면별 operation

| 화면 | operation | 메서드·경로 |
| --- | --- | --- |
| 로그인 | login, refreshToken, logout | POST /api/v1/auth/login · /refresh · /logout |
| 기기 목록 | listDevices, listDeviceModels | GET /api/v1/devices?modelCode&status&q&limit&cursor · GET /api/v1/device-models |
| 기기 등록 | createDevice, listDeviceModels | POST /api/v1/devices |
| 기기 상세·수정·상태 | updateDevice | PATCH /api/v1/devices/{deviceId} |
| 기종 목록·등록 | listDeviceModels, getDeviceModel, upsertDeviceModel | GET /api/v1/device-models · GET·PUT /api/v1/device-models/{modelCode} |
| 렌탈 목록 | listRentals | GET /api/v1/rentals?status&limit&cursor |
| 렌탈 만들기 | listDevices, createRental | POST /api/v1/rentals |
| 렌탈 상세 | getRental, startCheckpoint, closeRental | GET /api/v1/rentals/{rentalId} · POST …/checkpoints · POST …/close |

## WE1에서 보이는 오류 code와 문장

| code | 상황 | 문장 |
| --- | --- | --- |
| INVALID_CREDENTIALS | 로그인 401 | 이메일 또는 비밀번호가 맞지 않습니다. 다시 확인해 주세요. |
| EMAIL_NOT_VERIFIED | 로그인 403 | 이메일 인증이 끝나지 않은 계정입니다. |
| RATE_LIMITED | 429 | 요청이 너무 잦습니다. 1분 뒤 다시 시도해 주세요. |
| REFRESH_INVALID | refresh 401 | 로그인 시간이 지났습니다. 다시 로그인해 주세요. |
| UNAUTHENTICATED | 재시도 뒤에도 401 | 로그인 시간이 지났습니다. 다시 로그인해 주세요. |
| FORBIDDEN | 403 | 관리자만 쓸 수 있는 화면입니다. |
| DEVICE_NOT_ACTIVE | 렌탈 만들기 409 | 이 기기는 {수리 중·폐기} 상태라 렌탈을 만들 수 없습니다. 사용 가능한 기기를 고르세요. |
| RENTAL_OPEN_EXISTS | 렌탈 만들기 409 | 이 기기로 진행 중인 렌탈이 이미 있습니다. 그 렌탈을 먼저 종료하세요. (+ "진행 중인 렌탈 보기" 링크) |
| CHECKPOINT_ORDER_VIOLATION | 시점 시작 409 | 시점은 출고 → 수령 → 반납 순서로만 시작할 수 있습니다. 최신 상태를 다시 불러왔습니다. |
| RENTAL_NOT_CLOSABLE | 종료 409 | 반납 기록이 봉인되기 전에는 종료할 수 없습니다. |
| DEVICE_SERIAL_EXISTS | 기기 등록 409 | 이미 등록된 시리얼입니다. 시리얼을 다시 확인해 주세요. |
| DEVICE_HAS_OPEN_RENTAL | 상태 바꾸기 409 | 진행 중인 렌탈이 있어 상태를 바꿀 수 없습니다. 렌탈을 먼저 종료하세요. |
| VALIDATION_FAILED | 400 | 입력값을 확인해 주세요. (+ `detail`) |
| NOT_FOUND | 404 | 찾는 항목이 없습니다. 목록에서 다시 골라 주세요. |
| INTERNAL_ERROR · 네트워크 | 5xx·연결 실패 | 잠시 뒤 다시 시도해 주세요. |

다른 code는 `detail`, 그것도 없으면 "요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요."
