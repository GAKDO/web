import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../../shared/api/problem";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { captureTokenStore, type CaptureGrant } from "../../../shared/auth/captureTokenStore";
import { Button } from "../../../shared/ui/Button";
import { exchangeOnce } from "../api/exchange";
import { isCameraContext } from "../camera";
import { CapturePage } from "./CapturePage";

type EntryError = "invalid" | "otherAccount" | "notCustomer" | "retry";

const MESSAGE: Record<EntryError, string> = {
  invalid: "만료되었거나 이미 사용한 QR입니다. 대여 담당자에게 새 QR을 받아 주세요.",
  otherAccount: "다른 계정에 연결된 렌탈입니다. 로그아웃한 뒤 이 렌탈을 받은 계정으로 다시 들어와 주세요.",
  notCustomer: "고객 계정으로 로그인해 주세요. 로그아웃한 뒤 QR을 다시 열어 주세요.",
  retry: "QR을 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
};

function entryErrorOf(e: unknown): EntryError {
  if (!(e instanceof ApiError)) return "retry";
  if (e.status === 410) return "invalid";
  if (e.status === 409) return "otherAccount";
  if (e.status === 403) return "notCustomer";
  return "retry";
}

/** `/capture?t=<QR 토큰>`: 보안 연결 확인 → QR 교환(1회) → 주소창에서 토큰 지움 → 촬영(US2) */
export function CaptureEntryPage() {
  const [params] = useSearchParams();
  const token = params.get("t");
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [grant, setGrant] = useState<CaptureGrant | null>(() => captureTokenStore.get());
  const [error, setError] = useState<EntryError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const secure = isCameraContext();

  useEffect(() => {
    // 보안 연결이 아니면 1회용 QR을 쓰지 않는다
    if (!secure || !token) return;
    let alive = true;
    setError(null);
    exchangeOnce(token)
      .then((g) => {
        if (!alive) return;
        setGrant(g);
        navigate("/capture", { replace: true });
      })
      .catch((e: unknown) => alive && setError(entryErrorOf(e)));
    return () => {
      alive = false;
    };
  }, [secure, token, navigate, attempt]);

  if (!secure) {
    return <p className="page" role="alert">보안 연결(https)에서만 촬영할 수 있습니다. QR을 다시 읽어 https 주소로 열어 주세요.</p>;
  }
  if (error) {
    return (
      <main className="page">
        <p role="alert">{MESSAGE[error]}</p>
        {(error === "otherAccount" || error === "notCustomer") && <Button onClick={() => void logout()}>로그아웃</Button>}
        {error === "retry" && <Button onClick={() => setAttempt((n) => n + 1)}>다시 시도</Button>}
      </main>
    );
  }
  if (token) return <p className="page">QR을 확인하는 중…</p>;
  if (!grant) {
    return (
      <p className="page" role="alert">
        촬영 정보가 없습니다. 새로 고쳤거나 창을 닫았다면 대여 담당자에게 새 QR을 받아 주세요.
      </p>
    );
  }
  return <CapturePage grant={grant} />;
}
