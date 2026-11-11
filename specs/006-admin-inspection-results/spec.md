# Feature Specification: 관리자 검사 결과 화면 (MVP, 부스 빠른 검사)

**Feature Branch**: `claude/project-thread-prgvfq` (Spec Kit 기본 이름은 `feature/006-admin-inspection-results`. 이 세션은 지정 브랜치만 푸시할 수 있어 이름을 바꿈)

**Created**: 2026-11-03

**Status**: Draft

**Input**: 11/3 방향 전환(강사님 리뷰, 민서 승인) C 할 일: "11/04~05 web /admin에 검사 결과 화면: 기기별 최근 검사, 사진(GET /api/v1/captures/checkpoints/{id}/media), 흠집 폴리곤 겹쳐 보기, 판정(GET …/inspection, 등급 A = 문제 없음, B~D = 문제 있음)". MVP 흐름: 부스에서 위·아래 2면 촬영 → Jetson 탐지 → capture-server 저장·등급(QUICK 세트는 정합 없이) → 관리자 화면에서 결과 조회.

**관련 요구사항**: FR-INS-01(흠집 탐지 결과), FR-INS-04(등급), FR-RNT-02(시점 흐름) 화면

## Clarifications

### Session 2026-11-03 (chan 내역 + contracts #20 확인)

- Q: "기기별 최근 검사"를 어디서 읽나? → A: 전용 API가 없어 렌탈 목록(`GET /api/v1/rentals`, 최근 것부터)의 `currentCheckpoint`(지금 시점)를 쓴다. 렌탈 한 건 = 기기 한 대의 한 번 대여라 기기별 최근 검사와 같다.
- Q: 판정은 어떻게 보이나? → A: `GET …/inspection`의 `grade`가 A면 "문제 없음", B·C·D면 "문제 있음"(등급 함께). grade가 null이고 reasons가 있으면 "판정 불가", 둘 다 없거나 404면 "판정 대기". 시점이 없으면 "검사 전".
- Q: 사진·폴리곤은 첫 PR에 들어가나? → A: 아니다. 첫 PR(web#43)은 계약 1.0.0 값만 쓴다. contracts #20(11/3 07:43 머지)이 더한 원본 사진 URL(`CheckpointMedia.photos`)과 원본 px 흠집(`Inspection.photoDefects`, QUICK은 `defects`가 빈 배열)은 다음 PR에서 붙인다. 그 전에는 그 값에 의존하는 코드를 머지하지 않는다(11/3 결정).
- Q: 사진은 몇 장인가? → A: 12장. 위·아래 2면 × 조명 L1·L2·L3 × CAM1·CAM2(contracts #20, A 11/3 답변). 격자는 면마다 카메라 2(행) × 조명 3(열).
- Q: 시점은 어디까지 보이나? → A: MVP(11/9)는 렌탈당 출고 검사 1번(A 11/3 답변, 민서 확인 중). 수령·반납 시작과 렌탈 종료는 `VITE_ARCHIVED_FEATURES=laterCheckpoints`로 숨긴다.
- Q: 흠집 목록은 표인가 카드인가? → A: 카드. 375px에서 5열 표는 가로 스크롤이 생긴다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 검사 결과 목록에서 문제 있는 기기 찾기 (Priority: P1)

관리자가 "검사 결과" 메뉴를 열어 기기(렌탈)마다 지금 시점과 판정(문제 없음·문제 있음·판정 대기·검사 전)을 한눈에 보고, 결과 보기로 들어간다.

**Why this priority**: MVP 시연의 마지막 단계(부스 → 서버 → 관리자 화면)다.

**Independent Test**: 목 서버의 렌탈 몇 건(A 등급, B 등급, 촬영만 됨, 시점 없음)으로 목록을 열어 판정 글자가 각각 맞는지 본다.

**Acceptance Scenarios**:

1. **Given** 관리 메뉴, **When** "검사 결과"를 누르면, **Then** 렌탈마다 시리얼·기종·지금 시점·판정이 카드로 보인다(최근 것부터).
2. **Given** 지금 시점의 등급이 A인 렌탈, **Then** "문제 없음"이 보인다.
3. **Given** 등급이 B~D인 렌탈, **Then** "문제 있음"과 등급이 보이고 강조된다.
4. **Given** 촬영됐지만 검사 결과가 아직 없는(404) 시점, **Then** "판정 대기"가 보인다.
5. **Given** 시점이 없는 렌탈, **Then** "검사 전"이 보이고 결과 보기 링크가 없다.
6. **Given** 렌탈이 20건 넘음, **When** 더 보기를 누르면, **Then** 다음 쪽이 이어 붙는다.

---

### User Story 2 - 한 시점의 검사 결과 상세 (Priority: P1)

관리자가 결과 보기를 눌러 판정(문제 없음/있음·등급·근거 문장)과 흠집 목록(면·종류·신뢰도·길이)을 본다.

**Independent Test**: 목 렌탈의 수령 시점(등급 B, 신규 긁힘 1개)을 열어 "문제 있음"과 흠집 1개가 보이는지 본다.

**Acceptance Scenarios**:

1. **Given** 등급 B 시점, **When** 상세를 열면, **Then** "문제 있음 · B등급", 근거 문장, 흠집 카드(면·종류·신뢰도 %·길이 mm)가 보인다.
2. **Given** 등급 A 시점, **Then** "문제 없음"과 "흠집이 없습니다"가 보인다.
3. **Given** 검사 결과가 없는 시점(404), **Then** "아직 검사 결과가 없습니다. 판정 대기" 안내가 보이고 오류로 보이지 않는다.
4. **Given** 서버 오류(5xx), **Then** 오류 문장과 다시 시도 버튼이 보인다.
5. **Given** 빠른 검사(QUICK) 시점의 상세, **When** 사진이 있으면, **Then** 면(윗면·바닥)마다 카메라 2 × 조명 3 격자로 원본 사진이 보이고, 각 사진 위에 그 사진의 흠집 폴리곤이 겹쳐 보이며 칸 설명에 카메라·조명·흠집 수가 있다. 사진이 아직 없으면 "사진이 아직 없습니다", 읽기 오류면 판정은 그대로 두고 사진 자리에만 오류와 다시 시도가 보인다.

### Edge Cases

- `lengthMm`·`areaMm2`가 null(원본 px 탐지)이면 "—"로 보인다.
- 신뢰도는 소수 둘째 자리까지의 비율을 %로 반올림해 보인다.
- 판정 대기(404 또는 등급·근거 없음)인 검사 결과는 3초마다 다시 읽고, 등급이 매겨지거나 판정 불가가 되면 멈춘다. 404는 오류 재시도를 하지 않는다. 목록은 열어 둔 동안 5초마다 렌탈 목록을 다시 읽고, 새로 고침 버튼은 목록과 판정을 바로 다시 읽는다.
- 주소의 시점이 그 렌탈에 없으면 검사 결과를 읽지 않고 검사 전으로 보인다(다른 렌탈의 결과가 섞여 보이지 않게).
- 다른 역할(고객)은 관리 화면에 들어오지 못한다(기존 RequireAdmin).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 관리 메뉴에 "검사 결과"(`/admin/inspections`)를 둔다.
- **FR-002**: 목록은 `GET /api/v1/rentals`(limit 20, cursor)를 최근 것부터 보이고, 카드마다 시리얼·기종 이름·지금 시점(종류·상태)·판정을 보인다.
- **FR-003**: 판정은 지금 시점의 `GET /api/v1/captures/checkpoints/{checkpointId}/inspection`으로 정한다: A → 문제 없음, B·C·D → 문제 있음(등급), grade null + reasons → 판정 불가, 404/grade null → 판정 대기, 시점 없음 → 검사 전.
- **FR-004**: 상세(`/admin/inspections/:rentalId/:checkpointId`)는 렌탈 상세(시리얼·시점 종류)와 검사 결과를 읽어 판정 상자(색 + 문구), 근거 문장, 규칙 버전, 흠집 카드 목록을 보인다.
- **FR-005**: 흠집 카드는 면·종류·신뢰도·길이(mm)·면적(mm², null은 둘 다 —)·출처(자동/사람)를 보인다. 빠른 검사 흠집(`photoDefects`)은 길이 대신 카메라·조명을 보이고(mm 환산은 계약 범위 밖), 사진마다 따로 센 수라는 안내를 붙인다. 이름표는 `shared/codes/labels`에서 온다.
- **FR-006**: 404는 "판정 대기" 안내로, 그 밖의 오류는 `messageFor` 문장과 다시 시도로 보인다. 판정 대기인 동안은 3초마다 다시 읽어 결과가 생기면 저절로 바뀐다.
- **FR-007**: 사진은 `GET /api/v1/captures/checkpoints/{checkpointId}/media`로 읽는다. `photos`(또는 `photoDefects`)가 있으면 면마다 카메라(행) × 조명(열) 격자로 원본 사진을 보이고 각 사진 위에 그 사진의 `photoDefects` 폴리곤(원본 px)을 SVG로 겹친다(사진 natural 크기를 viewBox로). 정합 세트는 면 사진(`textures`) 위에 표준 좌표 `defects`를 겹친다. 404는 "사진이 아직 없습니다"(3초마다 다시 읽음), 그 밖의 오류는 사진 자리에만 다시 시도. 주소는 만료 1분 전에 새로 받는다. 사진을 누르면 원본을 새 탭에 연다.
- **FR-008**: 375px·1280px에서 가로 스크롤 없이 쓸 수 있다.
- **FR-009**: 타입은 contracts에서 만든 생성물에서만 꺼내고, 목(MSW)은 기존 `captureReportHandlers`를 쓴다.

### Key Entities

- **판정(Verdict)**: 화면 안의 파생 값. kind(none·pending·ok·bad·ungradable)와 등급.
- **검사 결과(Inspection)**: 계약 `Inspection`(grade·ruleVersion·reasons·defects).
- **흠집(Defect)**: 계약 `Defect`(face·class·confidence·lengthMm·areaMm2·source·match).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 목록·상세의 다섯 판정 상태(없음·대기·불가·문제 없음·문제 있음)가 자동 테스트로 덮인다.
- **SC-002**: 목 서버에서 메뉴 → 목록 → 상세까지 클릭 두 번이다.
- **SC-003**: 11/6 gakdo.site(https://gakdo.site/admin)에서 부스가 올린 실제 세트의 등급이 목록·상세에 보인다.

## Assumptions

- QUICK 세트의 등급은 capture-server가 부스 탐지만으로 매긴다(contracts #20). 화면은 등급을 계산하지 않는다.
- 렌탈 목록의 `currentCheckpoint`는 계약(1.0.0 뒤 선택 필드)대로 서버가 항상 보낸다. 없으면 "검사 전"으로 본다.
- "기기별"은 렌탈 단위다. 같은 기기의 지난 렌탈은 목록에 따로 나온다.
