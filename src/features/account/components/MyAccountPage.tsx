import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth/AuthProvider";
import { isArchived } from "../../../shared/config/features";
import { Button } from "../../../shared/ui/Button";

/**
 * 내 계정 `/my/account`. 고객이 로그인한 뒤 머무는 곳(FR-USR-01·04).
 * 3D 리포트(WE3)를 숨긴 MVP 배포에서도 로그아웃·탈퇴로 갈 길을 남긴다
 */
export function MyAccountPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const reportArchived = isArchived("report");

  async function signOut() {
    const confirmed = await logout();
    // 서버가 로그아웃을 확인하지 못했으면 리프레시가 남았을 수 있으니 로그인 화면에서 알린다
    navigate(confirmed ? "/" : "/login?loggedOut=partial", { replace: true });
  }

  return (
    <main className="page narrow">
      <h1>내 계정</h1>
      <p role="status">로그인되어 있습니다.</p>
      <p>
        {reportArchived
          ? "노트북을 빌리면 관리자가 부스에서 상태를 검사하고 결과를 기록합니다."
          : "빌린 노트북의 검사 결과는 내 렌탈에서 볼 수 있습니다."}
      </p>
      <ul>
        {!reportArchived && (
          <li>
            <Link to="/my/rentals">내 렌탈</Link>
          </li>
        )}
        <li>
          <Link to="/my/account/withdraw">계정 탈퇴</Link>
        </li>
      </ul>
      <Button onClick={() => void signOut()}>로그아웃</Button>
    </main>
  );
}
