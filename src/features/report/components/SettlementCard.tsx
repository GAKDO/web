import { ReceiptText } from "lucide-react";
import type { Settlement } from "../../../shared/api/types";
import { CAPTURE_FACE_LABEL, DEFECT_CLASS_LABEL } from "../../../shared/codes/labels";
import { useSettlement } from "../api/report";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function size(lengthMm: number | null, areaMm2: number | null): string {
  if (lengthMm != null) return `${lengthMm.toFixed(1)}mm`;
  if (areaMm2 != null) return `${areaMm2.toFixed(1)}mm²`;
  return "—";
}

/** 정산서 본문. 서버가 계산한 금액을 그대로 보이고, 화면에서 다시 계산하지 않는다(규칙 버전이 근거) */
export function SettlementView({ data }: { data: Settlement }) {
  if (data.status === "PENDING") {
    return <p className="m-0 text-sm text-muted-foreground">검수와 등급이 끝나면 정산서가 자동으로 나옵니다.</p>;
  }
  if (data.status === "NOT_APPLICABLE") {
    return <p className="m-0 text-sm text-muted-foreground">{data.notes[0] ?? "이 시점은 정산 대상이 아닙니다."}</p>;
  }
  return (
    <div className="grid gap-3">
      {data.lines.length === 0 ? (
        <p className="m-0 text-sm">반납 때 새로 생긴 흠집이 없어 차감할 금액이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">면</th>
                <th className="py-2 pr-3 font-medium">종류</th>
                <th className="py-2 pr-3 font-medium">크기</th>
                <th className="py-2 pr-3 font-medium">적용 규칙</th>
                <th className="py-2 text-right font-medium">금액</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.defectId} className="border-b last:border-0">
                  <td className="py-2 pr-3">{CAPTURE_FACE_LABEL[l.face]}</td>
                  <td className="py-2 pr-3">{DEFECT_CLASS_LABEL[l.class]}</td>
                  <td className="py-2 pr-3 tabular-nums">{size(l.lengthMm, l.areaMm2)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{l.rule}</td>
                  <td className="py-2 text-right tabular-nums">{won(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-3">
        <span className="text-sm text-muted-foreground">차감 합계(상한 {won(data.cap)})</span>
        <strong className="text-xl tabular-nums" aria-label="차감 합계">{won(data.total)}</strong>
      </div>
      {data.notes.length > 0 && (
        <ul className="m-0 grid gap-1 pl-5 text-xs text-muted-foreground">
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <small className="text-xs text-muted-foreground">
        봉인된 검사 결과와 공개 규칙({data.ruleVersion})으로 계산해, 같은 기록이면 누가 계산해도 같은 금액입니다.
      </small>
    </div>
  );
}

/** 반납 시점 카드. 등급이 난 뒤에만 서버에 묻는다 */
export function SettlementCard({ checkpointId, graded }: { checkpointId: string; graded: boolean }) {
  const q = useSettlement(checkpointId, graded);
  return (
    <section className="mt-6 rounded-xl border bg-card p-4 shadow-xs md:p-6" aria-label="반납 정산서">
      <h2 className="m-0 mb-3 flex items-center gap-2 text-lg font-semibold">
        <ReceiptText aria-hidden="true" className="size-5 text-brand" />
        반납 정산서
      </h2>
      {!graded ? (
        <p className="m-0 text-sm text-muted-foreground">검수와 등급이 끝나면 정산서가 자동으로 나옵니다.</p>
      ) : q.isPending ? (
        <p className="m-0 text-sm text-muted-foreground">계산 중…</p>
      ) : q.isError ? (
        <p role="alert" className="m-0 text-sm text-destructive">정산서를 불러오지 못했습니다.</p>
      ) : (
        <SettlementView data={q.data} />
      )}
    </section>
  );
}
