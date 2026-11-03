# Feature Specification: 관리자 수동 봉인(시연 우회로)·사용 기록 화면

**Feature Branch**: `claude/project-thread-prgvfq` (Spec Kit 기본 이름은 `feature/005-admin-manual-seal`. 이 세션은 지정 브랜치만 푸시할 수 있어 이름을 바꿈)

**Created**: 2026-11-03

**Status**: Draft

**Input**: 11/3 chan "이제 웹 만들자" → 백로그 WE1~WE4 화면은 모두 머지돼 있어, 계약(report-server 1.0.0)에는 있지만 화면이 없는 관리자 기능 중 시연 안전장치인 수동 봉인부터 만든다. 계약 `POST /api/v1/reports/rentals/{rentalId}/checkpoints/{checkpointId}/seal`(관리자 수동 봉인, 시연 우회로)과 `GET /api/v1/reports/manual-seals`(사용 기록), 11/2 결정(decisions.md "봉인은 시점마다 한 줄").

**관련 요구사항**: FR-INT-01(해시 체인, 수동 봉인도 같은 체인), FR-RNT-02(출고 → 수령 → 반납 흐름이 봉인에 막히지 않게)

## Clarifications

### Session 2026-11-03 (chan에게 우선순위 카드를 보내고 답 전까지 추천안으로 진행)

- Q: 수동 봉인 버튼은 어디에 두나? → A: 렌탈 상세의 시점 카드 안, 봉인되지 않은 시점(촬영 대기·촬영됨·등급 매김)에만. 시점은 앞 시점이 봉인된 뒤에만 시작되므로 봉인 안 된 시점은 한 번에 하나다. 리포트(고객 화면)에는 두지 않는다.
- Q: 등급은 어떻게 받나? → A: 계약 `ManualSealRequest.grade`가 필수라 관리자가 A~D 중 하나를 고른다. 화면이 등급을 추정하지 않는다.
- Q: 시점 종류(checkpointType)는? → A: 카드의 시점 종류를 그대로 보낸다. 서버가 아는 종류와 다르면 400 VALIDATION_FAILED가 오고 그 문장을 폼 안에 보인다.
- Q: 사용 기록 화면은 어디에? → A: 관리 메뉴 "수동 봉인 기록"(`/admin/manual-seals`). 최근 것부터, 더 보기(커서).
- Q: 왜 "시연 우회로"라고 화면에 쓰나? → A: 계약 설명대로 검사 파이프라인이 돌지 못했을 때만 쓰는 길이라, 평소에 누르지 않도록 버튼 옆과 폼 안에 그 말을 적는다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 검사가 멈춘 시점을 관리자가 직접 봉인 (Priority: P1)

시연 중 집 PC 검사 워커가 꺼져 시점이 "촬영됨"에서 멈추면, 관리자가 렌탈 상세에서 그 시점의 등급과 사유를 적어 직접 봉인한다. 봉인되면 다음 시점을 시작할 수 있다.

**Why this priority**: 봉인이 나지 않으면 수령·반납을 시작할 수 없어 시연이 멈춘다. 계약은 있는데 화면이 없어 지금은 curl로만 가능하다.

**Independent Test**: 목 서버로 출고 시점을 시작한 뒤(촬영 대기) 직접 봉인 → 출고가 봉인으로 바뀌고 수령 시작 버튼이 켜지는지 본다.

**Acceptance Scenarios**:

1. **Given** 봉인되지 않은 시점 카드, **When** 카드를 보면, **Then** "직접 봉인" 버튼과 "검사가 멈췄을 때만 씁니다" 안내가 보인다. 봉인된 시점 카드에는 버튼이 없다.
2. **Given** 직접 봉인을 눌러 폼이 열림, **When** 등급을 고르지 않았거나 사유가 5자 미만이면, **Then** 봉인 버튼이 꺼져 있고 서버를 부르지 않는다.
3. **Given** 등급 B·사유 "집 PC가 꺼져 정합을 못 함"을 적음, **When** 봉인을 누르면, **Then** "출고 시점을 직접 봉인했습니다(기록 1번)" 안내가 보이고, 카드가 봉인으로 바뀌며, 수령 시작 버튼이 켜진다.
4. **Given** 다른 탭에서 이미 봉인된 시점, **When** 봉인을 누르면(409 RECORD_ALREADY_SEALED), **Then** "이미 봉인된 기록입니다" 문장이 보이고 상세를 다시 읽어 카드가 봉인으로 보인다.
5. **Given** 서버가 시점 종류가 다르다고 400을 주면, **When** 봉인을 누르면, **Then** 서버 문장이 폼 안에 보이고 폼은 열린 채다.
6. **Given** 폼이 열림, **When** 취소를 누르면, **Then** 폼이 닫히고 적은 내용은 지워진다.

---

### User Story 2 - 수동 봉인 사용 기록 보기 (Priority: P2)

관리자가 누가·언제·어느 렌탈의 어느 시점을·왜 직접 봉인했는지 확인한다.

**Why this priority**: 우회로를 썼다는 사실이 보여야 체인의 신뢰가 유지된다(계약: 쓸 때마다 기록에 남는다).

**Independent Test**: 목 기록 25건을 넣고 화면을 열어 20건이 보이고 더 보기로 나머지가 붙는지 본다.

**Acceptance Scenarios**:

1. **Given** 관리 메뉴, **When** "수동 봉인 기록"을 누르면, **Then** 최근 것부터 시점 종류·등급·기록 번호·봉인 시각·관리자 ID·사유가 카드로 보이고 "렌탈 보기"로 렌탈 상세에 간다.
2. **Given** 기록이 20건 넘음, **When** 더 보기를 누르면, **Then** 다음 쪽이 아래에 이어 붙는다.
3. **Given** 기록이 없음, **When** 화면을 열면, **Then** "수동 봉인을 쓴 기록이 없습니다"가 보인다.

### Edge Cases

- 사유는 앞뒤 공백을 뺀 길이로 5~300자를 센다. 300자를 넘기면 더 입력되지 않고 글자 수가 보인다.
- 봉인 요청이 처리 중이면 봉인 버튼을 다시 누를 수 없다.
- 수동 봉인 성공 뒤 리포트 화면의 시점·비교표도 다시 읽히도록 리포트 캐시를 비운다.
- 봉인 뒤 렌탈 상세 다시 읽기가 실패해도 안내 문장과 시점 카드는 그대로 남는다(기존 규칙).
- 계정 ID(sealedBy)는 계약대로 publicId를 그대로 보인다. 이름·이메일은 계약에 없어 보이지 않는다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 렌탈 상세의 시점 카드 중 상태가 봉인(SEALED)이 아닌 카드에 "직접 봉인" 버튼과 한 줄 안내를 보인다.
- **FR-002**: 폼은 등급(A~D 선택, 필수)과 사유(5~300자, 글자 수 표시)를 받고, 둘이 맞기 전에는 봉인 버튼을 끈다.
- **FR-003**: 봉인은 `POST /api/v1/reports/rentals/{rentalId}/checkpoints/{checkpointId}/seal`에 `{checkpointType: 카드의 시점 종류, grade, reason}`을 보낸다.
- **FR-004**: 성공(201)하면 폼을 닫고 "{시점} 시점을 직접 봉인했습니다(기록 {seq}번)"를 role=status로 보이며, 렌탈·리포트 캐시를 비워 상세를 다시 읽는다.
- **FR-005**: 오류는 codes.yaml error_code의 문장(`messageFor`)으로 폼 안에 보인다. 409(RECORD_ALREADY_SEALED·CHECKPOINT_ORDER_VIOLATION)는 상세를 다시 읽는다. 400 VALIDATION_FAILED는 서버 detail을 덧붙인다.
- **FR-006**: `/admin/manual-seals`에서 `GET /api/v1/reports/manual-seals`(limit 20, cursor)를 읽어 최근 것부터 보이고 더 보기로 다음 쪽을 이어 붙인다. 관리 메뉴에 "수동 봉인 기록" 링크를 둔다.
- **FR-007**: 시각은 한국어 짧은 형식(`toLocaleString("ko-KR")`), 시점·등급 이름은 `shared/codes/labels`의 이름표를 쓴다.
- **FR-008**: 목(MSW)은 계약의 404·400·409 규칙과 사용 기록 쌓기를 재현한다. 타입은 contracts에서 만든 `generated/report.ts`에서만 꺼낸다.
- **FR-009**: 375px·1280px에서 가로 스크롤 없이 쓸 수 있다.

### Key Entities

- **수동 봉인 요청(ManualSealRequest)**: 시점 종류, 등급, 사유(5~300자, 개인정보 금지).
- **체인 기록(ChainRecord)**: 순번, 시점 ID·종류, payloadHash, prevHash(첫 기록 null), 서명, 서명 시각. 화면은 순번만 쓴다.
- **사용 기록(ManualSealPage.items)**: 렌탈 ID, 시점 ID·종류, 등급, 순번, 사유, 봉인한 관리자 publicId, 봉인 시각.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 목 서버에서 "출고 시작 → 직접 봉인 → 수령 시작"이 화면만으로 1분 안에 된다.
- **SC-002**: 성공·입력 미달·409·400·기록 목록·빈 목록이 자동 테스트로 덮인다.
- **SC-003**: 실제 report-server(학교 서버 Compose, 11/5 배포 뒤)에서 수동 봉인 한 번 → `GET /manual-seals`에 그 건이 보이고 공개 검증 페이지가 정상이다.

## Assumptions

- 수동 봉인 뒤 rental-server 시점 상태가 SEALED로 바뀌는 것은 서버 몫이다(report-server가 `trace.record.sealed`를 내고 rental-server가 소비). 화면은 상세를 다시 읽기만 한다.
- 해시 체인 전체 보기(`GET .../chain`)는 다른 명세(다음 PR)다.
- 구현현황 시트에 이 화면의 행은 없다. 행 추가는 chan이 정한다.
