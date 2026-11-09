import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { refreshSession } from "../../../shared/api/client";
import { ApiError } from "../../../shared/api/problem";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { captureTokenStore, type CaptureGrant } from "../../../shared/auth/captureTokenStore";
import { Button } from "../../../shared/ui/Button";
import { exchangeOnce } from "../api/exchange";
import { REPORT } from "../../report/api/report";
import { hasCameraApi, isSecure } from "../camera";
import { CapturePage } from "./CapturePage";

export type EntryError = "invalid" | "otherAccount" | "notCustomer" | "retry";

export const ENTRY_MESSAGE: Record<EntryError, string> = {
  invalid: "만료되었거나 이미 사용한 QR입니다. 대여 담당자에게 새 QR을 받아 주세요.",
  otherAccount: "다른 계정에 연결된 렌탈입니다. 로그아웃한 뒤 이 렌탈을 받은 계정으로 다시 들어와 주세요.",
  notCustomer: "고객 계정으로 로그인해 주세요. 로그아웃한 뒤 QR을 다시 열어 주세요.",
  retry: "QR을 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
};

export function entryErrorOf(e: unknown): EntryError {
  if (!(e instanceof ApiError)) return "retry";
  if (e.status === 410) return "invalid";
  if (e.status === 409) return "otherAccount";
  if (e.status === 403) return "notCustomer";
  return "retry";
}

/**
 * `/capture?t=<QR 토큰>`: 보안 연결 확인 → QR 교환(1회) → 주소창에서 토큰 지움 → 촬영(US2).
 * 로그인 전이면 RequireCustomer가 로그인(가입) 화면으로 보냈다가 돌아오고, 교환하는 순간 렌탈이 이 계정에 연결된다(auth-server)
 */
export function CaptureEntryPage() {
  const [params] = useSearchParams();
  const token = params.get("t");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [grant, setGrant] = useState<CaptureGrant | null>(() => captureTokenStore.get());
  const [error, setError] = useState<EntryError | null>(null);
  const [attempt, setAttempt] = useState(0);
  // 이번에 QR을 교환해 렌탈이 계정에 연결됐는지(연결 안내를 촬영 화면 위에 한 번 보인다)
  const [linked, setLinked] = useState(false);
  const secure = isSecure();
  const ready = secure && hasCameraApi();

  useEffect(() => {
    // 보안 연결이 아니거나 카메라를 못 쓰면 1회용 QR을 쓰지 않는다
    if (!ready || !token) return;
    let alive = true;
    setError(null);
    exchangeOnce(token)
      .then((g) => {
        if (!alive) return;
        setGrant(g);
        setLinked(true);
        navigate("/capture", { replace: true });
        // 교환으로 연결된 렌탈은 다음에 받는 로그인 토큰의 rentals에 들어간다. 촬영을 막지 않게 기다리지 않고 세션을 다시 받아
        // 제출 뒤 "마이페이지로 가기"에서 새 렌탈이 보이게 한다. 다시 받지 못해도 촬영 권한(captureTokenStore)은 그대로 둔다
        void refreshSession()
          .then(() => queryClient.invalidateQueries({ queryKey: REPORT }))
          .catch(() => undefined);
      })
      .catch((e: unknown) => alive && setError(entryErrorOf(e)));
    return () => {
      alive = false;
    };
  }, [ready, token, navigate, queryClient, attempt]);

  if (!secure) {
    return <p className="page" role="alert">보안 연결(https)에서만 촬영할 수 있습니다. QR을 다시 읽어 https 주소로 열어 주세요.</p>;
  }
  if (!ready) {
    return <p className="page" role="alert">이 브라우저는 카메라를 쓸 수 없습니다. 폰 기본 브라우저(Safari·Chrome)로 QR을 다시 열어 주세요.</p>;
  }
  if (error) {
    return (
      <main className="page">
        <p role="alert">{ENTRY_MESSAGE[error]}</p>
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
  return <CapturePage grant={grant} linked={linked} />;
}
