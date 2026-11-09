import { ArrowLeft, Box, Images } from "lucide-react";
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ApiError } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import type { CatalogPhotoDefect } from "../../../shared/api/types";
import { CAPTURE_CAMERA_LABEL, CAPTURE_FACE_LABEL, CAPTURE_LIGHT_LABEL, CHECKPOINT_TYPE_LABEL, DEFECT_CLASS_LABEL, DEVICE_OS_LABEL } from "../../../shared/codes/labels";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { formatDateTime } from "../../../shared/ui/format";
import { PhotoGrid } from "../../inspections/components/PhotoGrid";
import { PhotoLightbox, type LightboxPhoto } from "../../inspections/components/PhotoLightbox";
import { PhotoWithDefects } from "../../inspections/components/PhotoWithDefects";
import { faceGrids } from "../../inspections/model/photos";
import { hasWebGL } from "../../report/components/TwinSection";
import { useCatalog, useCatalogInspection } from "../api/catalog";
import { classSummary } from "../model/catalog";
import { BENCH_LABEL, BENCH_UNIT, full, percent } from "../model/format";
import { laptopPins, PIN_COLOR, type LaptopPin } from "../model/laptop3d";
import { AvailabilityBadge, GradeBadge } from "./Badges";
import type { ViewPreset } from "./LaptopViewer";
import { usePhotoSizes } from "../../../shared/laptop3d/usePhotoSizes";

// 공개 기기 상세(11/8 민서 요청): 노트북 3D 모델 위에 확정 흠집을 핀으로 찍고, 핀을 누르면 그 흠집이 찍힌 원본 사진을 보여 준다.
// WebGL이 없거나 3D가 실패하면 사진 보기만 남는다. 사양·진단·벤치마크도 함께 보여 준다.

const LaptopViewer = lazy(() => import("./LaptopViewer"));

class ViewerBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
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

  const photos = inspection.data?.photos ?? [];
  const defects = inspection.data?.photoDefects ?? [];
  const sizes = usePhotoSizes(useMemo(() => photos.filter((p) => defects.some((d) => photoKey(d) === photoKey(p))).map((p) => ({ key: photoKey(p), url: p.url })), [photos, defects]));
  const pins = useMemo(() => (row ? laptopPins(defects, row.device.dimensions, (d) => sizes[photoKey(d)]) : []), [row, defects, sizes]);
  const current = pins.find((p) => p.groupId === selected) ?? null;

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
  const photoFallback = (reason: string) => (
    <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      <span>
        <Images aria-hidden="true" className="mx-auto mb-2 size-6" />
        {reason}
        {photos.length > 0 && (
          <>
            <br />
            아래 부스 사진에서 흠집을 확인해 주세요.
          </>
        )}
      </span>
    </div>
  );

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
          <GradeBadge grade={row.grade} />
          {row.defectCount !== null && <span className="text-sm font-semibold">흠집 {row.defectCount}개</span>}
        </div>
      </header>

      <section aria-labelledby="look" className="mt-8">
        <h2 id="look" className="m-0 flex items-center gap-2 text-title font-bold">
          <Box aria-hidden="true" className="size-5" /> 외관 3D
        </h2>
        <p className="m-0 mt-1 text-sm text-muted-foreground">
          {checkpoint ? `${CHECKPOINT_TYPE_LABEL[checkpoint.type]} 검사(${formatDateTime(row.inspection?.gradedAt)}) 기준입니다. ` : ""}
          {row.inspection
            ? "드래그해서 돌려 보고, 표시된 모양은 부스 사진에서 찾은 실제 흠집 모양이에요. 점을 누르면 그 흠집이 찍힌 사진을 볼 수 있어요. 위치는 사진에서 옮긴 대략 위치입니다."
            : summaryFailed
              ? "이 기종의 실제 치수로 만든 외관이에요. 흠집 기록을 불러오지 못해 위치를 표시하지 못했습니다."
              : "이 기종의 실제 치수로 만든 외관이에요. 드래그해서 돌려 볼 수 있어요. 부스 검사를 마치면 흠집 위치가 여기에 표시됩니다."}
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            {inspection.isError && <ErrorBanner message="사진과 흠집 위치를 불러오지 못했습니다." onRetry={() => void inspection.refetch()} />}
            {webgl ? (
              <ViewerBoundary fallback={photoFallback("3D를 그리지 못했습니다.")}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800">
                  <Suspense fallback={<p className="grid h-full place-items-center text-sm">3D를 준비하는 중…</p>}>
                    <LaptopViewer dimensions={d.dimensions} modelCode={d.modelCode} color={d.color} pins={pins} selected={selected} onSelect={(id) => setSelected(id)} view={view} viewNonce={viewNonce} lidOpen={lidOpen} />
                  </Suspense>
                </div>
              </ViewerBoundary>
            ) : (
              photoFallback("이 브라우저에서는 3D를 볼 수 없습니다.")
            )}
            {webgl && (
              <div role="group" aria-label="보는 방향" className="mt-2 flex flex-wrap gap-2">
                {VIEWS.map((v) => (
                  <button
                    key={v.view}
                    type="button"
                    onClick={() => {
                      setView(v.view);
                      setLidOpen(v.lidOpen);
                      setViewNonce((n) => n + 1);
                    }}
                    className={cn("h-9 cursor-pointer rounded-full border px-3 text-sm", view === v.view ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted")}
                  >
                    {v.label}
                  </button>
                ))}
                <button type="button" onClick={() => setLidOpen((o) => !o)} className="h-9 cursor-pointer rounded-full border bg-background px-3 text-sm hover:bg-muted">
                  {lidOpen ? "덮개 닫기" : "덮개 열기"}
                </button>
              </div>
            )}
          </div>

          <aside aria-label="흠집 목록" className={cn("rounded-2xl border bg-card p-4", !row.inspection && "self-start")}>
            {row.inspection ? (
              <h3 className="m-0 text-base font-semibold">확정된 흠집 {pins.length}개</h3>
            ) : (
              summaryFailed ? (
              <>
                <h3 className="m-0 text-base font-semibold">흠집 기록을 불러오지 못했습니다</h3>
                <button type="button" onClick={() => void catalog.refetch()} className="mt-2 h-9 cursor-pointer rounded-full border bg-background px-3 text-sm hover:bg-muted">
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
                      <span>
                        {i + 1}. {DEFECT_CLASS_LABEL[pin.defectClass]} · {CAPTURE_FACE_LABEL[pin.face]}
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
                <p className="m-0 mt-2 text-xs text-muted-foreground">
                  사진 {current.members.length}장에 찍힌 흠집입니다. 사진을 누르면 크게 보고 조명별로 넘겨 볼 수 있어요.
                </p>
              </div>
            )}
            {row.inspection && (
              <p className="m-0 mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
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

      <section aria-labelledby="spec" className="mt-10 grid gap-4 md:grid-cols-2">
        <h2 id="spec" className="sr-only">
          사양과 진단
        </h2>
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="m-0 mb-1 text-base font-semibold">사양</h3>
          <dl className="m-0 text-sm">
            <Row label="CPU" value={d.spec?.cpu ?? "—"} />
            <Row label="메모리" value={d.spec?.ramGb ? `${d.spec.ramGb}GB` : "—"} />
            <Row label="저장장치" value={d.spec?.ssdGb ? `${d.spec.ssdGb}GB SSD` : "—"} />
            {d.spec?.gpu && <Row label="그래픽" value={d.spec.gpu} />}
            <Row label="크기" value={`${d.dimensions.widthMm} × ${d.dimensions.depthMm} mm`} />
          </dl>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="m-0 mb-1 text-base font-semibold">진단·벤치마크</h3>
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
      </section>

      {photos.length > 0 && (
        <section aria-labelledby="photos" className="mt-10">
          <h2 id="photos" className="m-0 text-title font-bold">
            부스 사진 {photos.length}장
          </h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">카메라 2대와 조명 여러 개로 찍은 원본 사진입니다. 빨간 테두리가 확정된 흠집입니다.</p>
          <PhotoGrid grids={faceGrids(photos, defects)} />
        </section>
      )}
      {lightbox && <PhotoLightbox photos={lightbox.photos} index={lightbox.index} onIndex={(i) => setLightbox({ ...lightbox, index: i })} onClose={() => setLightbox(null)} />}
    </main>
  );
}

