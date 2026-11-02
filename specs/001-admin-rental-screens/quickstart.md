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
4. 사용 가능 기기로 렌탈 → 출고 시작 → 수령 시작 → 반납 시작 → 종료 버튼 꺼짐 + 봉인 안내. 목은 몇 초 뒤 봉인으로 바꾸고(`?mock=slow-seal`이면 멈춤), 다시 읽기 → 종료.
5. 새로 고침 → 다시 로그인하지 않음. 개발자 도구 Application에서 localStorage·sessionStorage에 토큰 없음.
6. 개발자 도구 기기 폭 375px과 1280px에서 1~4를 가로 스크롤 없이 반복.

## 실제 서버로

`VITE_USE_MOCK`을 빼고 `VITE_DEV_API=http://<gateway>:8314 npm run dev`. AU1·RE1이 develop에 머지된 뒤에 한다.
