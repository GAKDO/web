# Implementation Plan: 관리자 수동 봉인(시연 우회로)·사용 기록 화면

**Branch**: `claude/project-thread-prgvfq` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

## Summary

렌탈 상세(WE1)의 봉인 안 된 시점 카드에 "직접 봉인" 폼(등급·사유)을 붙이고, 관리 메뉴에 "수동 봉인 기록" 목록 화면을 더한다. 계약 report-server 1.0.0의 `sealCheckpointManually`·`listManualSeals`만 부른다. 계약 변경 없음.

## Technical Context

React 18 + TypeScript + Vite, React Router, API 타입은 contracts OpenAPI(report-server.yaml, 이미 `generated/report.ts`에 있음)에서 openapi-typescript로 만들고 openapi-fetch 래퍼(`api`)로 부른다. 서버 상태는 TanStack Query(mutation → `["rentals"]`·`["report"]` 무효화). 테스트는 Vitest + Testing Library + MSW. 375px·1280px. nginx Dockerfile 유지.

## Constitution Check

- I 계약 우선: 경로·본문·오류 코드는 계약 그대로. `ManualSealRequest`·`ChainRecord`·`ManualSealPage` 타입을 생성물에서 꺼낸다.
- 비밀값·개인정보: 사유 칸에 개인정보를 적지 말라고 안내한다. sealedBy는 계약의 publicId만.
- 400줄 규칙: 코드(components·api·mocks·types·라우트) 약 300줄 + 테스트. 체인 보기는 다음 PR.

## Structure

```
src/features/rentals/
  api/manualSeal.ts                useSealManually(rentalId), useManualSeals()
  components/ManualSealPanel.tsx   버튼 + 폼(등급·사유·안내), 오류 문장
  components/ManualSealListPage.tsx 사용 기록 목록(더 보기)
  components/RentalDetailPage.tsx  봉인 안 된 카드에 패널, 성공 안내(role=status)
  ManualSeal.test.tsx
src/shared/ui/Field.tsx            TextAreaField 추가
src/shared/api/types.ts            ManualSealRequest·ChainRecord·ManualSealItem
src/shared/mocks/db.ts             manualSeals 상태(초기 1건)
src/shared/mocks/handlers/report.ts POST seal(404·400·409), GET manual-seals(limit·cursor)
src/shared/auth/RequireAdmin.tsx   관리 메뉴 "수동 봉인 기록"
src/App.tsx                        /admin/manual-seals
src/styles.css                     .field textarea, .manual-seal
```

## Research / 결정

- 폼은 `ConfirmDialog`(문장만)로는 등급·사유를 받을 수 없어 같은 `.confirm` 테두리의 작은 `<form>`으로 만든다. 되돌릴 수 없는 동작이라 봉인 버튼은 `.danger`.
- 목의 payloadHash·서명은 가짜 값(결정적 64자 hex, base64 문자열)이다. 화면은 순번만 쓴다.
- 사용 기록 커서는 기존 렌탈 목록 목과 같은 "시작 인덱스" 문자열이다.
