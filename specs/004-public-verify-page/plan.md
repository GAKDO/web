# Implementation Plan: 공개 검증 페이지 (WE4 앞부분)

**Branch**: `claude/project-thread-jrshvh` | **Date**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

## Summary

`/verify/:verifyToken` 공개 라우트 하나. 토큰 형식을 먼저 보고, 맞으면 report-server `GET /api/v1/verify/{verifyToken}`을 토큰 없이 부른 뒤 정상/불일치/찾을 수 없음/확인 불가 넷 중 하나를 보인다.

## Technical Context

React 18 + TypeScript + Vite, React Router, API 타입은 contracts OpenAPI(report-server.yaml)에서 openapi-typescript로 만들고 openapi-fetch 래퍼로 부른다. 서버 상태는 TanStack Query. 테스트는 Vitest + Testing Library + MSW. 375px·1280px. 기존 nginx Dockerfile(8080, /version.txt, `try_files … /index.html`로 /verify 경로도 SPA로 열림) 유지.

## Constitution Check

- I 계약 우선: report-server.yaml을 web/contracts에 복사(sync-contracts.sh에 추가)하고 타입만 생성해 쓴다. 계약 변경 없음. 시점별 불일치 표시는 계약에 없어 하지 않는다.
- V 비밀값: 공개 화면은 토큰을 보내지 않는다(`publicApi`, credentials omit).
- 개인정보: 계약 필드 4개만 화면에 쓴다.

## Structure

```
src/features/verify/
  api/verify.ts            useVerify, isVerifyToken
  components/VerifyPage.tsx
  format.ts                shortHash, formatKst(Asia/Seoul)
  VerifyPage.test.tsx
src/shared/api/client.ts   publicApi 추가(토큰·쿠키 없음)
src/shared/api/types.ts    VerifyResponse·VerifyRecord·InspectionGrade, ApiPaths에 report 추가
src/shared/api/generated/report.ts   생성물
src/shared/codes/labels.ts INSPECTION_GRADE_LABEL
src/shared/mocks/handlers/verify.ts  토큰으로 정상·불일치·500·그 밖 404
src/shared/auth/AuthProvider.tsx     처음 세션 되살리기 실패 때 queryClient.clear() 하지 않음
```

## Research / 결정

- openapi-fetch는 만들 때 `globalThis.fetch`를 잡는다. 테스트의 MSW가 끼어들도록 `publicApi`도 부를 때 fetch를 찾는 함수로 넘긴다(기존 `api`와 같은 방식).
- AuthProvider가 익명 방문자의 첫 되살리기 실패에서 `queryClient.clear()`를 불러, 공개 화면의 진행 중 쿼리가 사라지고 "확인하는 중"에 멈추는 버그를 테스트로 찾았다. 첫 실패에는 지울 캐시가 없으므로 clear를 빼고 상태만 anonymous로 둔다. 만료(세션 끝)·로그아웃 때의 clear는 그대로다. WE2·WE3의 공개·고객 화면에도 같은 문제가 생길 자리였다.
