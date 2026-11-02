# Quickstart: WE2

1. `npm ci && VITE_USE_MOCK=true npm run dev`
2. 관리자(admin@example.com) 로그인 → 렌탈 상세 → "수령 QR 만들기" → 링크 복사
3. 새 창에서 링크 열기 → 고객(renter@example.com) 로그인 → 면 7개 찍기 → 제출 → 접수 화면
4. 폰 확인은 HTTPS가 필요하다. 같은 와이파이에서 `npm run dev -- --host` + 자체 서명 인증서, 또는 클러스터 `https://gakdo.site:8315`
5. 검사: `npm run typecheck && npm test && npm run build`
