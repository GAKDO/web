import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { Checkpoint, Rental } from "../../../shared/api/types";
import { CHECKPOINT_STATUS_LABEL, CHECKPOINT_TYPE_LABEL } from "../../../shared/codes/labels";
import { DataActions, DataCells, DataRow, DataTable } from "../../../shared/ui/DataTable";
import { SectionTitle } from "../../../shared/ui/PageHeader";
import { formatDateTime } from "../../../shared/ui/format";
import { useCheckpointInspection } from "../api/inspections";
import { repairOf, verdictOf } from "../model/verdict";
import { VERDICT_VARIANT } from "./VerdictBadge";

/** 한 시점의 판정·수리 필요 배지. 검사 결과를 읽어 서버 등급으로만 정한다 */
function HistoryRow({ rental, checkpoint, serial }: { rental: Rental; checkpoint: Checkpoint; serial: string | undefined }) {
  const inspection = useCheckpointInspection(checkpoint.checkpointId);
  const verdict = inspection.isError ? null : verdictOf(checkpoint, inspection.isPending ? "loading" : (inspection.data ?? null));
  const repair = verdict ? repairOf(verdict) : null;
  const backTo = { path: `/admin/rentals/${rental.rentalId}`, label: "렌탈 상세로" };
  return (
    <DataRow label={`${CHECKPOINT_TYPE_LABEL[checkpoint.type]} 검사`}>
      <DataCells>
        <span className="text-muted-foreground tabular-nums">{formatDateTime(checkpoint.occurredAt)}</span>
        <span>
          {CHECKPOINT_TYPE_LABEL[checkpoint.type]} · {CHECKPOINT_STATUS_LABEL[checkpoint.status]}
        </span>
        {verdict ? <Badge variant={VERDICT_VARIANT[verdict.kind]}>{verdict.label}</Badge> : <Badge variant="secondary">판정을 읽지 못함</Badge>}
        {repair && repair.needed !== null ? (
          <Badge variant={repair.needed ? "destructive" : "success"}>{repair.label}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </DataCells>
      <DataActions>
        <Link
          className={buttonVariants({ variant: "outline", size: "sm" })}
          to={`/admin/inspections/${rental.rentalId}/${checkpoint.checkpointId}`}
          state={{ serial, backTo }}
        >
          결과 보기
        </Link>
      </DataActions>
    </DataRow>
  );
}

/** 렌탈 상세의 검사 이력: 이 렌탈에 연결된 시점만, 시작된 순서대로(11/4 화면 요청) */
export function InspectionHistory({ rental, serial }: { rental: Rental; serial: string | undefined }) {
  const checkpoints = rental.checkpoints;
  return (
    <section aria-labelledby="history-title">
      <SectionTitle id="history-title">검사 이력</SectionTitle>
      {checkpoints.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 검사가 없습니다. 부스에서 이 기기를 찍으면 여기에 보입니다.</p>
      ) : (
        <DataTable cols="1.2fr 1fr 1.2fr 1fr 120px" labels={["검사 시각", "시점", "판정", "수리 필요", ""]} label="검사 이력">
          {checkpoints.map((c) => (
            <HistoryRow key={c.checkpointId} rental={rental} checkpoint={c} serial={serial} />
          ))}
        </DataTable>
      )}
    </section>
  );
}
