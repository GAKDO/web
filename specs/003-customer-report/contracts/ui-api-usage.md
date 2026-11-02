# WE3 화면 × API × 오류 문장

계약: contracts develop `fd35e33`. 모든 호출은 gateway `/api/v1` 아래, Bearer 토큰.

| 화면 | operation | 쓰는 필드 | 오류 → 화면 |
| --- | --- | --- | --- |
| 내 렌탈 목록 | `GET /rentals` (rental) | items[].rentalId·serial·modelCode·status·createdAt | 401 → 로그인으로 |
| 내 렌탈 목록 | `GET /device-models/{modelCode}` (rental) | name | 실패 → 기종 코드만 |
| 리포트 | `GET /reports/rentals/{rentalId}` (report) | chainStatus·verifyUrl·checkpoints[] | 403(FORBIDDEN·OUT_OF_SCOPE) → "이 렌탈을 볼 권한이 없습니다" + 내 렌탈 목록 버튼 / 404 → "렌탈을 찾을 수 없습니다" |
| 3D | `GET /device-models/{modelCode}` | dimensions | 실패 → 대체 화면 + "3D 모델을 불러오지 못했습니다" |
| 3D·핀 상세·비교표 | `GET /captures/checkpoints/{id}/media` (capture) | textures[]·crops[]·expiresAt | 실패 → 사진 없음(회색) |
| 핀 상세 | `GET /captures/checkpoints/{id}/inspection` (capture) | defects[].class·face·lengthMm·areaMm2 | 실패 → 크롭만 |
| 비교표 | `GET /diagnostics/checkpoints/{id}` (diagnostics) | current.battery·ssd, flags[] | 404 → "진단 기록 없음" |
| 진행률 | `GET /reports/rentals/{id}/stream` (report, SSE) | progress·done·error 이벤트 | 끊김 → "다시 연결 중" 후 재연결, error 이벤트 → 문장 표시 |

문장은 `src/shared/api/errorMessages.ts`의 `Record<ErrorCode, string>`에서 고르고, 리포트의 403·404만 화면 문맥 문장으로 덮어쓴다.
