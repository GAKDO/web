import { Link } from "react-router-dom";
import { ApiError } from "../../../shared/api/problem";
import { messageFor } from "../../../shared/api/errorMessages";
import { DEVICE_FORM_FACTOR_LABEL } from "../../../shared/codes/labels";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { useDeviceModels } from "../../devices/api/devices";
import { DataTable } from "../../../shared/ui/DataTable";

/** 기종 목록. 기종 수가 적어 한 번에 다 보인다(FR-RNT-03) */
export function ModelListPage() {
  const models = useDeviceModels();
  return (
    <section>
      <div className="row heading-row">
        <h1>기종 목록</h1>
        <Link className="button-link primary" to="/admin/models/new">
          기종 등록
        </Link>
      </div>
      {models.isError && (
        <ErrorBanner
          message={models.error instanceof ApiError ? messageFor(models.error) : "목록을 불러오지 못했습니다."}
          onRetry={() => void models.refetch()}
        />
      )}
      {models.isPending && <p>불러오는 중…</p>}
      {models.isSuccess && models.data.length === 0 && <p>등록된 기종이 없습니다. 기기를 등록하기 전에 기종부터 등록해 주세요.</p>}
      <DataTable cols="1.4fr 1fr 0.8fr 1.2fr 120px" labels={["기종 이름", "기종 코드", "제조사", "형태", ""]}>
        <ul className="cards table-list" aria-label="기종">
          {models.data?.map((m) => (
            <li key={m.modelCode} className="card" aria-label={m.modelCode}>
              <div className="card-main">
                <strong>{m.name}</strong>
                <span>{m.modelCode}</span>
                <span>{m.manufacturer ?? "제조사 없음"}</span>
                <span>{DEVICE_FORM_FACTOR_LABEL[m.formFactor]}</span>
              </div>
              <div className="row">
                <Link className="button-link" to={`/admin/models/${encodeURIComponent(m.modelCode)}/edit`}>
                  고치기
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </DataTable>
    </section>
  );
}
