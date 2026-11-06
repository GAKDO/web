import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { refreshSession } from "../../../shared/api/client";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { captureTokenStore } from "../../../shared/auth/captureTokenStore";
import { Button } from "../../../shared/ui/Button";
import { exchangeOnce } from "../../capture/api/exchange";
import { ENTRY_MESSAGE, entryErrorOf, type EntryError } from "../../capture/components/CaptureEntryPage";
import { REPORT } from "../api/report";

/**
 * 폰 수령 촬영(WE2)을 숨긴 배포의 `/capture?t=<QR 토큰>`: QR을 교환해 렌탈을 내 계정에 연결만 한다(11/6, 시연용).
 * 촬영 권한은 쓰지 않으므로 바로 지우고, 세션을 다시 받아 JWT의 rentals에 새 렌탈이 들어가게 한다.
 * 카메라·https 검사는 하지 않는다(촬영하지 않음).
 */
export function ClaimRentalPage() {
  const [params] = useSearchParams();
  const token = params.get("t");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [rentalId, setRentalId] = useState<string | null>(null);
  const [error, setError] = useState<EntryError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setError(null);
    exchangeOnce(token)
      .then(async (grant) => {
        captureTokenStore.clear();
        // 연결된 렌탈은 다음에 받는 액세스 토큰에 들어간다. 못 받아도 연결은 끝났으므로 다시 로그인하면 보인다
        await refreshSession();
        await queryClient.invalidateQueries({ queryKey: REPORT });
        if (!alive) return;
        setRentalId(grant.rentalId);
        navigate("/capture", { replace: true });
      })
      .catch((e: unknown) => alive && setError(entryErrorOf(e)));
    return () => {
      alive = false;
    };
  }, [token, navigate, queryClient, attempt]);

  if (error) {
    return (
      <main className="page">
        <p role="alert">{ENTRY_MESSAGE[error]}</p>
        {(error === "otherAccount" || error === "notCustomer") && <Button onClick={() => void logout()}>로그아웃</Button>}
        {error === "retry" && <Button onClick={() => setAttempt((n) => n + 1)}>다시 시도</Button>}
      </main>
    );
  }
  if (rentalId) {
    return (
      <main className="page grid gap-4">
        <h1 className="text-xl font-semibold">렌탈이 내 계정에 연결되었습니다</h1>
        <p role="status">이제 내 렌탈에서 이 노트북의 검사 결과를 볼 수 있습니다. 봉인된 기록이 있으면 영수증 메일도 보내 드립니다.</p>
        <p className="flex flex-wrap gap-3">
          <Link className="text-info underline-offset-4 hover:underline" to={`/my/rentals/${rentalId}`}>
            이 렌탈 리포트 보기
          </Link>
          <Link className="text-info underline-offset-4 hover:underline" to="/my/rentals">
            내 렌탈 목록
          </Link>
        </p>
      </main>
    );
  }
  if (token) return <p className="page">QR을 확인하는 중…</p>;
  return (
    <p className="page" role="alert">
      연결할 QR 정보가 없습니다. 대여 담당자에게 QR을 다시 받아 주세요.
    </p>
  );
}
