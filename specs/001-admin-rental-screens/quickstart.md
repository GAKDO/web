# Quickstart: WE1 확인하기

## 준비

```bash
npm ci
# 계약을 바꿀 때만 (contracts 레포가 옆에 있을 때)
scripts/sync-contracts.sh ../contracts && npm run gen:api
```

## 자동 검사

```bash
npm run typecheck && npm test && npm run build
```

기대: 모든 수용 시나리오 테스트 통과(테스트 이름 = 명세 문장), 타입 오류 0.

## 목으로 화면 보기

```bash
VITE_USE_MOCK=true npm run dev
```

1. `/admin/login`에서 목 관리자(`admin@example.com` / 목 핸들러에 적힌 예시 비밀번호)로 로그인 → 기기 목록.
2. 상태 거르기 "수리 중" → 2대. 검색 칸에 시리얼 일부 → 맞는 기기만.
3. 렌탈 만들기 → "다른 상태 기기도 보기" 켜고 수리 중 기기 선택 → "이 기기는 수리 중 상태라…" 문장(수용 기준).
4. 사용 가능 기기로 렌탈 → 출고 시작. 목은 시점마다 2초 간격으로 촬영 대기 → 촬영됨 → 등급 매김 → 봉인으로 바꾸고, 화면은 3초마다 다시 읽는다. 앞 시점이 봉인돼야 다음 버튼이 켜진다(11/02 결정): 출고 봉인 → 수령 시작 → 봉인 → 반납 시작 → 봉인 안내 → 봉인 뒤 종료. 주소에 `?mock=slow-seal`을 붙이면 등급 매김에서 멈춘다.
5. 새로 고침 → 다시 로그인하지 않음. 개발자 도구 Application에서 localStorage·sessionStorage에 토큰 없음.
6. 개발자 도구 기기 폭 375px과 1280px에서 1~4를 가로 스크롤 없이 반복.

## 실제 서버로

`VITE_USE_MOCK`을 빼고 `VITE_DEV_API=http://<gateway>:8314 npm run dev`. AU1·RE1이 develop에 머지된 뒤에 한다.
