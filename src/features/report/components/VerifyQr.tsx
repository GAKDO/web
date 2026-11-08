import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** 검증 주소를 QR SVG 데이터 URL로 만든다(수령 QR과 같은 방식). 테스트도 이 함수로 기대값을 만든다 */
export async function verifyQrDataUrl(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 리포트 QR로 공개 검증(FR-INT-0x). 종이로 뽑은 리포트나 다른 사람의 폰에서도 QR을 읽으면
 * 로그인 없이 공개 검증 페이지가 열린다. 인쇄할 때도 보이게 print에서 숨기지 않는다
 */
export function VerifyQr({ url }: { url: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setQr(null);
    verifyQrDataUrl(url).then(
      (next) => alive && setQr(next),
      () => alive && setQr(null),
    );
    return () => {
      alive = false;
    };
  }, [url]);

  if (!qr) return null;
  return (
    <section
      aria-label="검증 QR"
      className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-xs break-inside-avoid print:shadow-none"
    >
      <img className="size-32 shrink-0 rounded-lg border bg-white p-1" src={qr} alt="기록 검증 QR" width={128} height={128} />
      <div className="grid min-w-0 flex-1 basis-48 gap-1 text-sm">
        <strong className="text-base">QR로 기록 검증</strong>
        <p className="m-0 text-muted-foreground">폰 카메라로 읽으면 로그인 없이 이 렌탈 기록이 바뀌지 않았는지 확인하는 페이지가 열립니다.</p>
        <a className="break-all text-xs text-muted-foreground" href={url}>
          {url}
        </a>
      </div>
    </section>
  );
}
