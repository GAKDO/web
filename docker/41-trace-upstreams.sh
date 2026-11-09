#!/bin/sh
# nginx 시작 전에 프록시가 쓸 resolver와 upstream 주소를 만든다(nginx.conf의 /api/·/trace-captures/·/trace-derived/).
# 주소를 변수로 넘겨 요청 때 이름을 찾으므로, 대상이 아직 없어도 web은 뜨고 그 경로만 502가 된다.
# nginx resolver는 resolv.conf의 search를 쓰지 않으므로, 쿠버네티스(search가 <ns>.svc.<도메인>)에서는 짧은 이름에 붙여 준다.
#   API_UPSTREAM      /api/ → gateway                 (기본 gateway:8080. 클러스터는 Cloudflare Tunnel이 /api/를 먼저 가져간다)
#   MINIO_UPSTREAM    /trace-captures/·/trace-derived/ → MinIO S3 API (기본 minio:9000, 같은 Compose 안 MinIO)
#                     사전 서명에 MinIO 주소(Host)가 들어 있어서 Host 헤더도 이 값으로 보낸다
set -eu

out_dir=/tmp/nginx
mkdir -p "$out_dir"

ns=$(awk '$1 == "nameserver" { print $2; exit }' /etc/resolv.conf 2>/dev/null || true)
search=$(awk '$1 == "search" { print $2; exit }' /etc/resolv.conf 2>/dev/null || true)
case "$ns" in
  *:*) ns="[$ns]" ;;
esac

# $1 파일 이름, $2 nginx 변수 이름, $3 host:port
write_upstream() {
  name="$1"
  var="$2"
  upstream="$3"
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
  out="$out_dir/$name.conf"
  : > "$out"
  if [ -n "$ns" ]; then
    echo "resolver $ns valid=30s ipv6=off;" >> "$out"
  fi
  echo "set \$$var $host$port;" >> "$out"
  echo "trace-upstreams: $name → http://$host$port (resolver ${ns:-없음})"
}

write_upstream api api_upstream "${API_UPSTREAM:-gateway:8080}"
# MinIO는 서명된 Host와 글자까지 같아야 하므로 search 도메인을 붙이지 않은 원래 값을 Host로 쓴다
minio="${MINIO_UPSTREAM:-minio:9000}"
write_upstream minio minio_upstream "$minio"
echo "set \$minio_host $minio;" >> "$out_dir/minio.conf"

# 앞단 프록시가 넣은 실제 사용자 IP(gateway 요청 제한 키). TRUSTED_PROXIES(쉼표로 IP·CIDR)에서 온 연결만
# X-Forwarded-For를 믿고, 맨 오른쪽의 믿지 않는 주소를 사용자 IP($remote_addr → X-Real-IP)로 쓴다.
# 비우면 예전처럼 연결 주소를 쓴다(앞단 프록시가 있으면 모든 사용자가 같은 IP로 세져 로그인 제한을 함께 쓴다)
realip="$out_dir/realip.conf"
: > "$realip"
if [ -n "${TRUSTED_PROXIES:-}" ]; then
  for cidr in $(echo "$TRUSTED_PROXIES" | tr ',' ' '); do
    case "$cidr" in
      *[!0-9a-fA-F.:/]*) echo "trace-upstreams: TRUSTED_PROXIES 값이 IP·CIDR이 아님: $cidr" >&2; exit 1 ;;
    esac
    echo "set_real_ip_from $cidr;" >> "$realip"
  done
  echo "real_ip_header X-Forwarded-For;" >> "$realip"
  echo "real_ip_recursive on;" >> "$realip"
  echo "trace-upstreams: 실제 사용자 IP는 X-Forwarded-For에서(믿는 프록시 $TRUSTED_PROXIES)"
fi
