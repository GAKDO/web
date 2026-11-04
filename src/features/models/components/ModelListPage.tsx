import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { DEVICE_FORM_FACTOR_LABEL } from "../../../shared/codes/labels";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useDeviceModels } from "../../devices/api/devices";
import { DataActions, DataCells, DataRow, DataTable } from "../../../shared/ui/DataTable";
import { PageHeader } from "../../../shared/ui/PageHeader";

/** 기종 목록. 기종 수가 적어 한 번에 다 보인다(FR-RNT-03) */
export function ModelListPage() {
  const models = useDeviceModels();
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
      {models.isError && (
        <ErrorBanner
          message={models.error instanceof ApiError ? messageFor(models.error) : "목록을 불러오지 못했습니다."}
          onRetry={() => void models.refetch()}
        />
      )}
      {models.isPending && <p className="text-muted-foreground">불러오는 중…</p>}
      {models.isSuccess && models.data.length === 0 && <p className="text-muted-foreground">등록된 기종이 없습니다. 기기를 등록하기 전에 기종부터 등록해 주세요.</p>}
      <DataTable cols="1.4fr 1fr 0.8fr 1.2fr 120px" labels={["기종 이름", "기종 코드", "제조사", "형태", ""]} label="기종">
        {models.data?.map((m) => (
          <DataRow key={m.modelCode} label={m.modelCode}>
            <DataCells>
              <strong>{m.name}</strong>
              <span className="font-mono text-[13px] text-muted-foreground">{m.modelCode}</span>
              <span>{m.manufacturer ?? "제조사 없음"}</span>
              <span>{DEVICE_FORM_FACTOR_LABEL[m.formFactor]}</span>
            </DataCells>
            <DataActions>
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} to={`/admin/models/${encodeURIComponent(m.modelCode)}/edit`}>
                수정
              </Link>
            </DataActions>
          </DataRow>
        ))}
      </DataTable>
    </section>
  );
}
