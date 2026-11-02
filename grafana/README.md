# 파일럿 추이 Grafana (FR-PIL-02)

파일럿 기기의 배터리 건강도·사이클 수·벤치마크 추이를 보는 Grafana입니다. 노트북에서 Docker Compose로 띄웁니다.
학교 클러스터에는 올리지 않습니다(NFR-05, 11/2 결정). 데이터 소스와 대시보드는 파일에서 자동으로 등록되므로 화면에서 따로 가져오기를 하지 않습니다.

| 파일 | 내용 |
|---|---|
| `pilot-trend.dashboard.json` | 대시보드(uid `trace-pilot-trend`). 측정값 이름은 contracts `diagnostics/influx.md` |
| `provisioning/datasources/trace-pilot.yaml` | InfluxDB v2 Flux 데이터 소스(uid `trace-pilot`) |
| `provisioning/dashboards/trace.yaml` | 대시보드를 `trace` 폴더에 올리는 설정 |
| `docker-compose.yml` | Grafana 12.1.1 하나 |
| `.env.example` | 넣어야 할 값 이름(값 없음) |

## 띄우기

```bash
cd grafana
cp .env.example .env      # GRAFANA_ADMIN_PASSWORD, INFLUX_ORG, INFLUX_READ_TOKEN 채우기
docker compose up -d
```

- 대시보드: http://localhost:3000/d/trace-pilot-trend (로그인 없이 보기)
- 관리: http://localhost:3000/login 에서 `admin` + `.env`의 비밀번호
- 끄기: `docker compose down` (설정 볼륨은 남는다. 지우려면 `down -v`)
- `.env`를 바꿨다면 `docker compose up -d --force-recreate`
- 3000번 포트를 이미 다른 프로그램이 쓰면 `.env`에 `GRAFANA_PORT=3001`을 넣고 주소의 포트도 바꾼다
- Connections → Data sources에 trace-pilot이 없으면 `docker compose restart grafana` 뒤 다시 본다

먼저 이 컴퓨터에서 `curl -sS -m 10 http://influx.java21.net/health` 가 InfluxDB 응답(JSON)을 주는지 확인합니다.
학교 밖 망에서는 학교 방화벽 차단 안내 HTML이 돌아오고, Grafana는 "Client.Timeout exceeded"로 실패합니다(11/2 확인).
학교망에서는 `.env`에 `INFLUX_URL=http://10.116.64.13:8086`(내부 주소)을 넣고 `docker compose up -d --force-recreate`로 다시 띄웁니다.

## G1 로컬 Compose 폴백에 넣을 때

gitops `compose/docker-compose.yml`에 같은 `grafana` 서비스를 붙여 넣고, 볼륨 경로를 이 폴더(`../web/grafana/...`)로 바꿉니다. 값은 그쪽 `.env`에 같은 이름으로 넣습니다.

## 고칠 때

- 대시보드는 Grafana 화면에서 고친 뒤 JSON을 내보내 이 파일에 덮어씁니다. 데이터 소스 uid는 `trace-pilot` 그대로 둡니다.
- 기기 별칭은 "기기 별칭표" 패널의 값 매핑(deviceId → 별칭)에 넣습니다. 사람 이름은 넣지 않습니다.
- 진단 데이터는 11/9 DI2부터 들어옵니다. 그전에는 빈 그래프가 정상입니다.
