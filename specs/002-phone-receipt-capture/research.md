# Research: WE2

## R1. 촬영 권한을 어디에 두나
- 결정: 로그인 토큰(`tokenStore`)과 따로 `captureTokenStore`(메모리)에 둔다. capture-server 호출은 `captureApi`(촬영 JWT만 붙이고, 401이면 재발급 없이 "촬영 시간이 지났습니다").
- 이유: 촬영 JWT는 30분·시점 하나 범위이고 리프레시가 없다. 로그인 토큰으로 capture-server를 부르면 403 OUT_OF_SCOPE. 저장소 금지(헌법 V, Clarifications Q2).

## R2. 흔들림·반사 검사
- 결정: 프레임을 긴 변 512px 회색조로 줄여 (1) 라플라시안(4-이웃) 분산 < `BLUR_MIN`(시작값 60)이면 흔들림, (2) 밝기 ≥ 250인 픽셀 비율 > `GLARE_MAX`(시작값 0.03)이면 반사. 기준값은 `quality.ts` 상수, 결과 화면에 점수를 작게 보인다(FR-012).
- SCR1(화면 흰색)은 화면 전체가 밝아 반사 검사가 늘 걸리므로 반사 검사를 하지 않고, 흔들림 기준은 절반으로 둔다.
- 버린 안: OpenCV.js(8MB+, 폰 로딩 느림), 서버 판정만(FR-CAP-03은 촬영 자리에서 다시 찍게 하는 것이 요구).

## R3. 사진 크기·해시
- 결정: 긴 변 2048px JPEG(품질 0.9)로 만든 Blob의 바이트로 SHA-256(16진수 소문자) → 세트 생성 때 알린 해시와 PUT 본문이 같은 바이트다.
- PUT은 응답 `headers`를 그대로 싣는다(Content-Type, x-amz-checksum-sha256). MinIO CORS 허용은 A 확인 항목.

## R4. 제출 순서와 재시도
- 세트 생성 1번 → PUT은 2개씩 동시에 → 모두 성공하면 완료(Idempotency-Key는 세트마다 `crypto.randomUUID()` 하나).
- PUT 실패: 실패한 것만 다시. 업로드 URL 만료(expiresAt 지남 또는 PUT 403)면 새 세트를 만들고 전부 다시.
- 완료 409 CAPTURE_FACES_MISSING → 빠진 면 표시·그 면 사진 지움. CAPTURE_HASH_MISMATCH → 세트 버림(다음 제출은 새 세트). CAPTURE_SET_CLOSED → 이미 접수로 본다.

## R5. 고객 로그인
- `AuthProvider`가 role을 기억하고 ADMIN·CUSTOMER 둘 다 세션으로 받는다. `login(email, pw, expected="ADMIN")`로 WE1 동작은 그대로. `/login?next=`는 `/`로 시작하는 같은 출처 경로만 따른다(열린 리다이렉트 방지).

## R6. 면 목록과 codes.yaml
- 생성 타입에는 `face_required`가 없다. `faces.ts`에 `CaptureFace` 타입 상수로 두고, 테스트가 `contracts/codes.yaml`을 읽어 같은지 확인한다.
