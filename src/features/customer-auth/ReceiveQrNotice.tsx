/** 돌아갈 경로가 수령 QR(`/capture?t=…`)인지. 로그인·가입 화면에서 "로그인하면 렌탈이 연결된다"고 알릴 때 쓴다 */
export function isReceiveQrNext(next: string): boolean {
  const [path, query = ""] = next.split("?", 2);
  return path === "/capture" && new URLSearchParams(query).has("t");
}

/**
 * 수령 QR로 들어와 로그인·가입 화면이 뜬 고객에게 보이는 안내(11/8 민서 결정).
 * 별도 계정 연결 QR 없이, 로그인(또는 가입)을 마치는 순간 수령 QR을 교환해 렌탈이 이 계정에 자동으로 연결된다
 */
export function ReceiveQrNotice({ next, signup = false }: { next: string; signup?: boolean }) {
  if (!isReceiveQrNext(next)) return null;
  return (
    <p role="status" className="m-0 mb-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-200">
      {signup
        ? "수령 QR로 들어오셨어요. 가입과 메일 인증을 마치면 이 렌탈이 새 계정에 자동으로 연결됩니다."
        : "수령 QR로 들어오셨어요. 로그인하면 이 렌탈이 내 계정에 자동으로 연결됩니다. 처음이면 회원가입을 눌러 주세요."}
    </p>
  );
}
