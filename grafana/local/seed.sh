#!/usr/bin/env bash
# 로컬 InfluxDB 버킷 trace-pilot에 가짜 측정값을 넣는다(contracts diagnostics/influx.md의 이름 그대로).
# 기기 3대 × 시점(출고 OUT → 수령 RCV → 반납 RET) 3번, 시각은 지금 기준 25·15·5일 전.
# deviceId는 publicId 형식(21자)을 흉내 낸 가짜 값이다. 실제 기기·사람 정보는 넣지 않는다.
set -euo pipefail

devices=(pilotDemoDevice00001A pilotDemoDevice00002B pilotDemoDevice00003C)

# 시드 점에는 소유 태그 seed=demo를 붙인다(대시보드 쿼리는 deviceId로만 묶으므로 영향 없음).
# 다시 돌려도 점이 쌓이지 않게, 이 태그가 붙은 가짜 기기의 점만 먼저 지운다.
for dev in "${devices[@]}"; do
  influx delete --host "$INFLUX_HOST" --org "$INFLUX_ORG" --token "$INFLUX_TOKEN" --bucket trace-pilot \
    --start 1970-01-01T00:00:00Z --stop 2100-01-01T00:00:00Z --predicate "deviceId=\"$dev\" AND seed=\"demo\""
done

now=${SEED_NOW:-$(date +%s)}
day=86400
lines=""
add() { lines+="$1"$'\n'; }

i=0
for dev in "${devices[@]}"; do
  i=$((i + 1))
  k=0
  for cp in OUT RCV RET; do
    k=$((k + 1))
    ts=$((now - (35 - k * 10) * day + i * 3600))
    health=$(awk -v i="$i" -v k="$k" 'BEGIN { printf "%.1f", 99 - i * 2.5 - k * 0.8 }')
    cycles=$((40 * i + 15 * k))
    oscap=$((100 - i * 2 - k))
    add "trace_battery,deviceId=$dev,checkpoint=$cp,seed=demo healthPercent=$health,cycleCount=${cycles}i,osMaxCapacityPercent=${oscap}i $ts"
    for m in CPU_SINGLE:score:2500 CPU_MULTI:score:9500 MEM_COPY:MB/s:60000 DISK_READ:MB/s:3000 DISK_WRITE:MB/s:2800; do
      IFS=: read -r metric unit base <<<"$m"
      median=$(awk -v b="$base" -v i="$i" -v k="$k" 'BEGIN { printf "%.1f", b * (1 - i * 0.02 - k * 0.01) }')
      add "trace_benchmark,deviceId=$dev,checkpoint=$cp,metric=$metric,unit=$unit,seed=demo median=$median $ts"
    done
  done
done

printf '%s' "$lines" | influx write --host "$INFLUX_HOST" --org "$INFLUX_ORG" --token "$INFLUX_TOKEN" \
  --bucket trace-pilot --precision s
echo "trace-pilot에 가짜 측정값 $(printf '%s' "$lines" | grep -c .)점을 넣었습니다"
