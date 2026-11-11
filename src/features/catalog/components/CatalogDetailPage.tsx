import { ArrowLeft, Images, RotateCcw } from "lucide-react";
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ApiError } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import type { CatalogPhotoDefect } from "../../../shared/api/types";
import { CAPTURE_CAMERA_LABEL, CAPTURE_FACE_LABEL, CAPTURE_LIGHT_LABEL, CHECKPOINT_TYPE_LABEL, DEFECT_CLASS_LABEL, DEVICE_OS_LABEL } from "../../../shared/codes/labels";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { formatDate, formatDateTime } from "../../../shared/ui/format";
import { PhotoGrid } from "../../inspections/components/PhotoGrid";
import { PhotoLightbox, type LightboxPhoto } from "../../inspections/components/PhotoLightbox";
import { PhotoWithDefects } from "../../inspections/components/PhotoWithDefects";
import { faceGrids } from "../../inspections/model/photos";
import { hasWebGL } from "../../report/components/TwinSection";
import { useCatalog, useCatalogHistory, useCatalogInspection } from "../api/catalog";
import { classSummary } from "../model/catalog";
import { BENCH_LABEL, BENCH_UNIT, full, percent } from "../model/format";
import { laptopPins, PIN_COLOR, type LaptopPin } from "../model/laptop3d";
import { firstSeenOf, type FirstSeen, type InspectionSpots } from "../model/firstSeen";
import { AvailabilityBadge, GradeBadge } from "./Badges";
import type { ViewPreset } from "./LaptopViewer";
import { usePhotoSizes } from "../../../shared/laptop3d/usePhotoSizes";
import { isChunkLoadError } from "../../../shared/app/chunkReload";

// 공개 기기 상세(11/8 민서 요청): 노트북 3D 모델 위에 확정 흠집을 핀으로 찍고, 핀을 누르면 그 흠집이 찍힌 원본 사진을 보여 준다.
// WebGL이 없거나 3D가 실패하면 사진 보기만 남는다. 사양·진단·벤치마크도 함께 보여 준다.

const LaptopViewer = lazy(() => import("./LaptopViewer"));

/**
 * 3D가 그리다 실패하면 사진 안내로 바꾼다. 11/10: 실패 이유를 콘솔에 남기고, 다시 그리기 버튼을 둔다.
 * 배포 뒤 옛 화면이라 3D 조각을 못 받은 경우는 새로 고침을 권한다
 */
class ViewerBoundary extends Component<{ fallback(reason: "chunk" | "render", retry: () => void): ReactNode; children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidCatch(error: unknown) {
    console.error("[TRACE] 3D 뷰어 오류", error);
  }
  render() {
    if (this.state.error === null) return this.props.children;
    return this.props.fallback(isChunkLoadError(this.state.error) ? "chunk" : "render", () => this.setState({ error: null }));
  }
}

const photoKey = (d: { face: string; camera: string; light: string }) => `${d.face}:${d.camera}:${d.light}`;

/** 핀을 고르면 그 면이 잘 보이게 덮개·카메라를 맞춘다 */
function viewFor(pin: LaptopPin): { view: ViewPreset; lidOpen: boolean } {
  if (pin.face === "TOP") return { view: "top", lidOpen: false };
  if (pin.face === "BOT") return { view: "bottom", lidOpen: false };
  if (pin.face === "KB" || pin.face === "SCR0" || pin.face === "SCR1") return { view: "keyboard", lidOpen: true };
  return { view: "front", lidOpen: false };
}

const VIEWS: { view: ViewPreset; label: string; lidOpen: boolean }[] = [
  { view: "front", label: "처음 보기", lidOpen: true },
  { view: "top", label: "윗면(덮개)", lidOpen: false },
  { view: "keyboard", label: "키보드", lidOpen: true },
  { view: "bottom", label: "바닥", lidOpen: false },
];

/** 처음 발견 한 줄. current: 지금 보이는 검사 ID */
function seenText(fs: FirstSeen, current: string): string {
  const at = `${CHECKPOINT_TYPE_LABEL[fs.type]} 검사(${formatDate(fs.gradedAt)})`;
  if (fs.isNew) return `이번 ${at}에서 새로 발견`;
  if (fs.checkpointId !== current) return `${at}부터 있던 흠집`;
  return `${at}에서 발견`;
}

/** 3D 핀 옆 짧은 표시 */
function seenTag(fs: FirstSeen): string {
  const d = new Date(fs.gradedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });
  return fs.isNew ? `새 흠집 · ${d}` : `${CHECKPOINT_TYPE_LABEL[fs.type]} ${d}부터`;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 text-right tabular-nums">{value}</dd>
    </div>
  );
}

export function CatalogDetailPage() {
  const { deviceId } = useParams();
  const catalog = useCatalog();
  const row = catalog.data?.rows.find((r) => r.device.deviceId === deviceId);
  const inspection = useCatalogInspection(row?.inspection?.checkpointId);
  const [webgl] = useState(hasWebGL);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<ViewPreset>("front");
  const [viewNonce, setViewNonce] = useState(0);
  const [lidOpen, setLidOpen] = useState(true);
  const [lightbox, setLightbox] = useState<{ photos: LightboxPhoto[]; index: number } | null>(null);
  // 그래픽 장치가 3D 판을 거둬 가면(contextlost) 안내로 바꾸고, 다시 그리기를 누르면 새 판으로 다시 만든다
  const [contextLost, setContextLost] = useState(false);
  const [viewerKey, setViewerKey] = useState(0);

  const photos = inspection.data?.photos ?? [];
  const defects = inspection.data?.photoDefects ?? [];
  const sizes = usePhotoSizes(useMemo(() => photos.filter((p) => defects.some((d) => photoKey(d) === photoKey(p))).map((p) => ({ key: photoKey(p), url: p.url })), [photos, defects]));
  const pins = useMemo(() => (row ? laptopPins(defects, row.device.dimensions, (d) => sizes[photoKey(d)]) : []), [row, defects, sizes]);
  const current = pins.find((p) => p.groupId === selected) ?? null;

  // 흠집별 처음 발견 검사(11/11 민서 요청): 지금 보이는 검사보다 이전 검사들의 흠집과 같은 면·가까운 위치끼리 이어 본다
  const checkpoints = row?.device.checkpoints ?? [];
  const currentIdx = checkpoints.findIndex((c) => c.checkpointId === row?.inspection?.checkpointId);
  const olderCheckpoints = currentIdx >= 0 ? checkpoints.slice(currentIdx + 1) : [];
  const history = useCatalogHistory(olderCheckpoints.map((c) => c.checkpointId));
  const historyReady = history.every((h) => h.isSuccess);
  const historyFailed = history.some((h) => h.isError);
  const firstSeen = useMemo(() => {
    const cp = checkpoints[currentIdx];
    if (!row || !cp || !inspection.data || !historyReady) return new Map<string, FirstSeen>();
    const spotsOf = (checkpointId: string, type: InspectionSpots["type"], gradedAt: string, list: LaptopPin[]): InspectionSpots => ({
      checkpointId,
      type,
      gradedAt,
      spots: list.map((p) => ({ groupId: p.groupId, face: p.face, ratio: p.ratio })),
    });
    const older = olderCheckpoints.flatMap((c, i) => {
      const data = history[i]?.data;
      return data ? [spotsOf(c.checkpointId, c.type, data.gradedAt, laptopPins(data.photoDefects, row.device.dimensions, () => undefined))] : [];
    });
    // 견줄 때는 이전 검사와 같은 기준(기본 해상도)으로 잰다. 화면 핀은 실제 사진 크기를 쓰므로 위치가 조금 다를 수 있다
    const now = laptopPins(inspection.data.photoDefects, row.device.dimensions, () => undefined);
    return firstSeenOf(spotsOf(cp.checkpointId, cp.type, inspection.data.gradedAt, now), older);
    // history는 렌더마다 새 배열이라 받은 시각으로 바뀜을 본다
  }, [row, inspection.data, historyReady, currentIdx, history.map((h) => h.dataUpdatedAt).join()]);
  const pinTags = useMemo(() => Object.fromEntries([...firstSeen].map(([id, fs]) => [id, seenTag(fs)])), [firstSeen]);
  const newCount = [...firstSeen.values()].filter((f) => f.isNew).length;
  const hadBefore = [...firstSeen.values()].filter((f) => !f.isNew && f.checkpointId !== row?.inspection?.checkpointId).length;

  const choose = (pin: LaptopPin) => {
    setSelected(pin.groupId);
    const next = viewFor(pin);
    setView(next.view);
    setLidOpen(next.lidOpen);
    setViewNonce((n) => n + 1);
  };
  // 처음 보기(앞)에서는 덮개 바깥·바닥 흠집이 안 보이므로, 흠집이 있으면 첫 흠집으로 시점을 한 번 옮겨 둔다
  const autoChosen = useRef(false);
  useEffect(() => {
    if (autoChosen.current || pins.length === 0) return;
    autoChosen.current = true;
    choose(pins[0]);
  }, [pins]);
  const urlOf = (d: CatalogPhotoDefect) => photos.find((p) => photoKey(p) === photoKey(d))?.url;
  const memberPhotos = (pin: LaptopPin): LightboxPhoto[] =>
    pin.members.flatMap((m) => {
      const src = urlOf(m);
      return src ? [{ key: m.defectId, name: `${CAPTURE_FACE_LABEL[m.face]} · ${CAPTURE_CAMERA_LABEL[m.camera]} · ${CAPTURE_LIGHT_LABEL[m.light]}`, src, defects: [{ id: m.defectId, title: DEFECT_CLASS_LABEL[m.class], polygon: m.polygon }] }] : [];
    });

  if (catalog.isPending) return <main className="mx-auto max-w-6xl px-4 py-10" role="status">불러오는 중…</main>;
  if (catalog.isError)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <ErrorBanner message={catalog.error instanceof ApiError ? messageFor(catalog.error) : "노트북 정보를 불러오지 못했습니다."} onRetry={() => void catalog.refetch()} />
      </main>
    );
  if (!row)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p>찾는 노트북이 없습니다. 목록에서 다시 골라 주세요.</p>
        <Link to="/devices">보유 노트북 목록</Link>
      </main>
    );

  const d = row.device;
  // 흠집 요약 조회가 실패해도 행은 만들어지므로, 검사를 마친 시점이 있으면 '검사 전'이 아니라 불러오기 실패로 본다
  const summaryFailed = !row.inspection && catalog.data.inspectionsFailed && d.checkpoints.length > 0;
  const diag = row.diagnostics;
  const checkpoint = d.checkpoints.find((c) => c.checkpointId === row.inspection?.checkpointId);
  const photoFallback = (reason: string, action?: { label: string; run(): void }) => (
    <div role="status" className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      <span>
        <Images aria-hidden="true" className="mx-auto mb-2 size-6" />
        {reason}
        {photos.length > 0 && (
          <>
            <br />
            아래 부스 사진에서도 흠집을 볼 수 있습니다.
          </>
        )}
        {action && (
          <button type="button" onClick={action.run} className="tap-target mx-auto mt-3 flex h-9 cursor-pointer items-center gap-1.5 rounded-full border bg-background px-4 text-sm text-foreground hover:bg-muted">
            <RotateCcw aria-hidden="true" className="size-4" />
            {action.label}
          </button>
        )}
      </span>
    </div>
  );
  const redraw = () => {
    setContextLost(false);
    setViewerKey((k) => k + 1);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <Link to="/devices" className="inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" /> 보유 노트북
      </Link>
      <header className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="m-0 text-headline font-bold">{d.modelName}</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            No.{row.shortId}
            {d.color ? ` · ${d.color}` : ""} · {DEVICE_OS_LABEL[d.os]} · 대여 {d.rentalCount}회
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AvailabilityBadge device={d} />
          <GradeBadge grade={row.grade} withMeaning />
          {row.defectCount !== null && <span className="text-sm font-semibold">흠집 {row.defectCount}개</span>}
        </div>
      </header>

      <section aria-labelledby="look" className="mt-8">
        <h2 id="look" className="m-0 text-title font-bold">
          외관과 흠집 위치
        </h2>
        <p className="m-0 mt-1 text-sm text-muted-foreground">
          {row.inspection
            ? `${checkpoint ? `${CHECKPOINT_TYPE_LABEL[checkpoint.type]} 검사 · ${formatDateTime(row.inspection.gradedAt)} 기준. ` : ""}색 점이 확정된 흠집이고, 위치는 사진에서 옮긴 대략 위치입니다.`
            : summaryFailed
              ? "흠집 기록을 불러오지 못해 기종 외관만 보여 드립니다."
              : "아직 부스 검사 전이라 기종 외관만 보여 드립니다. 검사를 마치면 흠집 위치가 표시됩니다."}
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            {inspection.isError && <ErrorBanner message="사진과 흠집 위치를 불러오지 못했습니다." onRetry={() => void inspection.refetch()} />}
            {webgl && contextLost ? (
              photoFallback("그래픽 장치가 3D 화면을 멈췄습니다. 열린 탭이 많으면 생길 수 있어요.", { label: "3D 다시 그리기", run: redraw })
            ) : webgl ? (
              <ViewerBoundary
                key={viewerKey}
                fallback={(reason, retry) =>
                  reason === "chunk"
                    ? photoFallback("사이트가 새 버전으로 바뀌어 3D를 다시 불러와야 합니다.", { label: "새로 고침", run: () => window.location.reload() })
                    : photoFallback("3D를 그리지 못했습니다.", { label: "다시 그리기", run: retry })
                }
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-gradient-to-b from-zinc-100 to-zinc-200">
                  <Suspense fallback={<p className="grid h-full place-items-center text-sm">3D를 준비하는 중…</p>}>
                    <LaptopViewer
                      dimensions={d.dimensions}
                      modelCode={d.modelCode}
                      color={d.color}
                      pins={pins}
                      tags={pinTags}
                      selected={selected}
                      onSelect={(id) => setSelected(id)}
                      view={view}
                      viewNonce={viewNonce}
                      lidOpen={lidOpen}
                      onContextLost={() => setContextLost(true)}
                    />
                  </Suspense>
                  {/* 조작법은 3D 위에 바로 적는다(설명 문단을 읽지 않아도 쓸 수 있게) */}
                  <p className="pointer-events-none absolute bottom-2 left-2 m-0 rounded-md bg-white/85 px-2 py-1 text-xs text-zinc-700">
                    끌어서 돌리기 · 휠로 확대 · 점을 누르면 사진
                  </p>
                </div>
              </ViewerBoundary>
            ) : (
              photoFallback("이 브라우저에서는 3D를 볼 수 없습니다.")
            )}
            {webgl && (
              <div role="group" aria-label="보는 방향" className="mt-2 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs text-muted-foreground">보는 방향</span>
                {VIEWS.map((v) => (
                  <button
                    key={v.view}
                    type="button"
                    onClick={() => {
                      setView(v.view);
                      setLidOpen(v.lidOpen);
                      setViewNonce((n) => n + 1);
                    }}
                    className={cn("tap-target h-9 cursor-pointer rounded-full border px-3 text-sm", view === v.view ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted")}
                  >
                    {v.label}
                  </button>
                ))}
                <button type="button" onClick={() => setLidOpen((o) => !o)} className="tap-target h-9 cursor-pointer rounded-full border bg-background px-3 text-sm hover:bg-muted">
                  {lidOpen ? "덮개 닫기" : "덮개 열기"}
                </button>
              </div>
            )}
          </div>

          <aside aria-label="흠집 목록" className={cn("rounded-xl border bg-card p-4", !row.inspection && "self-start")}>
            {row.inspection ? (
              <h3 className="m-0 text-base font-semibold">확정된 흠집 {pins.length}개</h3>
            ) : (
              summaryFailed ? (
              <>
                <h3 className="m-0 text-base font-semibold">흠집 기록을 불러오지 못했습니다</h3>
                <button type="button" onClick={() => void catalog.refetch()} className="tap-target mt-2 h-9 cursor-pointer rounded-full border bg-background px-3 text-sm hover:bg-muted">
                  다시 시도
                </button>
              </>
            ) : (
              <>
                <h3 className="m-0 text-base font-semibold">검사 전</h3>
                <p className="m-0 mt-1 text-sm text-muted-foreground">아직 부스 검사를 마치지 않아 확정된 흠집 기록이 없습니다. 검사와 관리자 확인이 끝나면 흠집 위치와 원본 사진이 함께 보입니다.</p>
              </>
            ))}
            {row.inspection && <p className="m-0 mt-0.5 text-xs text-muted-foreground">{classSummary(row.inspection.defectsByClass, DEFECT_CLASS_LABEL) || "흠집이 없습니다."}</p>}
            {row.inspection && inspection.isPending && <p role="status" className="text-sm">흠집 위치를 불러오는 중…</p>}
            {pins.length > 0 && olderCheckpoints.length > 0 && firstSeen.size > 0 && (
              <p className="m-0 mt-1 text-xs text-muted-foreground">
                이전 검사부터 있던 흠집 {hadBefore} · 이번에 새로 발견 {newCount}
              </p>
            )}
            {pins.length > 0 && historyFailed && <p className="m-0 mt-1 text-xs text-muted-foreground">이전 검사 기록을 불러오지 못해 처음 발견 시점은 빼고 보여 드립니다.</p>}
            {pins.length > 0 && (
              <ol className="m-0 mt-3 grid max-h-64 list-none gap-1 overflow-y-auto p-0">
                {pins.map((pin, i) => (
                  <li key={pin.groupId}>
                    <button
                      type="button"
                      aria-pressed={selected === pin.groupId}
                      onClick={() => choose(pin)}
                      className={cn("flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", selected === pin.groupId ? "bg-muted font-semibold" : "hover:bg-muted/60")}
                    >
                      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: PIN_COLOR[pin.defectClass] }} />
                      <span className="min-w-0">
                        <span className="block">
                          {i + 1}. {DEFECT_CLASS_LABEL[pin.defectClass]} · {CAPTURE_FACE_LABEL[pin.face]}
                          {firstSeen.get(pin.groupId)?.isNew && (
                            <span className="ml-1.5 rounded-full border border-red-300 bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">새 흠집</span>
                          )}
                        </span>
                        {firstSeen.has(pin.groupId) && (
                          <span className="block text-xs font-normal text-muted-foreground">{seenText(firstSeen.get(pin.groupId)!, row.inspection!.checkpointId)}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {current && (
              <div className="mt-3 border-t pt-3">
                {(() => {
                  const head = current.members.find((m) => m.defectId === current.groupId) ?? current.members[0];
                  const src = urlOf(head);
                  return src ? (
                    <PhotoWithDefects
                      src={src}
                      alt={`${CAPTURE_FACE_LABEL[head.face]} ${DEFECT_CLASS_LABEL[head.class]} 사진`}
                      defects={[{ id: head.defectId, title: DEFECT_CLASS_LABEL[head.class], polygon: head.polygon }]}
                      onOpen={() => setLightbox({ photos: memberPhotos(current), index: 0 })}
                    />
                  ) : null;
                })()}
                {firstSeen.has(current.groupId) && (
                  <p className="m-0 mt-2 text-sm font-semibold">처음 발견: {seenText(firstSeen.get(current.groupId)!, row.inspection!.checkpointId)}</p>
                )}
                <p className="m-0 mt-2 text-xs text-muted-foreground">
                  사진 {current.members.length}장에 찍힌 흠집입니다. 사진을 누르면 크게 보고 조명별로 넘겨 볼 수 있어요.
                </p>
              </div>
            )}
            {row.inspection && (
              <p className="m-0 mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {olderCheckpoints.length > 0 && firstSeen.size > 0 && (
                <span className="basis-full">처음 발견 시점은 이전 검사에서 같은 면·가까운 위치의 흠집을 이어 본 대략 판단입니다.</span>
              )}
              {(Object.keys(PIN_COLOR) as (keyof typeof PIN_COLOR)[]).map((c) => (
                <span key={c} className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: PIN_COLOR[c] }} />
                  {DEFECT_CLASS_LABEL[c]}
                </span>
              ))}
              </p>
            )}
          </aside>
        </div>
      </section>

      <section aria-labelledby="spec" className="mt-10">
        <h2 id="spec" className="m-0 text-title font-bold">
          사양과 진단
        </h2>
        <p className="m-0 mt-1 text-sm text-muted-foreground">진단 프로그램이 이 노트북에서 직접 읽은 값입니다. 성능은 같은 조건으로 세 번 잰 중앙값이에요.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="m-0 mb-1 text-base font-semibold">사양</h3>
          <dl className="m-0 text-sm">
            <Row label="CPU" value={d.spec?.cpu ?? "—"} />
            <Row label="메모리" value={d.spec?.ramGb ? `${d.spec.ramGb}GB` : "—"} />
            <Row label="저장장치" value={d.spec?.ssdGb ? `${d.spec.ssdGb}GB SSD` : "—"} />
            {d.spec?.gpu && <Row label="그래픽" value={d.spec.gpu} />}
            <Row label="크기" value={`${d.dimensions.widthMm} × ${d.dimensions.depthMm} mm`} />
          </dl>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="m-0 mb-1 text-base font-semibold">배터리·성능</h3>
          {!diag ? (
            <p className="m-0 text-sm text-muted-foreground">아직 진단 기록이 없습니다.</p>
          ) : (
            <dl className="m-0 text-sm">
              <Row label="수집 시각" value={formatDateTime(diag.collectedAt)} />
              <Row label="배터리 최대 용량" value={percent(row.maxCapacityPct)} />
              <Row label="배터리 충전 횟수" value={row.cycleCount === null ? "—" : `${row.cycleCount}회`} />
              <Row label="SSD 사용률" value={percent(row.ssdUsedPct)} />
              {(Object.keys(BENCH_LABEL) as (keyof typeof BENCH_LABEL)[]).map((m) => (
                <Row key={m} label={`${BENCH_LABEL[m]}(3회 중앙값)`} value={full(row.bench[m], BENCH_UNIT[m])} />
              ))}
            </dl>
          )}
        </div>
        </div>
      </section>

      {photos.length > 0 && (
        <section aria-labelledby="photos" className="mt-10">
          <h2 id="photos" className="m-0 text-title font-bold">
            부스 사진 {photos.length}장
          </h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">카메라 2대와 조명 여러 개로 찍은 원본 사진입니다. 빨간 테두리가 확정된 흠집이고, 사진을 누르면 크게 볼 수 있습니다.</p>
          <PhotoGrid grids={faceGrids(photos, defects)} />
        </section>
      )}
      {lightbox && <PhotoLightbox photos={lightbox.photos} index={lightbox.index} onIndex={(i) => setLightbox({ ...lightbox, index: i })} onClose={() => setLightbox(null)} />}
    </main>
  );
}

