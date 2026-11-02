// 화면 라우트. 관리자 화면(WE1)은 /admin 아래, 고객 폰 촬영·3D 리포트·검증 페이지는 이 아래에 더한다
import { Navigate, type RouteObject } from "react-router-dom";
import { LoginPage } from "./features/auth/components/LoginPage";
import { DeviceListPage } from "./features/devices/components/DeviceListPage";
import { RequireAdmin } from "./shared/auth/RequireAdmin";

function Home() {
  return (
    <main className="page">
      <h1>TRACE</h1>
      <p>노트북 렌탈 상태 기록</p>
    </main>
  );
}

function Placeholder({ title }: { title: string }) {
  return <h1>{title}</h1>;
}

export const routes: RouteObject[] = [
  { path: "/", element: <Home /> },
  { path: "/admin/login", element: <LoginPage /> },
  {
    path: "/admin",
    element: <RequireAdmin />,
    children: [
      { index: true, element: <Navigate to="devices" replace /> },
      { path: "devices", element: <DeviceListPage /> },
      { path: "rentals", element: <Placeholder title="렌탈 목록" /> },
    ],
  },
];
