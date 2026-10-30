# web 컨테이너 이미지: Vite로 빌드한 정적 파일을 nginx-unprivileged(8080, 비루트)로 내준다
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist/ /usr/share/nginx/html/
EXPOSE 8080
