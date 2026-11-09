# web 컨테이너 이미지: Vite로 빌드한 정적 파일을 nginx-unprivileged(8080, 비루트)로 내준다
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# 파일럿 추이 대시보드(학교 Grafana) 주소. 빌드 때 화면에 박히므로 비밀 값은 넣지 않는다
ARG VITE_PILOT_DASHBOARD_URL=
ENV VITE_PILOT_DASHBOARD_URL=$VITE_PILOT_DASHBOARD_URL
# 시연용 고객 계정 이메일(쉼표 구분). 로그인 화면에 고르기 버튼으로만 보이고, 비밀번호는 넣지 않는다
ARG VITE_DEMO_CUSTOMER_EMAILS=gakdoauth+demo@gmail.com
ENV VITE_DEMO_CUSTOMER_EMAILS=$VITE_DEMO_CUSTOMER_EMAILS
# MVP 배포(11/3 방향 전환)에서 숨기는 보관 기능. 코드는 그대로고 메뉴·링크만 숨긴다. 재도입할 기능은 여기서 빼면 된다(account는 11/6 auth_server #7 배포 뒤, report는 11/6 report-server·diagnostics-server가 학교 서버에서 응답해 다시 보임, diagnostics는 11/6 진단 에이전트(agent develop)와 diagnostics-server가 준비돼 다시 보임, phoneCapture는 11/8 폰 사진 검사 워커가 학교 서버 Compose에서 돌아 다시 보임)
ARG VITE_ARCHIVED_FEATURES=pilot
ENV VITE_ARCHIVED_FEATURES=$VITE_ARCHIVED_FEATURES
RUN npm run build
# 배포 워크플로의 연기 시험이 /version.txt로 새 화면이 떴는지 확인한다
ARG APP_COMMIT=unknown
RUN echo "$APP_COMMIT" > dist/version.txt

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 시작할 때 인증서가 있으면 HTTPS로 listen을 만든다(이미지 entrypoint가 /docker-entrypoint.d/*.sh를 차례로 돌린다)
COPY --chmod=0755 docker/40-trace-tls.sh /docker-entrypoint.d/40-trace-tls.sh
# /api/·MinIO 프록시의 resolver·upstream을 만든다(대상이 없어도 web은 뜬다)
COPY --chmod=0755 docker/41-trace-upstreams.sh /docker-entrypoint.d/41-trace-upstreams.sh
COPY --from=build /web/dist/ /usr/share/nginx/html/
EXPOSE 8080
