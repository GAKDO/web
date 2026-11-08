# 변경 기록

이 레포의 버전별 변경을 적는다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따른다.
기능 PR은 `## [Unreleased]` 아래에 한 줄을 더하고, 릴리스 PR에서 `## [x.y.z] - 날짜`로 바꾼다(CONTRIBUTING.md 3번).
main에 버전이 적힌 CHANGELOG가 올라가면 release.yml이 태그와 GitHub Release를 만든다.

## [Unreleased]

### 추가
- 리포트에 공개 검증 주소 QR을 보여 준다(FR-INT-0x 리포트 QR로 공개 검증). 검증 주소가 없으면 숨기고, 인쇄해도 보인다
- 블로그(AIGJ-01-002-blog/devlog) CI/CD를 옮겨 초기 구성

### 제거
- nginx의 `/grafana/` 프록시와 `GRAFANA_UPSTREAM`(11/6 결정: Grafana를 쓰지 않음)
