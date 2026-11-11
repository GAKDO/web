# Data Model: InfluxDB `trace-pilot`

**확정(11/2)**: 원본은 contracts [`diagnostics/influx.md`](https://github.com/GAKDO/contracts/blob/develop/diagnostics/influx.md). 이 파일은 복사하지 않고 그쪽을 따른다.

대시보드가 쓰는 것:

- `trace_battery`: 태그 `deviceId`, `checkpoint` / 필드 `healthPercent`, `cycleCount`
- `trace_benchmark`: 태그 `deviceId`, `checkpoint`, `metric`, `unit` / 필드 `median`
- 별칭(P01 등)은 InfluxDB에 없다. 대시보드 "기기 별칭표" 패널의 값 매핑(deviceId → 별칭)으로 붙인다. 값은 Import 뒤 관리자 화면의 파일럿 목록을 보고 Grafana에서 넣는다(사람 이름은 넣지 않음).
