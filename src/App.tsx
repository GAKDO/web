// 화면 라우트. 관리자 화면(WE1)은 /admin 아래, 고객 폰 촬영·3D 리포트·검증 페이지는 이 아래에 더한다
import { Navigate, type RouteObject } from "react-router-dom";
import { LoginPage } from "./features/auth/components/LoginPage";
import { CaptureEntryPage } from "./features/capture/components/CaptureEntryPage";
import { CustomerLoginPage } from "./features/customer-auth/components/CustomerLoginPage";
import { DeviceCreatePage } from "./features/devices/components/DeviceCreatePage";
import { DeviceListPage } from "./features/devices/components/DeviceListPage";
import { MyRentalsPage } from "./features/report/components/MyRentalsPage";
import { ReportPage } from "./features/report/components/ReportPage";
import { RentalDetailPage } from "./features/rentals/components/RentalDetailPage";
import { VerifyPage } from "./features/verify/components/VerifyPage";
import { RequireAdmin } from "./shared/auth/RequireAdmin";
import { RequireCustomer } from "./shared/auth/RequireCustomer";

function Home() {
  return (
    <main className="page">
      <h1>TRACE</h1>
      <p>노트북 렌탈 상태 기록</p>
    </main>
  );
}

export const routes: RouteObject[] = [
  { path: "/", element: <Home /> },
  { path: "/admin/login", element: <LoginPage /> },
  { path: "/verify/:verifyToken", element: <VerifyPage /> },
  { path: "/login", element: <CustomerLoginPage /> },
  { path: "/capture", element: <RequireCustomer />, children: [{ index: true, element: <CaptureEntryPage /> }] },
  {
    // 고객 화면(WE3): 고객·관리자 모두 연다
    element: <RequireCustomer />,
    children: [
      { path: "/my/rentals", element: <MyRentalsPage /> },
      { path: "/my/rentals/:rentalId", element: <ReportPage /> },
    ],
  },
  {
    path: "/admin",
    element: <RequireAdmin />,
    children: [
      { index: true, element: <Navigate to="devices" replace /> },
      { path: "devices", element: <DeviceListPage /> },
      { path: "devices/new", element: <DeviceCreatePage /> },
      { path: "rentals", element: <h1>렌탈 목록</h1> },
      { path: "rentals/:rentalId", element: <RentalDetailPage /> },
    ],
  },
];
