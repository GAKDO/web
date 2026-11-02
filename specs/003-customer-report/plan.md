# Implementation Plan: 고객 렌탈 목록·3D 리포트 화면 (WE3)

**Branch**: `claude/project-thread-jhk3uc` | **Date**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-customer-report/spec.md`

## Summary

고객(과 관리자)이 보는 렌탈 목록과 렌탈 리포트 화면을 만든다. 리포트는 시점 카드, 3D 트윈(기종 치수 상자 + 면 사진 + 흠집 핀 + 시점 슬라이더), 시점 비교표, 검사 진행률 칸으로 이뤄진다. API 타입은 contracts develop `fd35e33`의 `report-server.yaml`·`diagnostics-server.yaml`(이 기능이 더함)과 `capture-server.yaml`(WE2가 더함)에서 openapi-typescript로 만들고, 호출은 기존 `src/shared/api/client.ts`로만 한다. 서버 RP1·RP2·ML2·CA2가 없으니 MSW 목으로 만들고 테스트한다. 고객 로그인·`RequireCustomer` 가드는 WE2 기반 PR을 다시 쓴다.

## Technical Context

**Language/Version**: TypeScript 5.9(strict), React 18.3, Node 22

**Primary Dependencies**: 기존(Vite 6, React Router 6.30, TanStack Query 5, openapi-fetch 0.17, MSW 2.15) + 새로 `three@0.170`, `@react-three/fiber@8.18`(React 18용 마지막 주 버전), `@react-three/drei@9.122`(OrbitControls·Html), `@microsoft/fetch-event-source@2.0.1`(계약이 지정한 진행률 SSE 방식, Authorization 헤더 필요). 근거는 아래 "결정".

**Storage**: 없음. 토큰·사진 보기 주소는 메모리(TanStack Query 캐시)에만.

**Testing**: Vitest 3 + Testing Library + MSW(node). 3D 캔버스는 jsdom에서 WebGL이 없어 그리지 않는다. 그래서 (1) 핀 좌표 → 3D 위치 바꾸기, 슬라이더 → 보일 핀 고르기, 비교표 값 계산을 순수 함수로 빼서 단위 테스트하고, (2) 화면 테스트는 WebGL이 없을 때의 대체 화면(면별 사진 목록 + 핀 목록)으로 같은 수용 시나리오를 확인한다. 실제 3D는 `npm run dev`(목)와 팀 노트북·폰에서 손으로 확인하고 스크린샷을 남긴다.

**Target Platform**: 최신 Chrome·Safari, 375px·1280px.

**Constraints**: 계약 타입만, `any` 금지, 토큰 저장 금지, PR 하나에 코드 400줄 이하(`contracts/`·`generated/`·`specs/` 제외), 3D 코드는 리포트 화면에서만 지연 로딩(`React.lazy`)해 관리자 화면 묶음 크기에 영향 없게.

**Scale/Scope**: 화면 2개(내 렌탈 목록, 렌탈 리포트), API 9개 operation(모두 GET), 리포트 안 구성 4개(시점 카드, 3D, 비교표, 진행률).

## Constitution Check

| 원칙 | 점검 | 결과 |
| --- | --- | --- |
| I. 계약이 먼저 | 쓰는 필드는 모두 C1에 있다(아래 ui-api-usage). 계약 변경 없음. 핀 좌표계(텍스처와 같은 펼친 면 px)는 계약 설명대로 따르고 A에게 확인만 한다 | 통과 |
| II. 서비스 경계 | gateway `/api/v1/...`만 부른다. 리포트는 report·capture·diagnostics·rental을 화면에서 각각 부른다(합치는 서버 없음) | 통과 |
| III. 기록은 고칠 수 없다 | 화면은 모두 읽기 전용 | 통과 |
| IV. 테스트 | 수용 시나리오마다 테스트, 순수 함수 단위 테스트, `typecheck && test && build` | 통과 |
| V. 비밀·개인정보 | 사진 보기 주소·토큰은 저장소에 두지 않음, 로그에 남기지 않음. 목 값은 계약 예시만 | 통과 |
| VI. 단순하게 | 3D는 상자 두 개(열린 노트북 하나), 열고 닫기 없음, 실물 스캔 없음 | 통과 |
| ID 규칙 | URL·목은 publicId(nanoid 21자)만 | 통과 |

## Project Structure

```text
specs/003-customer-report/
├── spec.md · plan.md · tasks.md
├── contracts/ui-api-usage.md   # 화면 × operation × 오류 → 문장
└── checklists/requirements.md

contracts/openapi/{report-server,diagnostics-server}.yaml   # 사본에 더함 (capture-server.yaml은 WE2)
src/shared/api/generated/{report,diagnostics}.ts           # 생성
src/shared/api/types.ts                                    # 별칭 덧붙임
src/shared/codes/labels.ts                                 # 흠집 종류·플래그·진행 단계·등급 이름표 덧붙임
src/shared/mocks/
├── report.ts                     # 고객 렌탈 목 데이터(시점 3개, 핀·진단·텍스처 SVG data URL)
└── handlers/{report,capture-report,diagnostics}.ts
src/features/report/
├── api/report.ts                 # useMyRentals, useTimeline, useCheckpointMedia(만료 전 새로 받기), useInspection, useDiagnostics, useDeviceModel, useProgress
├── model/                        # 순수 함수(테스트 대상)
│   ├── pins.ts                   # 핀(면, x, y) + 텍스처 크기 + 치수 → 3D 위치·법선
│   ├── timeline.ts               # 슬라이더에 올릴 시점, 고른 시점의 핀(신규 구분)
│   └── compare.ts                # 비교표 행(등급·신규 흠집·배터리 차이·플래그)
└── components/
    ├── MyRentalsPage.tsx
    ├── ReportPage.tsx            # 시점 카드·체인 경고·403/404
    ├── CheckpointSlider.tsx
    ├── TwinViewer.tsx            # lazy: three/R3F 캔버스
    ├── TwinFallback.tsx          # WebGL 없을 때 면별 사진 + 핀 목록
    ├── PinDetail.tsx
    ├── CompareTable.tsx
    └── ProgressBadge.tsx
```

라우트: `/my/rentals`, `/my/rentals/:rentalId`(WE2의 `RequireCustomer` 아래, 고객·관리자 허용). 관리자 렌탈 상세에 `/my/rentals/:rentalId` 링크 "리포트 보기" 하나.

## 결정

- **3D 라이브러리**: React Three Fiber 8 + drei 9. 계획 기술 설명이 R3F를 지정했고, React 18이라 R3F 9(React 19 전용)는 못 쓴다. 다른 안(three.js 직접)은 React 상태와 맞추는 코드가 더 길다.
- **모델 모양**: 본체 상자(widthMm × baseHMm × depthMm)와 화면 상자(widthMm × lidHMm × depthMm)를 뒤쪽 경첩에서 110° 연다. 면 → 상자 면: TOP=화면 상자 바깥, SCR0·SCR1=화면 상자 안쪽(슬라이더 시점에 SCR0 우선, 없으면 SCR1), KB=본체 윗면, BOT=본체 바닥, SF·SB·SL·SR=본체 앞·뒤·왼쪽·오른쪽 옆면. 화면 상자 옆면은 회색. 이 대응은 codes.yaml `capture.face` 주석을 따르고, ML2 텍스처 방향(위아래)이 다르면 이 표 하나만 고친다.
- **핀 위치**: 핀 (x, y)는 펼친 면 px이고 텍스처도 같은 펼친 면이므로, 텍스처의 실제 가로·세로 px(이미지를 읽은 뒤의 naturalWidth·Height)로 나눠 0~1 비율로 바꾸고 상자 면 위의 점으로 놓는다. 텍스처가 없는 면은 핀을 그리지 않고 대체 목록에만 보인다.
- **신규 핀**: 계약의 `isNew`만 쓴다(화면이 직접 비교하지 않음). 색(주황) + "신규" 글자 + 크기를 함께 바꿔 색만으로 구분하지 않는다.
- **사진 주소 새로 받기**: `useCheckpointMedia`의 `staleTime`/`refetchInterval`을 `expiresAt - 1분`으로 잡는다.
- **진행률**: `fetchEventSource`로 `/reports/rentals/{id}/stream`을 연다. 헤더는 tokenStore의 토큰. 401이면 `refreshSession()` 뒤 다시 연다. `done` 이벤트가 오면 타임라인·검사·진단 쿼리를 무효화한다. 봉인 안 된 시점이 없으면 열지 않는다. 계약에 `Last-Event-ID`가 없어 "마지막 상태부터"는 다시 붙었을 때 서버가 보내는 첫 progress로 채운다.
- **비교표**: 열 = 봉인된 시점, 행 = 등급 / 신규 흠집(수 + 크롭 썸네일) / 배터리 최대 용량(%, 직전 대비 %p) / 배터리 사이클 / SSD 상태(읽지 못하면 사유) / 점검 플래그(문장). 375px에서는 시점마다 카드로 쌓는다(CSS만).
- **목 데이터**: 고객 계정에 렌탈 2개(① 출고·수령 봉인 + 반납 검사 중, ② 출고만 봉인). 텍스처는 면 이름이 적힌 SVG data URL(외부 요청 없음). 수령 시점에 신규 긁힘 1개, 배터리 91.2% → 84.0%와 `CAPACITY_DROP` 플래그.

## PR 나누기 (코드 400줄 규칙)

WE2 기반 PR(고객 로그인·RequireCustomer·capture 타입)이 develop에 머지된 뒤, develop을 받아 그 위로 차례로 낸다.

1. ① 기반·목록·리포트 틀: report·diagnostics 타입, 목 데이터·핸들러, 내 렌탈 목록, 리포트 시점 카드·403/404·체인 경고, 관리자 "리포트 보기" 링크 (US1)
2. ② 비교표 (US4)
3. ③ 3D 트윈·핀·슬라이더 (US2·US3). 400줄을 넘으면 ③-a 3D·텍스처, ③-b 핀·슬라이더·핀 상세
4. ④ 검사 진행률 (US5)

## 위험·의존

- WE2 기반 PR이 늦으면 ①을 열 수 없다. 그동안 순수 함수·컴포넌트(②·③)를 먼저 만들어 둔다.
- 핀 좌표계·텍스처 방향은 ML2(A)가 정한다. 다르면 `model/pins.ts`의 면 대응표만 고친다.
- 고객이 `GET /device-models/{modelCode}`를 부를 수 있다(계약 CUSTOMER 허용). 실제 서버 권한이 다르면 3D가 대체 화면으로 떨어진다.
- 렌탈 목 핸들러(`handlers/rental.ts`)는 지금 관리자만 받는다. 고객 본인 렌탈 조회(`GET /rentals`, `GET /rentals/{id}`)를 열도록 고친다. WE1·WE2도 건드리는 파일이라 머지 순서대로 rebase한다.

## Complexity Tracking

헌법 위반 없음. 새 의존성 4개는 계획 기술 설명(R3F + drei)과 계약(fetch 기반 SSE)이 지정한 것이다.
