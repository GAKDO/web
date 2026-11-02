# web 컨테이너 이미지: Vite로 빌드한 정적 파일을 nginx-unprivileged(8080, 비루트)로 내준다
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# 파일럿 추이 대시보드(학교 Grafana) 주소. 빌드 때 화면에 박히므로 비밀 값은 넣지 않는다
ARG VITE_PILOT_DASHBOARD_URL=
ENV VITE_PILOT_DASHBOARD_URL=$VITE_PILOT_DASHBOARD_URL
RUN npm run build
# 배포 워크플로의 연기 시험이 /version.txt로 새 화면이 떴는지 확인한다
ARG APP_COMMIT=unknown
RUN echo "$APP_COMMIT" > dist/version.txt

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 시작할 때 인증서가 있으면 HTTPS로 listen을 만든다(이미지 entrypoint가 /docker-entrypoint.d/*.sh를 차례로 돌린다)
COPY --chmod=0755 docker/40-trace-tls.sh /docker-entrypoint.d/40-trace-tls.sh
COPY --from=build /web/dist/ /usr/share/nginx/html/
EXPOSE 8080
