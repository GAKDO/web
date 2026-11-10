import { buttonVariants } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { DEVICE_FORM_FACTOR_LABEL } from "../../../shared/codes/labels";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { Field, SelectField } from "../../../shared/ui/Field";
import { FilterPanel } from "../../../shared/ui/FilterPanel";
import { useDeviceModels } from "../../devices/api/devices";
import { DataActions, DataCells, DataRow, DataTable } from "../../../shared/ui/DataTable";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { Button } from "../../../shared/ui/Button";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import type { DeviceModelSummary } from "../../../shared/api/types";
import { useDeleteDeviceModel } from "../api/models";
import { MODEL_SORT_LABEL, formatGb, matchesModel, sortModels, type ModelSort } from "../lib/modelList";

/**
 * 기종 목록. 기종 수가 적어 한 번에 다 받고, 검색·정렬은 화면에서 한다(FR-RNT-03).
 * 기준 사양(CPU·메모리·저장 공간·GPU)을 열로 보여 준다. 진단 등급·벤치마크 열은 diagnostics 재도입 때 더한다
 */
export function ModelListPage() {
  const models = useDeviceModels();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ModelSort>("name");
  const rows = useMemo(() => sortModels((models.data ?? []).filter((m) => matchesModel(m, search)), sort), [models.data, search, sort]);
  const filtered = search.trim() !== "";

  return (
    <section>
      <PageHeader
        title="기종 목록"
        actions={
          <Link className={buttonVariants()} to="/admin/models/new">
            <Plus aria-hidden="true" />
            기종 등록
          </Link>
        }
      />
      <FilterPanel
        active={sort === "name" ? 0 : 1}
        cols="minmax(0,200px) minmax(0,320px)"
        onReset={() => setSort("name")}
        inline={<Field label="검색" type="search" placeholder="이름·코드·제조사·CPU·GPU" maxLength={64} value={search} onChange={(e) => setSearch(e.target.value)} />}
      >
        <SelectField label="정렬" value={sort} onChange={(e) => setSort(e.target.value as ModelSort)}>
          {Object.entries(MODEL_SORT_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
      </FilterPanel>
      {models.isError && (
        <ErrorBanner
          message={models.error instanceof ApiError ? messageFor(models.error) : "목록을 불러오지 못했습니다."}
          onRetry={() => void models.refetch()}
        />
      )}
      {models.isPending && <p className="text-muted-foreground">불러오는 중…</p>}
      {models.isSuccess && models.data.length === 0 && <p className="text-muted-foreground">등록된 기종이 없습니다. 기기를 등록하기 전에 기종부터 등록해 주세요.</p>}
      {models.isSuccess && models.data.length > 0 && rows.length === 0 && filtered && <p className="text-muted-foreground">검색어에 맞는 기종이 없습니다.</p>}
      <DataTable
        cols="1.4fr 0.9fr 0.8fr 1.1fr 0.6fr 0.7fr 1.1fr 170px"
        labels={["기종 이름", "기종 코드", "제조사", "CPU", "메모리", "저장 공간", "GPU", ""]}
        label="기종"
      >
        {rows.map((m) => (
          <ModelRow key={m.modelCode} model={m} />
        ))}
      </DataTable>
    </section>
  );
}

/**
 * 사양 한 칸. 표(1100px 이상)에서는 값만, 비면 "-". 카드(폰)에서는 "메모리 8GB"처럼 이름을 붙이고 빈 값은 숨긴다
 */
function SpecCell({ label, value }: { label: string; value: string | undefined }) {
  if (value === undefined) {
    return (
      <span className="hidden text-muted-foreground table:inline" aria-label={`${label} 없음`}>
        -
      </span>
    );
  }
  return (
    <span>
      <span className="text-muted-foreground table:sr-only">{label} </span>
      {value}
    </span>
  );
}

/** 기종 한 줄. 지우기 확인 창은 좁은 버튼 칸이 아니라 줄 아래 전체 폭으로 펼친다(11/10) */
function ModelRow({ model: m }: { model: DeviceModelSummary }) {
  const remove = useDeleteDeviceModel();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function run() {
    setError(null);
    remove.mutate(m.modelCode, {
      onSettled: () => setAsking(false),
      onError: (e) => setError(e instanceof ApiError ? messageFor(e) : "지우지 못했습니다. 잠시 뒤 다시 시도해 주세요."),
    });
  }
  return (
    <DataRow label={m.modelCode}>
      <DataCells>
        <strong>{m.name}</strong>
        <span className="font-mono text-[0.8125rem] text-muted-foreground">{m.modelCode}</span>
        <span>
          {m.manufacturer ?? "제조사 없음"}
          <span className="sr-only"> · {DEVICE_FORM_FACTOR_LABEL[m.formFactor]}</span>
        </span>
        <SpecCell label="CPU" value={m.spec?.cpu} />
        <SpecCell label="메모리" value={m.spec?.ramGb === undefined ? undefined : formatGb(m.spec.ramGb)} />
        <SpecCell label="저장 공간" value={m.spec?.ssdGb === undefined ? undefined : formatGb(m.spec.ssdGb)} />
        <SpecCell label="GPU" value={m.spec?.gpu} />
      </DataCells>
      <DataActions>
        <Link className={buttonVariants({ variant: "outline", size: "sm" })} to={`/admin/models/${encodeURIComponent(m.modelCode)}/edit`}>
          수정
        </Link>
        <Button size="sm" className="text-destructive" disabled={remove.isPending} onClick={() => setAsking(true)}>
          <Trash2 aria-hidden="true" />
          삭제
        </Button>
      </DataActions>
      {(asking || error) && (
        <div className="col-span-full">
          {asking && (
            <ConfirmDialog
              message={`기종 "${m.name}"(${m.modelCode})을 지울까요? 이 기종으로 등록된 기기가 없을 때만 지워지며 되돌릴 수 없습니다.`}
              confirmLabel="삭제"
              busy={remove.isPending}
              onConfirm={run}
              onCancel={() => setAsking(false)}
            />
          )}
          {error && (
            <p className="mt-2 mb-0 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </DataRow>
  );
}
