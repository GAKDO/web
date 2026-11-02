# Feature Specification: 파일럿 추이 대시보드 (WE4 일부)

**Feature Branch**: `claude/project-thread-e4g1hx` (Spec Kit 기본 이름은 `feature/003-pilot-trend-dashboard`. 이 세션은 지정 브랜치만 푸시할 수 있어 이름을 바꿈)

**Created**: 2026-11-02 · **Status**: Draft · **관련 요구사항**: FR-PIL-02 (데이터는 FR-PIL-01·DI2)

**Input**: "파일럿 기기의 배터리·벤치마크 추이 대시보드를 만든다(FR-PIL-02). 수용 기준: 두 번 측정한 값이 한 화면에 나온다." (backlog WE4)

## Clarifications

### Session 2026-11-02

- Q: 대시보드를 웹 화면으로 만드나, Grafana로 만드나? → A: **학교 Grafana**에 만들고 관리자 웹 메뉴에 새 탭 링크만 단다. 근거: `design/mvp-design.md` 229행(Grafana Flux 패널, InfluxDB `trace-pilot`)과 22행 수용 기준("Grafana에 나온다"). contracts에는 추이 읽기 API가 없어 웹 화면은 계약 변경이 필요하다(헌법: 계약 변경은 멈추고 알림).
- Q: 기기는 무엇으로 고르나? → A: 파일럿 별칭(P01 같은)으로만. 실명은 화면·쿼리에 없다(FR-PIL-01).
- Q: 배터리는 무엇을 보이나? → A: 건강도(완충 ÷ 설계 × 100)와 사이클 수. 용량 단위(mAh·mWh)가 OS마다 달라 원 값 대신 비율을 쓴다(환산은 하지 않음).
- Q: 벤치마크는? → A: 지표(codes.yaml `diagnostics.benchmark_metric`)마다 패널 하나, 3회 중앙값.
- Q: 측정이 한 번뿐인 기기는? → A: 점으로 보인다(선은 두 번째 측정부터).

## User Scenarios & Testing

### User Story 1 - 기기 한 대의 두 번 측정 비교 (P1)

관리자가 관리 화면에서 "파일럿 추이 ↗"를 눌러 Grafana를 열고, 별칭 하나를 고르면 그 기기의 배터리 건강도·사이클·벤치마크 값이 측정 시각 순으로 한 화면에 보인다.

1. **Given** P01을 두 번 진단했다, **When** 대시보드에서 P01을 고르면, **Then** 패널마다 점 2개가 선으로 이어져 보인다.
2. **Given** P02는 한 번만 진단했다, **When** P02를 고르면, **Then** 점 1개가 보인다.

### User Story 2 - 여러 대 겹쳐 보기 (P2)

1. **Given** 파일럿 기기 여러 대, **When** "All"을 고르면, **Then** 별칭마다 다른 선이 범례와 함께 보인다.

### User Story 3 - 관리자 웹에서 열기 (P1)

1. **Given** 빌드에 대시보드 주소가 들어 있다, **When** 관리 화면에 들어가면, **Then** 메뉴에 "파일럿 추이 ↗"가 있고 새 탭으로 열린다.
2. **Given** 주소가 없다, **Then** 메뉴가 보이지 않는다(깨진 링크 없음).

### Edge Cases

- 배터리를 못 읽은 진단(값 null)은 점을 만들지 않는다(DI2가 쓰지 않음).
- 전원이 없어 벤치마크를 건너뛴 진단은 벤치마크 패널에 점이 없다.

## Requirements

- **FR-001**: 대시보드는 InfluxDB `trace-pilot` 버킷만 읽는다(NFR-04).
- **FR-002**: 패널은 배터리 건강도(%)·배터리 사이클·벤치마크(지표별) 세 종류다.
- **FR-003**: 기기 선택 변수는 `alias` 태그이고 여러 개 고를 수 있다.
- **FR-004**: 모든 패널은 점을 그린다(측정 1번도 보임).
- **FR-005**: 기본 기간은 최근 30일, 시간대는 Asia/Seoul.
- **FR-006**: 대시보드 정의는 `grafana/pilot-trend.dashboard.json`으로 Git에 두고 Grafana "Import"로 다시 만들 수 있다. 데이터 소스·토큰은 JSON에 넣지 않는다.
- **FR-007**: 관리자 웹 메뉴는 `VITE_PILOT_DASHBOARD_URL`이 http(s) 주소일 때만 링크를 보인다.

## Success Criteria

- **SC-001**: 실제 파일럿 기기 1대의 두 번 측정값이 한 화면에 함께 보인다(FR-PIL-02 수용 기준). → 실서버 확인 뒤 시트 9행 체크.
- **SC-002**: 화면 어디에도 실명·이메일이 없다.

## Assumptions / 의존

- InfluxDB에 쓰는 이름(measurement·tag·field)은 `data-model.md`의 **제안**이다. A가 DI2에서 확정해야 한다. 다르면 JSON의 쿼리만 고친다.
- 학교 Grafana에 우리 폴더·편집 권한과 `trace-pilot` 읽기 데이터 소스가 있어야 한다(A·학교 확인).
