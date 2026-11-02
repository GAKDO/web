import { useMutation } from "@tanstack/react-query";
import QRCode from "qrcode";
import { useState } from "react";
import { api, unwrap } from "../../../shared/api/client";
import { messageFor } from "../../../shared/api/errorMessages";
import { ApiError } from "../../../shared/api/problem";
import { Button } from "../../../shared/ui/Button";
import { ErrorBanner } from "../../../shared/ui/ErrorBanner";

interface Issued {
  url: string;
  expiresAt: string;
  qr: string;
}

/** 수령 QR 발급(FR-RNT-04). 1회용 링크는 화면 상태에만 두고 저장하거나 로그에 남기지 않는다 */
export function CaptureLinkPanel({ rentalId, checkpointId }: { rentalId: string; checkpointId: string }) {
  const [issued, setIssued] = useState<Issued | null>(null);
  const [count, setCount] = useState(0);
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
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
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="qr-panel">
      {create.isError && (
        <ErrorBanner message={create.error instanceof ApiError ? messageFor(create.error) : "QR을 만들지 못했습니다. 다시 시도해 주세요."} />
      )}
      {issued && (
        <>
          <img className="qr" src={issued.qr} alt="수령 QR" />
          <p>
            만료 {new Date(issued.expiresAt).toLocaleString("ko-KR")} · 고객이 폰 카메라로 읽으면 촬영 화면이 열립니다.
          </p>
          {count > 1 && <p role="status">새 QR을 만들었습니다. 이전 QR은 쓰지 마세요.</p>}
          <Button onClick={() => void copy(issued.url)}>{copied === "ok" ? "링크 복사됨" : "링크 복사"}</Button>
          {copied === "failed" && <p role="alert">복사하지 못했습니다. QR을 폰으로 읽게 해 주세요.</p>}
        </>
      )}
      <Button busy={create.isPending} onClick={() => create.mutate()}>
        {issued ? "QR 다시 만들기" : "수령 QR 만들기"}
      </Button>
    </div>
  );
}
