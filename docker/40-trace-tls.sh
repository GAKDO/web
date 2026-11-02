#!/bin/sh
# nginx 시작 전에 listen 설정을 만든다. 인증서가 마운트돼 있으면 HTTPS, 없으면 지금처럼 HTTP.
# 학교 클러스터는 Secret trace-tls(kubernetes.io/tls)를 /etc/trace-tls에 마운트한다(gitops base/apps/web).
# 폰 촬영은 카메라(getUserMedia) 때문에 HTTPS가 필요하다. 로컬 docker run은 인증서 없이 HTTP로 뜬다.
set -eu

cert="${TLS_CERT_FILE:-/etc/trace-tls/tls.crt}"
key="${TLS_KEY_FILE:-/etc/trace-tls/tls.key}"
out_dir=/tmp/nginx
out="$out_dir/listen.conf"
mkdir -p "$out_dir"

if [ -s "$cert" ] && [ -s "$key" ]; then
  cat > "$out" <<CONF
listen 8080 ssl;
ssl_certificate $cert;
ssl_certificate_key $key;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_session_cache shared:trace_tls:1m;
ssl_session_timeout 1h;
# 같은 포트로 http:// 요청이 오면(497) 같은 주소의 https://로 보낸다. NodePort가 바꾸는 포트는 Host 헤더에 남아 있다
error_page 497 =301 https://\$http_host\$request_uri;
CONF
  echo "trace-tls: HTTPS로 엽니다 ($cert)"
else
  echo "listen 8080;" > "$out"
  echo "trace-tls: 인증서가 없어 HTTP로 엽니다"
fi
