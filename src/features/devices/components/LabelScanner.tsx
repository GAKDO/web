import { Camera, ImageUp } from "lucide-react";
import { useId, useState, type ChangeEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseLabelText, type LabelReading } from "../lib/labelParse";
import { readLabelText } from "../lib/ocr";

type ScanState =
  | { kind: "idle" }
  | { kind: "reading"; percent: number }
  | { kind: "done"; reading: LabelReading; text: string }
  | { kind: "failed" };

/**
 * 기기 바닥 라벨을 찍거나 사진을 고르면 글자를 읽어 시리얼·기종 후보를 넘긴다(강사님 피드백 11/6).
 * 읽은 값은 미리 채우기일 뿐이고, 관리자가 아래 칸에서 확인·수정한 뒤 등록한다.
 */
export function LabelScanner({ onRead }: { onRead: (reading: LabelReading) => void }) {
  const inputId = useId();
  const pickId = useId();
  const [state, setState] = useState<ScanState>({ kind: "idle" });

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // 같은 사진을 다시 골라도 change가 일어나게 비운다
    event.target.value = "";
    if (!file) return;
    setState({ kind: "reading", percent: 0 });
    try {
      const text = await readLabelText(file, (p) => {
        if (p.status === "recognizing text") setState({ kind: "reading", percent: Math.round(p.progress * 100) });
      });
      const reading = parseLabelText(text);
      setState({ kind: "done", reading, text });
      onRead(reading);
    } catch {
      setState({ kind: "failed" });
    }
  }

  const busy = state.kind === "reading";
  return (
    <div className="mb-5 rounded-lg border border-dashed p-4">
      <p className="m-0 mb-1 font-semibold">라벨 사진으로 채우기</p>
      <p className="m-0 mb-3 text-sm text-muted-foreground">
        기기 바닥의 시리얼·모델 번호 글자를 가까이, 반사 없이 찍어 주세요. 읽은 값은 아래 칸에 미리 채워지고, 확인·수정한 뒤 등록합니다.
      </p>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={inputId} aria-disabled={busy || undefined} className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer", busy && "pointer-events-none opacity-50")}>
          <Camera aria-hidden />
          {busy ? "읽는 중…" : "라벨 사진 찍기"}
        </label>
        <label htmlFor={pickId} aria-disabled={busy || undefined} className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer", busy && "pointer-events-none opacity-50")}>
          <ImageUp aria-hidden />
          사진 고르기
        </label>
      </div>
      {/* 카메라 권한을 거부하면 촬영 입력이 사진 고르기로 넘어가지 않는 브라우저가 있어 고르기 입력을 따로 둔다 */}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="라벨 사진"
        disabled={busy}
        onChange={pick}
      />
      <input id={pickId} type="file" accept="image/*" className="sr-only" aria-label="저장된 라벨 사진" disabled={busy} onChange={pick} />
      <div role="status" className="mt-3 text-sm empty:hidden">
        {state.kind === "reading" && `글자를 읽고 있습니다… ${state.percent}% (처음 한 번은 글자 모델을 내려받아 조금 더 걸립니다)`}
        {state.kind === "failed" && "사진의 글자를 읽지 못했습니다. 직접 입력하거나 다시 찍어 주세요."}
        {state.kind === "done" && <ScanSummary reading={state.reading} text={state.text} />}
      </div>
    </div>
  );
}

function ScanSummary({ reading, text }: { reading: LabelReading; text: string }) {
  const found = [
    reading.serial && `시리얼 ${reading.serial}`,
    reading.modelNumber && `모델 번호 ${reading.modelNumber}`,
    reading.manufacturer && `제조사 ${reading.manufacturer}`,
  ].filter(Boolean);
  return (
    <>
      <p className="m-0">
        {found.length > 0
          ? `사진에서 읽은 값: ${found.join(", ")}. 0과 O, 1과 I처럼 헷갈리는 글자가 맞는지 확인해 주세요.`
          : "시리얼·모델 번호를 찾지 못했습니다. 라벨을 더 가까이 찍거나 직접 입력해 주세요."}
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-muted-foreground">읽은 글자 전체 보기</summary>
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{text.trim() || "(글자 없음)"}</pre>
      </details>
    </>
  );
}
