# 변경 기록

이 레포의 버전별 변경을 적는다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따른다.
기능 PR은 `## [Unreleased]` 아래에 한 줄을 더하고, 릴리스 PR에서 `## [x.y.z] - 날짜`로 바꾼다(CONTRIBUTING.md 3번).
main에 버전이 적힌 CHANGELOG가 올라가면 release.yml이 태그와 GitHub Release를 만든다.

## [Unreleased]

### 추가
- 관리자 사람 검수(11/8): 검사 결과 목록 맨 위에 검수 대기 시점, 상세에서 AI 후보 묶음마다 흠집 맞음·아님(이유 선택)·되돌리기, 모두 정하면 검수 완료로 등급. 흠집 의심(신뢰도 0.40 이상)·확인 필요 두 단계, 흠집 아님은 사진 위에 흐린 점선으로
- 리포트에 공개 검증 주소 QR을 보여 준다(FR-INT-0x 리포트 QR로 공개 검증). 검증 주소가 없으면 숨기고, 인쇄해도 보인다
- 블로그(AIGJ-01-002-blog/devlog) CI/CD를 옮겨 초기 구성

### 제거
- nginx의 `/grafana/` 프록시와 `GRAFANA_UPSTREAM`(11/6 결정: Grafana를 쓰지 않음)
