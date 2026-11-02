#!/usr/bin/env bash
# contracts 레포에서 화면이 쓰는 계약 파일을 web/contracts/로 복사하고, 어느 커밋인지 VERSION에 남긴다.
# 쓰는 법: scripts/sync-contracts.sh [contracts 레포 경로, 기본 ../contracts] → 이어서 npm run gen:api
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
src="${1:-../contracts}"
dst=contracts
for f in codes.yaml openapi/auth-server.yaml openapi/rental-server.yaml openapi/capture-server.yaml openapi/report-server.yaml openapi/components/common.yaml openapi/components/codes.gen.yaml; do
  [ -f "$src/$f" ] || { echo "계약 파일이 없습니다: $src/$f" >&2; exit 1; }
done
rm -rf "$dst"
mkdir -p "$dst/openapi/components"
cp "$src/codes.yaml" "$dst/"
cp "$src/openapi/auth-server.yaml" "$src/openapi/rental-server.yaml" "$src/openapi/capture-server.yaml" "$src/openapi/report-server.yaml" "$dst/openapi/"
cp "$src/openapi/components/common.yaml" "$src/openapi/components/codes.gen.yaml" "$dst/openapi/components/"
git -C "$src" rev-parse HEAD > "$dst/VERSION"
echo "계약 복사함: $(cat "$dst/VERSION")"
