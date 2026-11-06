// 화면 라우트. 관리자 화면(WE1)은 /admin 아래, 고객 폰 촬영·3D 리포트·검증 페이지는 이 아래에 더한다
import { Navigate, type RouteObject } from "react-router-dom";
import { HomePage } from "./features/home/components/HomePage";
import { PasswordResetPage } from "./features/account/components/PasswordResetPage";
import { WithdrawnPage, WithdrawPage } from "./features/account/components/WithdrawPage";
import { MyAccountPage } from "./features/account/components/MyAccountPage";
import { LoginPage } from "./features/auth/components/LoginPage";
import { SignupPage } from "./features/signup/components/SignupPage";
import { VerifyEmailPage } from "./features/signup/components/VerifyEmailPage";
import { CaptureEntryPage } from "./features/capture/components/CaptureEntryPage";
import { CustomerLoginPage } from "./features/customer-auth/components/CustomerLoginPage";
import { DeviceCreatePage } from "./features/devices/components/DeviceCreatePage";
import { DeviceDetailPage } from "./features/devices/components/DeviceDetailPage";
import { DeviceListPage } from "./features/devices/components/DeviceListPage";
import { InspectionDetailPage } from "./features/inspections/components/InspectionDetailPage";
import { InspectionListPage } from "./features/inspections/components/InspectionListPage";
import { ModelEditPage } from "./features/models/components/ModelEditPage";
import { ModelListPage } from "./features/models/components/ModelListPage";
import { RentalCreatePage } from "./features/rentals/components/RentalCreatePage";
import { RentalDetailPage } from "./features/rentals/components/RentalDetailPage";
import { RentalListPage } from "./features/rentals/components/RentalListPage";
import { MyRentalsPage } from "./features/report/components/MyRentalsPage";
import { ReportPage } from "./features/report/components/ReportPage";
import { VerifyPage } from "./features/verify/components/VerifyPage";
import { RequireAdmin } from "./shared/auth/RequireAdmin";
import { RequireCustomer } from "./shared/auth/RequireCustomer";
import { ArchivedRoute } from "./shared/config/ArchivedRoute";


export const routes: RouteObject[] = [
  { path: "/", element: <HomePage /> },
  { path: "/admin/login", element: <LoginPage /> },
  { path: "/verify/:verifyToken", element: <ArchivedRoute features={["report"]}><VerifyPage /></ArchivedRoute> },
  { path: "/login", element: <ArchivedRoute features={["phoneCapture", "report", "account"]}><CustomerLoginPage /></ArchivedRoute> },
  { path: "/password/reset", element: <ArchivedRoute features={["account"]}><PasswordResetPage /></ArchivedRoute> },
  { path: "/account/withdrawn", element: <ArchivedRoute features={["account"]}><WithdrawnPage /></ArchivedRoute> },
  { path: "/signup", element: <ArchivedRoute features={["account"]}><SignupPage /></ArchivedRoute> },
  { path: "/signup/verify", element: <ArchivedRoute features={["account"]}><VerifyEmailPage /></ArchivedRoute> },
  { path: "/capture", element: <ArchivedRoute features={["phoneCapture"]}><RequireCustomer /></ArchivedRoute>, children: [{ index: true, element: <CaptureEntryPage /> }] },
  {
    // 고객 화면(WE3): 고객·관리자 모두 연다. 보관 검사를 로그인 검사보다 먼저 한다(보관된 주소는 로그인 화면이 아니라 첫 화면으로)
    element: <ArchivedRoute features={["report"]}><RequireCustomer /></ArchivedRoute>,
    children: [
      { path: "/my/rentals", element: <MyRentalsPage /> },
      { path: "/my/rentals/:rentalId", element: <ReportPage /> },
    ],
  },
  {
    element: <ArchivedRoute features={["account"]}><RequireCustomer /></ArchivedRoute>,
    children: [
      { path: "/my/account", element: <MyAccountPage /> },
      { path: "/my/account/withdraw", element: <WithdrawPage /> },
    ],
  },
  {
    path: "/admin",
    element: <RequireAdmin />,
    children: [
      { index: true, element: <Navigate to="devices" replace /> },
      { path: "devices", element: <DeviceListPage /> },
      { path: "devices/new", element: <DeviceCreatePage /> },
      // 기기 상세 + 기기별 렌탈 이력(11/6)
      { path: "devices/:deviceId", element: <DeviceDetailPage /> },
      { path: "models", element: <ModelListPage /> },
      { path: "models/new", element: <ModelEditPage /> },
      { path: "models/:modelCode/edit", element: <ModelEditPage /> },
      { path: "rentals", element: <RentalListPage /> },
      { path: "rentals/new", element: <RentalCreatePage /> },
      { path: "rentals/:rentalId", element: <RentalDetailPage /> },
      // MVP(11/3): 부스 검사 결과 조회
      { path: "inspections", element: <InspectionListPage /> },
      { path: "inspections/:rentalId/:checkpointId", element: <InspectionDetailPage /> },
    ],
  },
];
