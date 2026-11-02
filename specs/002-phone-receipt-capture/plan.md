# Implementation Plan: 폰 수령 촬영과 수령 QR 발급 (WE2)

**Branch**: `claude/project-thread-490mp2` | **Date**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

## Summary

고객이 수령 QR 링크(`/capture?t=…`)로 들어와 고객 로그인 → QR 토큰을 촬영 권한(30분)으로 교환 → 7면(+선택 SCR1)을 윤곽 가이드를 보며 찍고 → 폰 안에서 흔들림·반사를 검사해 통과한 사진만 → 촬영 세트 생성·사전 서명 URL PUT·완료로 올린다. 관리자는 렌탈 상세에서 수령 QR을 만든다. API 타입은 contracts(`fd35e33`)의 auth·capture OpenAPI에서 만들고 `src/shared/api/` 한 곳에서 부른다. 서버 확인 전에는 같은 계약의 MSW 목(저장소 PUT 포함)으로 개발·테스트한다.

## Technical Context

**Language/Version**: TypeScript 5.9(strict), React 18.3, Node 22

**Primary Dependencies**: WE1과 같음(Vite 6, React Router 6.30, TanStack Query 5, openapi-typescript 7, openapi-fetch 0.17, MSW 2.15). 새로 더함: `qrcode` 1.5(QR 그림, 관리자 화면만). 카메라는 `getUserMedia`, 해시는 Web Crypto `crypto.subtle.digest`, 품질 검사는 canvas 픽셀로 직접 계산(OpenCV.js 안 씀, research R2).

**Storage**: 없음. 촬영 권한·사진·QR 토큰은 메모리에만(FR-003·007).

**Testing**: Vitest + Testing Library + MSW(node). 카메라·canvas는 `features/capture/camera.ts` 한 파일로 감싸 테스트에서 가짜로 바꾼다. 품질 검사는 순수 함수라 합성 픽셀로 시험한다.

**Target Platform**: 폰 Safari(iOS 16+)·Chrome(Android). HTTPS 필수(nginx는 web#5에서 인증서 마운트 시 HTTPS).

**Constraints**: PR 하나에 코드 400줄 이하, 375px 가로 스크롤 없음, `any` 금지, 계약 타입만.

## Constitution Check

| 원칙 | 점검 | 결과 |
| --- | --- | --- |
| I. 계약이 먼저 | capture·auth OpenAPI에서 타입 생성. 폰 필수 면 목록은 생성 enum 타입을 쓰는 상수로 두고, 테스트가 `contracts/codes.yaml`의 `face_required.PHONE`과 같은지 확인한다(복사본이 어긋나면 테스트 실패) | 통과 |
| II. 서비스 경계 | API는 gateway `/api/v1/...`만. 사진 본문은 사전 서명 URL로 MinIO에 직접 PUT(gateway 안 지남) | 통과 |
| III. 기록은 고칠 수 없다 | 완료는 Idempotency-Key로 한 번만. 해시 불일치면 새 세트 | 통과 |
| IV. 테스트 | 수용 시나리오마다 테스트, `npm run typecheck && npm test && npm run build` | 통과 |
| V. 비밀·개인정보 | 토큰·사전 서명 URL을 로그·저장소에 남기지 않음. 교환 뒤 주소창에서 토큰 지움 | 통과 |
| VI. 단순하게 | 기종 치수 윤곽·SSE 진행률·회원가입 제외 | 통과 |
| ID 규칙 | publicId만, 목 ID nanoid 21자 | 통과 |

## Project Structure

```text
specs/002-phone-receipt-capture/  spec.md plan.md research.md data-model.md quickstart.md tasks.md contracts/ui-api-usage.md
src/
├── shared/
│   ├── api/  generated/capture.ts(새), types.ts(capture 타입 더함), client.ts(captureApi 더함), storage.ts(새, 사전 서명 PUT)
│   ├── auth/ AuthProvider.tsx(role·고객 로그인), RequireCustomer.tsx(새), captureTokenStore.ts(새)
│   └── mocks/handlers/ capture.ts(새: 세트·완료·저장소 PUT), auth.ts(capture-links 두 개 더함)
└── features/
    ├── customer-auth/components/CustomerLoginPage.tsx   # /login?next=
    ├── capture/
    │   ├── faces.ts            # 폰 면 목록·필수 여부·가이드 문장·윤곽 비율
    │   ├── quality.ts          # 흔들림(라플라시안 분산)·반사(포화 픽셀 비율) 순수 함수, 기준 상수
    │   ├── camera.ts           # getUserMedia·canvas·JPEG·SHA-256 (테스트에서 바꿔 끼움)
    │   ├── submit.ts           # 세트 생성 → PUT → 완료, 실패분만 재시도
    │   └── components/ CaptureEntryPage(입장·교환·오류) CapturePage(면 목록·제출) FaceShooter(카메라·윤곽·검사) CameraHelp SkipReasonDialog
    └── rentals/components/CaptureLinkPanel.tsx          # 관리자 수령 QR (WE1 ③ 렌탈 상세에 붙임)
```

## PR 나누기 (각 400줄 이하)

1. **WE2-①** 기반: contracts capture 동기화·타입·captureApi·storage PUT·MSW(capture·capture-links)·AuthProvider role·고객 로그인 화면·RequireCustomer. WE3이 이 위로 rebase.
2. **WE2-②** 입장과 촬영: `/capture` 입장·교환·오류 문장, HTTPS 검사, 면 목록, 카메라·권한 안내, 윤곽 가이드, 흔들림·반사 검사와 다시 찍기.
3. **WE2-③** 제출: 건너뛴 이유, 세트 생성·PUT·완료, 진행률·실패분 재시도·409 처리, 접수 화면, 떠나기 전 경고.
4. **WE2-④** 관리자 수령 QR: CaptureLinkPanel + 렌탈 상세에 붙이기(WE1 ③ 머지 뒤).
