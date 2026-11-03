# Tasks: 관리자 검사 결과 화면 (MVP, 부스 빠른 검사)

- [ ] T001 model/verdict.ts + 테스트: 시점 없음 → 검사 전, 404/grade null → 판정 대기, grade null + reasons → 판정 불가, A → 문제 없음, B~D → 문제 있음 (FR-003)
- [ ] T002 api/inspections.ts useCheckpointInspection(404 → null, retry 없음) (FR-003·006)
- [ ] T003 [US1·US2] 테스트 먼저: 목록 네 판정·결과 보기 링크·더 보기, 상세 문제 있음(등급·근거·흠집 카드)·문제 없음·404 안내·5xx 다시 시도·메뉴 링크
- [ ] T004 [US1] VerdictBadge + InspectionListPage (FR-002·003)
- [ ] T005 [US2] InspectionDetailPage(판정 상자·근거·규칙 버전·흠집 카드·사진 자리 안내) (FR-004·005·007)
- [ ] T006 라우트·관리 메뉴 "검사 결과", labels DEFECT_SOURCE_LABEL (FR-001)
- [ ] T007 스타일, 375·1280 스크린샷, 가로 스크롤 없음 (FR-008)
- [ ] T008 `npm run typecheck && npm test && npm run build`
- [ ] T009 contracts #20 머지 뒤: 계약 사본 갱신 → 사진 N장(면·카메라·조명)·PHOTO 좌표 폴리곤 겹쳐 보기 (다음 PR)
- [ ] T010 11/6 trace.java21.net에서 부스 세트의 등급 확인(SC-003)
