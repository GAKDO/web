# Tasks: 관리자 수동 봉인(시연 우회로)·사용 기록 화면

- [ ] T001 types.ts에 ManualSealRequest·ChainRecord·ManualSealItem (FR-008)
- [ ] T002 목: db.manualSeals(초기 1건), POST seal(404·400 reason/checkpointType·409 ALREADY_SEALED/ORDER, 시점·타임라인 봉인, 기록 쌓기), GET manual-seals(limit·cursor) (FR-008)
- [ ] T003 [US1·US2] 테스트 먼저: 버튼 유무, 입력 미달이면 꺼짐, 성공 → 안내·봉인·수령 시작 켜짐·기록 저장, 409 → 문장·다시 읽기, 400 → 폼 안 문장, 취소, 목록·더 보기·빈 목록·메뉴 링크
- [ ] T004 [US1] api/manualSeal.ts useSealManually(무효화 rentals·report)·useManualSeals (FR-003·004·006)
- [ ] T005 [US1] Field.tsx TextAreaField, ManualSealPanel(등급·사유 5~300·글자 수·안내·오류) (FR-001·002·005)
- [ ] T006 [US1] RentalDetailPage: 봉인 안 된 카드에 패널, 성공 안내 role=status (FR-004)
- [ ] T007 [US2] ManualSealListPage + `/admin/manual-seals` 라우트 + 관리 메뉴 링크 (FR-006·007)
- [ ] T008 스타일(.field textarea, .manual-seal), 375·1280 스크린샷, 가로 스크롤 없음 (FR-009)
- [ ] T009 `npm run typecheck && npm test && npm run build`
- [ ] T010 11/5 배포 뒤 실제 report-server로 수동 봉인 1건 → 기록·검증 페이지 확인(SC-003)
