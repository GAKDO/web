# Tasks: 폰 수령 촬영과 수령 QR 발급 (WE2)

**Input**: spec.md, plan.md, research.md, data-model.md, contracts/ui-api-usage.md
테스트 이름은 수용 시나리오 문장(헌법 IV). [P] = 다른 파일이라 같이 해도 됨.

## Phase 1: 기반 (PR WE2-①)

- [ ] T001 `scripts/sync-contracts.sh`·`package.json gen:api`에 capture-server.yaml 더하고 contracts `fd35e33`으로 동기화, `src/shared/api/generated/capture.ts` 생성
- [ ] T002 `src/shared/api/types.ts`에 capture·capture-link 타입 별칭
- [ ] T003 `src/shared/auth/captureTokenStore.ts`(메모리) + `src/shared/api/client.ts`에 `captureApi`(촬영 JWT만, 리프레시 없음)
- [ ] T004 [P] `src/shared/api/storage.ts` 사전 서명 PUT(받은 헤더 그대로)
- [ ] T005 [P] MSW: `handlers/auth.ts` capture-links 발급·교환(410·409), `handlers/capture.ts` 세트 생성·완료(409 빠진 면·해시)·저장소 PUT, `db.ts` 링크·세트
- [ ] T006 `AuthProvider` role·`login(…, expected)`, `RequireCustomer`, `/login?next=` 고객 로그인 화면(US2-1)
- [ ] T007 테스트: 고객 로그인 뒤 next로 돌아옴, next가 외부 주소면 무시, 관리자 로그인 동작 그대로, 목 PUT 해시 확인

## Phase 2: 입장과 촬영 (PR WE2-②) — US2, US3

- [ ] T008 `features/capture/faces.ts` 면 목록·필수·가이드·윤곽 비율 + codes.yaml 대조 테스트
- [ ] T009 [P] `features/capture/quality.ts` 흔들림·반사 순수 함수 + 합성 픽셀 테스트(SC-001·003)
- [ ] T010 [P] `features/capture/camera.ts` getUserMedia(후면 우선)·프레임 JPEG·SHA-256
- [ ] T011 `CaptureEntryPage` `/capture?t=`: HTTPS 검사(US2-5), 미로그인 → 로그인(US2-1), 교환·주소창 토큰 지움(FR-005), 410·409·403 문장(US2-3·4)
- [ ] T012 `CapturePage` 면 목록·체크·남은 면, 늘 보이는 "새로 고치지 마세요"(FR-007a), 남은 시간 5분 경고(FR-007)
- [ ] T013 `FaceShooter` 카메라·윤곽 겹침·찍기·검사 결과·다시 찍기(US3-1~5), `CameraHelp` 권한 거부 안내(US3-6)

## Phase 3: 제출 (PR WE2-③) — US4

- [ ] T014 `features/capture/submit.ts` 세트 생성 → PUT 2개씩 → 완료(Idempotency-Key), 실패분만 재시도, 만료·해시 불일치면 새 세트, 409 빠진 면
- [ ] T015 `SkipReasonDialog`(SCR1 건너뛴 이유), 제출 버튼·진행률·오류 문장·접수 화면(US4-1~7), 떠나기 전 경고
- [ ] T016 테스트: US4 시나리오 1~7, SC-001(불량 사진 0장 제출), SC-004, SC-005(저장소에 토큰 없음)

## Phase 4: 관리자 수령 QR (PR WE2-④) — US1 (WE1 ③ 머지 뒤)

- [ ] T017 `qrcode` 추가, `features/rentals/components/CaptureLinkPanel.tsx` QR·링크 복사·만료 시각·다시 만들기 안내
- [ ] T018 렌탈 상세에 붙이기: 출고 전이면 꺼짐(US1-2), 테스트 US1-1~4

## Phase 5: 마무리

- [ ] T019 375px·1280px 스크린샷(`/mnt/project-files/we2/screenshots/`), quickstart 따라 해 보기
- [ ] T020 실제 서버 확인(auth·capture·MinIO CORS) — 서버 배포 뒤, 확인되면 시트 작동 체크
