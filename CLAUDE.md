# web

TRACE의 관리자 화면·폰 촬영·3D 리포트·검증 페이지 레포입니다. 담당: C. 이 레포의 기능: WE1, WE2, WE3, WE4 (GAKDO/docs `speckit/backlog.md`).

## 먼저 읽을 것

- 헌법: `.specify/memory/constitution.md` (모든 명세·계획·구현의 기준. 원본은 GAKDO/docs `speckit/constitution.md`)
- 기능 목록과 붙여 넣을 설명: GAKDO/docs [`speckit/backlog.md`](https://github.com/GAKDO/docs/blob/main/speckit/backlog.md)
- 설계서: [`design/mvp-design.md`](https://github.com/GAKDO/docs/blob/main/design/mvp-design.md), REST API: [`design/rest-api-v0.md`](https://github.com/GAKDO/docs/blob/main/design/rest-api-v0.md), 테이블: [`design/ddl.md`](https://github.com/GAKDO/docs/blob/main/design/ddl.md), 결정: [`decisions.md`](https://github.com/GAKDO/docs/blob/main/decisions.md)
- 계약 원본: [GAKDO/contracts](https://github.com/GAKDO/contracts) (OpenAPI·JSON Schema·`codes.yaml`)

## 명령

- 설치: `npm ci`
- 개발 서버: `npm run dev`
- 검사: `npm run typecheck && npm test`, 빌드: `npm run build`

## Spec Kit으로 기능 하나 만들기

1. `git switch develop && git pull`
2. `/speckit-specify` + backlog.md의 설명 → `feature/<번호>-<이름>` 브랜치와 `specs/<번호>-<이름>/spec.md`
3. `/speckit-clarify` → 질문에 답하기
4. `/speckit-plan` + 아래 "계획에 줄 기술 설명"
5. `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement` → `/speckit-converge` (Converged까지 반복)
6. 로컬 검사가 통과하면 PR을 `develop`으로. 본문에 요구사항 ID를 적고 `specs/` 문서도 함께 올린다

## 계획에 줄 기술 설명

`/speckit-plan` 뒤에 그대로 붙여 넣습니다.

```
React 18 + TypeScript + Vite, React Router, API 타입은 contracts OpenAPI에서 openapi-typescript로 만들고 fetch 래퍼로 부른다. 서버 상태는 TanStack Query, 3D는 React Three Fiber + drei, 폰 촬영은 getUserMedia(HTTPS). 테스트는 Vitest + Testing Library + MSW(API 목). 375px·1280px 둘 다 맞춘다. 기존 nginx Dockerfile(8080, /version.txt)을 유지한다.
```

## 팀 운영 (모든 세션)

- **세션을 시작하면 먼저 `/trace-standup start`, 끝내기 전에 `/trace-standup end`.** 보드와 어제·오늘 기록을 읽고, 오늘 할 일·한 일·남은 것·막힌 것을 GAKDO/docs `team/`에 적는다.
- 세션에 이 레포와 함께 **GAKDO/docs를 연결**하면 바로 읽고 쓸 수 있다.
- 남은 작업은 `team/board.md`, 코드 컨벤션 전체는 `team/conventions.md`. 아래는 이 레포에 해당하는 요약이다.

## 코드 컨벤션 요약

- `src/features/<기능>/`(components·api·hooks), 공통은 `src/shared/`. 컴포넌트 PascalCase, 훅 `useXxx`.
- `strict`, `any` 금지. API 타입은 contracts OpenAPI에서 만든 것만. 서버 상태는 TanStack Query.
- 토큰은 메모리에만(localStorage 금지). 375px·1280px 확인. 테스트는 Vitest + Testing Library + MSW.
- 커밋 `<종류>(<범위>): <내용>`, PR 하나 = 백로그 기능 하나(코드 400줄 넘으면 나눔), PR 본문에 백로그 ID·요구사항 ID·테스트 방법.

## 꼭 지킬 것

- 계약(API·이벤트·진단 JSON·코드 값)을 바꿔야 하면 코드를 고치지 말고 멈추고 사람에게 알린다.
- 비밀번호·토큰·키·학번을 코드·문서·커밋에 넣지 않는다. 설정은 환경 변수로 받는다.
- 커밋은 `<종류>(<범위>): <내용>`(feat·fix·refactor·test·docs·chore·ci), 문서·PR·주석은 한국어.
- 레포 이름은 `_server`, 클러스터 안 서비스·이미지 이름은 `-server`(예: `auth-server`).
