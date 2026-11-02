# Data Model: InfluxDB `trace-pilot` 쓰기 규칙 (제안, A 확정 필요)

diagnostics-server(DI2)가 진단 실행 하나를 저장할 때 아래 점을 쓴다. 시각(`_time`)은 진단 JSON의 측정 시각.
codes.yaml 값은 그대로 태그 값으로 쓰고 복사·번역하지 않는다.

## measurement `trace_battery` (진단 실행마다 1점)

| 종류 | 이름 | 값 | 출처(진단 JSON) |
|---|---|---|---|
| tag | `alias` | 파일럿 별칭(P01) | rental-server 파일럿 참여자(deviceId로 찾음) |
| tag | `deviceId` | 기기 publicId | 렌탈 기기 |
| tag | `checkpoint` | 시점 종류(codes.yaml) | 토큰의 시점 |
| field | `healthPercent` (float) | fullChargeCapacity ÷ designCapacity × 100 | battery. 둘 중 하나라도 null이면 이 field를 쓰지 않음 |
| field | `cycleCount` (int) | 충전 사이클 | battery.cycleCount, null이면 안 씀 |
| field | `osMaxCapacityPercent` (int) | OS 최대 용량 % | battery.osMaxCapacityPercent(macOS), null이면 안 씀 |

## measurement `trace_benchmark` (지표마다 1점)

| 종류 | 이름 | 값 |
|---|---|---|
| tag | `alias`, `deviceId`, `checkpoint` | 위와 같음 |
| tag | `metric` | codes.yaml `diagnostics.benchmark_metric`(CPU_SINGLE 등) |
| tag | `unit` | benchmarks[].unit |
| field | `median` (float) | benchmarks[].median |

## A에게 물을 것

1. 위 이름으로 써도 되는지(다르면 이름만 알려 주면 쿼리를 맞춤).
2. `alias`를 diagnostics-server가 태그로 붙일 수 있는지(rental-server에서 찾아야 함). 어렵다면 `deviceId`만 쓰고 대시보드에서 별칭 대신 기기 ID로 고른다.
