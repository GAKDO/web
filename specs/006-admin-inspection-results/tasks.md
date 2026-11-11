# Tasks: 관리자 검사 결과 화면 (MVP, 부스 빠른 검사)

- [x] T001 model/verdict.ts + 테스트: 시점 없음 → 검사 전, 404/grade null → 판정 대기, grade null + reasons → 판정 불가, A → 문제 없음, B~D → 문제 있음 (FR-003)
- [x] T002 api/inspections.ts useCheckpointInspection(404 → null, retry 없음) (FR-003·006)
- [x] T003 [US1·US2] 테스트 먼저: 목록 네 판정·결과 보기 링크·더 보기, 상세 문제 있음(등급·근거·흠집 카드)·문제 없음·404 안내·5xx 다시 시도·메뉴 링크
- [x] T004 [US1] VerdictBadge + InspectionListPage (FR-002·003)
- [x] T005 [US2] InspectionDetailPage(판정 상자·근거·규칙 버전·흠집 카드) (FR-004·005)
- [x] T006 라우트·관리 메뉴 "검사 결과", labels DEFECT_SOURCE_LABEL (FR-001)
- [x] T007 스타일, 375·1280 스크린샷, 가로 스크롤 없음 (FR-008)
- [x] T008 `npm run typecheck && npm test && npm run build`
- [x] T009 contracts #20 머지(11/3 07:43) 뒤 두 번째 PR: 계약 사본 갱신(`scripts/sync-contracts.sh` + `npm run gen:api`), `useCheckpointMedia`(404 → null, 만료 전 갱신), model/photos.ts(면마다 카메라 × 조명 격자, 면 사진 겹치기) + 테스트, PhotoWithDefects(SVG viewBox = natural 크기), PhotoGrid, 상세에 사진 절·빠른 검사 흠집 카드, 목 QUICK 예(LGGRAM0003 출고 C, 사진 12장) (FR-005·007)
- [x] T011 두 번째 PR: 빠른 검사 상세 375·1280 스크린샷, 사진 오류 때 판정 유지 테스트, `npm run typecheck && npm test && npm run build`
- [ ] T010 11/6 gakdo.site에서 부스 세트의 등급 확인(SC-003)
