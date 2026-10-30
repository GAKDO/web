# web 컨테이너 이미지: Vite로 빌드한 정적 파일을 nginx-unprivileged(8080, 비루트)로 내준다
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
# 배포 워크플로의 연기 시험이 /version.txt로 새 화면이 떴는지 확인한다
ARG APP_COMMIT=unknown
RUN echo "$APP_COMMIT" > dist/version.txt

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist/ /usr/share/nginx/html/
EXPOSE 8080
