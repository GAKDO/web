import { useMutation } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useState } from "react";
import { api, unwrap } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import { ApiError } from "../../../shared/api/problem";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";
import { formatDateTime } from "../../../shared/ui/format";

interface Issued {
  url: string;
  expiresAt: string;
  qr: string;
}

/** 둘 다 같은 수령 QR(같은 발급 API)이고 로그인·가입을 마치면 렌탈이 고객 계정에 연결된다(11/8, 별도 연결 QR 없음).
 * capture: 연결 뒤 수령 촬영(WE2). claim: 폰 촬영을 숨긴 배포에서 연결만 */
type Purpose = "capture" | "claim";

const TEXT: Record<Purpose, { alt: string; hint: string; make: string }> = {
  capture: {
    alt: "수령 QR",
    hint: "고객이 폰 카메라로 읽고 로그인(처음이면 가입)하면 이 렌탈이 고객 계정에 자동으로 연결되고 촬영 화면이 열립니다.",
    make: "수령 QR 만들기",
  },
  claim: {
    alt: "수령 QR",
    hint: "고객이 폰 카메라로 읽고 로그인(처음이면 가입)하면 이 렌탈이 고객 계정에 연결되어 내 렌탈에서 리포트를 봅니다. 한 번만 쓸 수 있습니다.",
    make: "수령 QR 만들기",
  },
};

/** 수령 QR 발급(FR-RNT-04). 1회용 링크는 화면 상태에만 두고 저장하거나 로그에 남기지 않는다 */
export function CaptureLinkPanel({ rentalId, checkpointId, purpose = "capture" }: { rentalId: string; checkpointId: string; purpose?: Purpose }) {
  const text = TEXT[purpose];
  const [issued, setIssued] = useState<Issued | null>(null);
  const [count, setCount] = useState(0);
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  // 복사 중에는 다시 만들기를, 다시 만드는 중에는 복사를 막아 "복사됨"이 다른 링크를 가리키지 않게 한다
  const [copying, setCopying] = useState(false);
  const create = useMutation({
    mutationFn: async (): Promise<Issued> => {
      const link = await unwrap(api.POST("/api/v1/auth/capture-links", { body: { rentalId, checkpointId } }));
      const svg = await QRCode.toString(link.url, { type: "svg", margin: 2 });
      return { ...link, qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
    },
    onSuccess: (next) => {
      setIssued(next);
      setCount((n) => n + 1);
      setCopied(null);
    },
  });

  // 복사가 실제로 된 때만 "복사됨"을 보인다(클립보드를 못 쓰는 브라우저·권한 거부)
  async function copy(url: string) {
    setCopying(true);
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      setCopied("failed");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="grid justify-items-start gap-3 rounded-xl border bg-card p-4 text-sm shadow-xs">
      {create.isError && (
        <ErrorBanner message={create.error instanceof ApiError ? messageFor(create.error) : "QR을 만들지 못했습니다. 다시 시도해 주세요."} />
      )}
      {!issued && <p className="m-0 text-muted-foreground">{text.hint}</p>}
      {issued && (
        <>
          <img className="size-60 max-w-full rounded-lg border bg-white p-2" src={issued.qr} alt={text.alt} />
          <p className="m-0 text-muted-foreground">
            만료 {formatDateTime(issued.expiresAt)} · {text.hint}
          </p>
          {count > 1 && (
            <p role="status" className="m-0 font-medium text-warning">
              새 QR을 만들었습니다. 이전 QR은 쓰지 마세요.
            </p>
          )}
          {copied === "failed" && (
            <p role="alert" className="m-0 text-destructive">
              복사하지 못했습니다. QR을 폰으로 읽게 해 주세요.
            </p>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {issued && (
          <Button busy={copying} disabled={create.isPending} onClick={() => void copy(issued.url)}>
            {copied === "ok" ? "링크 복사됨" : "링크 복사"}
          </Button>
        )}
        <Button busy={create.isPending} disabled={copying} onClick={() => create.mutate()}>
          {issued ? "QR 다시 만들기" : text.make}
        </Button>
      </div>
    </div>
  );
}
