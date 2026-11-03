# Implementation Plan: 관리자 검사 결과 화면 (MVP, 부스 빠른 검사)

**Branch**: `claude/project-thread-prgvfq` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

## Summary

관리 메뉴 "검사 결과": 렌탈 목록의 지금 시점마다 `GET …/inspection` 등급으로 판정(문제 없음/있음/대기/불가/검사 전)을 보이는 목록과, 판정·근거·흠집 카드를 보이는 상세. 계약 변경 없음(1.0.0 값만). 사진·폴리곤은 contracts #20 머지 뒤 다음 PR.

## Technical Context

React 18 + TypeScript + Vite, React Router, API 타입은 contracts OpenAPI(rental·capture)에서 만든 생성물, openapi-fetch 래퍼(`api`). 서버 상태는 TanStack Query(목록은 `useRentals`, 검사 결과는 `["inspections", checkpointId]`, 404는 retry 없음). 테스트는 Vitest + Testing Library + MSW(기존 `captureReportHandlers`·`rentalHandlers`). 375px·1280px.

## Constitution Check

- I 계약 우선: 경로·필드는 1.0.0 그대로. #20의 선택 필드(photos·coordinateSpace)는 머지 전까지 쓰지 않는다.
- 개인정보: 화면에 시리얼·기종·등급·흠집만. 대여자 참조 번호는 목록에 보이지 않는다.
- 400줄 규칙: 코드 약 250줄 + 테스트.

## Structure

```
src/features/inspections/
  api/inspections.ts            useCheckpointInspection(checkpointId)  (404 → null)
  model/verdict.ts              verdictOf(checkpoint, inspection, state) → {kind, grade, label}
  model/verdict.test.ts
  components/VerdictBadge.tsx   목록 카드의 판정 글자(상태별 색)
  components/InspectionListPage.tsx
  components/InspectionDetailPage.tsx
  Inspections.test.tsx
src/shared/codes/labels.ts      DEFECT_SOURCE_LABEL
src/shared/auth/RequireAdmin.tsx 메뉴 "검사 결과"
src/App.tsx                     /admin/inspections, /admin/inspections/:rentalId/:checkpointId
src/styles.css                  .verdict-pending, .defect-card 보조
```

## Research / 결정

- 목록의 판정은 카드마다 쿼리 하나(렌탈 20건 = 요청 20개). 전용 API가 없고 MVP 규모(기기 수십 대)에서 충분하다. 요청을 줄여야 하면 A와 "최근 검사 목록" API를 논의한다.
- 404(검사 결과 없음)는 오류가 아니라 "판정 대기" 상태다. `unwrap`이 던지는 `ApiError(404)`를 queryFn에서 잡아 null로 바꾼다.
- 판정 상자는 공개 검증 페이지의 `.verdict` 스타일(색 + 문구 + 기호)을 재사용한다.
