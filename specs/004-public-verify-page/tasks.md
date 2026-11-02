# Tasks: 공개 검증 페이지 (WE4 앞부분)

- [x] T001 sync-contracts.sh·gen:api에 report-server.yaml 추가, contracts fd35e33으로 동기화, `generated/report.ts` 생성
- [x] T002 types.ts에 VerifyResponse·VerifyRecord·InspectionGrade, ApiPaths에 report 경로
- [x] T003 client.ts `publicApi`(토큰·쿠키 없음) (FR-002)
- [x] T004 MSW verify 목: 정상·불일치·500·404, seq를 섞은 기록 (FR-011)
- [x] T005 [US1·US2·US3] 테스트 먼저: 정상, 등급 없음, 지문 펼치기, 불일치, 형식 오류(서버 안 부름), 404, 500→다시 시도, 연결 실패, 로그인해도 토큰 없음, 계약 밖 필드 무시
- [x] T006 [US1] format.ts(shortHash, 한국 시간), labels 등급 이름표
- [x] T007 [US1·US2·US3] VerifyPage + `/verify/:verifyToken` 라우트 (FR-001·003~008)
- [x] T008 AuthProvider 첫 되살리기 실패 때 캐시 지우지 않기(T005가 찾은 버그)
- [x] T009 스타일(정상·불일치 색 + 기호 + 문구), 375·1280 스크린샷, 가로 스크롤 없음 확인 (FR-010)
- [x] T010 `npm run typecheck && npm test && npm run build`
- [ ] T011 RP1 머지·배포 뒤 실제 report-server로 정상·불일치 확인(SC-004), 시트 21행 체크
