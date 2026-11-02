# WE1이 C1(rental·auth OpenAPI)에 묻는 것

WE1 화면은 C1 머지 전이라 `design/rest-api-v0.md`·`design/ddl.md`를 보고 MSW 목을 만들었습니다. 아래는 목이 가정한 것 중 C1이 정해 줘야 하는 것입니다. C1이 다르게 정하면 C1을 따르고 목·명세를 고칩니다. (작성: C, 2026-11-02)

## 화면 쪽에서 정한 규칙 (서버도 같은 규칙인지)

1. **렌탈 종료 조건:** 화면은 반납(RET) 시점이 GRADED 또는 SEALED일 때만 종료 버튼을 켭니다. `POST /rentals/{id}/close`가 그 전에는 409를 주나요? 오류 `code`는 무엇인가요?
2. **폐기 되돌리기:** 화면은 RETIRED → MAINTENANCE만 허용합니다(RETIRED → ACTIVE 없음). `PATCH /devices/{id}`가 RETIRED → ACTIVE를 거절하나요(409·422)? 되돌릴 때 `retired_at`은 비우고 폐기 이력은 어디에 남나요?
