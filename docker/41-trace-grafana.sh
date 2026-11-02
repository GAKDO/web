#!/bin/sh
# nginx 시작 전에 /grafana/ 프록시가 쓸 resolver와 upstream 주소를 만든다(nginx.conf의 location /grafana/).
# 주소를 변수로 넘겨 요청 때 이름을 찾으므로, grafana가 아직 없어도 web은 뜨고 /grafana/만 502가 된다.
# nginx resolver는 resolv.conf의 search를 쓰지 않으므로, 쿠버네티스(search가 <ns>.svc.<도메인>)에서는 짧은 이름에 붙여 준다.
set -eu

upstream="${GRAFANA_UPSTREAM:-grafana:3000}"
out_dir=/tmp/nginx
out="$out_dir/grafana.conf"
mkdir -p "$out_dir"

ns=$(awk '$1 == "nameserver" { print $2; exit }' /etc/resolv.conf 2>/dev/null || true)
search=$(awk '$1 == "search" { print $2; exit }' /etc/resolv.conf 2>/dev/null || true)

host="${upstream%%:*}"
port="${upstream#"$host"}"
case "$host" in
  *.*) ;;
  *)
    case "$search" in
      *.svc.*) host="$host.$search" ;;
    esac
    ;;
esac

: > "$out"
if [ -n "$ns" ]; then
  case "$ns" in
    *:*) ns="[$ns]" ;;
  esac
  echo "resolver $ns valid=30s ipv6=off;" >> "$out"
fi
echo "set \$grafana_upstream $host$port;" >> "$out"
echo "trace-grafana: /grafana/ → http://$host$port (resolver ${ns:-없음})"
