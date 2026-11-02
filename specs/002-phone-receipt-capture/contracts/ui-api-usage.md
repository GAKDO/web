# 화면 × API × 오류 문장 (WE2)

| 화면 | operation | 성공 | 오류 → 문장 |
| --- | --- | --- | --- |
| 고객 로그인 `/login` | login | next로 이동 | 401 INVALID_CREDENTIALS → "이메일 또는 비밀번호가 맞지 않습니다…", 429 → "1분 뒤…" |
| 입장 `/capture?t=` | exchangeCaptureLink | 면 목록, 주소창 토큰 지움 | 410 CAPTURE_LINK_INVALID → "만료되었거나 이미 사용한 QR입니다. 대여 담당자에게 새 QR을 받아 주세요", 409 RENTAL_LINKED_TO_OTHER → "다른 계정에 연결된 렌탈입니다. 로그아웃한 뒤 이 렌탈을 받은 계정으로 다시 들어와 주세요", 403 → "고객 계정으로 로그인해 주세요" |
| 제출 | createCaptureSet | uploads 받음 | 401 → "촬영 시간이 지났습니다. 대여 담당자에게 새 QR을 받아 주세요", 403 OUT_OF_SCOPE → 같은 문장 |
| 제출 | (저장소 PUT) | 진행률 +1 | 네트워크·5xx → "n장을 올리지 못했습니다. 다시 시도해 주세요", 403(만료) → 새 세트 |
| 제출 | completeCaptureSet | 접수 화면 | 409 CAPTURE_FACES_MISSING → "다음 면을 다시 찍어 주세요: 상판, …", 409 CAPTURE_HASH_MISMATCH → "사진이 올바르게 올라가지 않았습니다. 다시 제출해 주세요", 409 CAPTURE_SET_CLOSED → 접수 화면 |
| 렌탈 상세(관리자) | createCaptureLink | QR·링크 복사·만료 시각 | 403 → "관리자만…", 400·404 → 공통 문장 |
