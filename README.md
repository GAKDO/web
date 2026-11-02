# web

TRACE(노트북 렌탈 상태 기록 서비스)의 **화면**: 관리자 화면·고객 폰 촬영·3D 트윈 리포트·검증 페이지

- 담당: C
- 설계: [GAKDO/docs](https://github.com/GAKDO/docs) — REST API v0의 "화면별로 부르는 API" 표
- 기술: React, TypeScript, Vite, (three.js / React Three Fiber 예정)
- 폰 촬영은 카메라를 쓰므로 **HTTPS에서만** 동작합니다. 컨테이너는 `/etc/trace-tls/tls.crt`·`tls.key`가 있으면 8080을 HTTPS로 열고(`docker/40-trace-tls.sh`), 없으면 HTTP로 엽니다. 학교 클러스터에서는 gitops가 Secret `trace-tls`(gakdo.site 인증서)를 마운트합니다.

## 실행

```bash
npm install
```

```bash
npm run dev
```

## CI/CD

| 워크플로 | 언제 | 하는 일 |
|---|---|---|
| `화면 CI` | PR, develop push | 타입 검사 + 테스트 + 빌드 |
| `배포` | PR(빌드만), develop·main push | 이미지 → GHCR(`ghcr.io/<조직>/web`). main이면 gitops 이미지 태그 갱신 → Argo CD 배포 |
| `비밀값 검사`·`release`·알림 | | 다른 레포와 같음 |
