// 화면 라우트. 관리자 화면(WE1)은 /admin 아래, 고객 폰 촬영·3D 리포트·검증 페이지는 이 아래에 더한다
import { Navigate, type RouteObject } from "react-router-dom";
import { HomePage } from "./features/home/components/HomePage";
import { BoothPage } from "./features/booth/components/BoothPage";
import { PasswordResetPage } from "./features/account/components/PasswordResetPage";
import { WithdrawnPage, WithdrawPage } from "./features/account/components/WithdrawPage";
import { MyAccountPage } from "./features/account/components/MyAccountPage";
import { LoginPage } from "./features/auth/components/LoginPage";
import { SignupPage } from "./features/signup/components/SignupPage";
import { VerifyEmailPage } from "./features/signup/components/VerifyEmailPage";
import { CaptureEntryPage } from "./features/capture/components/CaptureEntryPage";
import { CustomerLoginPage } from "./features/customer-auth/components/CustomerLoginPage";
import { DeviceCreatePage } from "./features/devices/components/DeviceCreatePage";
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
import { ClaimRentalPage } from "./features/report/components/ClaimRentalPage";
import { VerifyPage } from "./features/verify/components/VerifyPage";
import { RequireAdmin } from "./shared/auth/RequireAdmin";
import { RequireCustomer } from "./shared/auth/RequireCustomer";
import { BenchmarkPage } from "./features/benchmark/components/BenchmarkPage";
import { ArchivedRoute } from "./shared/config/ArchivedRoute";
import { isArchived } from "./shared/config/features";

/** 수령 QR 주소. 폰 촬영을 숨긴 배포에서는 렌탈을 계정에 연결만 한다(내 렌탈이 보일 때) */
function CaptureOrClaim() {
  return isArchived("phoneCapture") ? <ClaimRentalPage /> : <CaptureEntryPage />;
}


export const routes: RouteObject[] = [
  { path: "/", element: <HomePage /> },
  { path: "/admin/login", element: <LoginPage /> },
  // 부스 옆 태블릿 화면(11/6 강사님 피드백 3번). 관리자 틀(메뉴) 없이 화면 전체를 쓴다
  { path: "/booth", element: <BoothPage /> },
  { path: "/verify/:verifyToken", element: <ArchivedRoute features={["report"]}><VerifyPage /></ArchivedRoute> },
  { path: "/login", element: <ArchivedRoute features={["phoneCapture", "report", "account"]}><CustomerLoginPage /></ArchivedRoute> },
  { path: "/password/reset", element: <ArchivedRoute features={["account"]}><PasswordResetPage /></ArchivedRoute> },
  { path: "/account/withdrawn", element: <ArchivedRoute features={["account"]}><WithdrawnPage /></ArchivedRoute> },
  { path: "/signup", element: <ArchivedRoute features={["account"]}><SignupPage /></ArchivedRoute> },
  { path: "/signup/verify", element: <ArchivedRoute features={["account"]}><VerifyEmailPage /></ArchivedRoute> },
  { path: "/capture", element: <ArchivedRoute features={["phoneCapture", "report"]}><RequireCustomer /></ArchivedRoute>, children: [{ index: true, element: <CaptureOrClaim /> }] },
  {
    // 고객 화면(WE3): 고객·관리자 모두 연다. 보관 검사를 로그인 검사보다 먼저 한다(보관된 주소는 로그인 화면이 아니라 첫 화면으로)
    element: <ArchivedRoute features={["report"]}><RequireCustomer /></ArchivedRoute>,
    children: [
      { path: "/my/rentals", element: <MyRentalsPage /> },
      { path: "/my/rentals/:rentalId", element: <ReportPage /> },
    ],
  },
  {
    element: <ArchivedRoute features={["account"]}><RequireCustomer customerOnly /></ArchivedRoute>,
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
      { path: "models", element: <ModelListPage /> },
      { path: "models/new", element: <ModelEditPage /> },
      { path: "models/:modelCode/edit", element: <ModelEditPage /> },
      { path: "rentals", element: <RentalListPage /> },
      { path: "rentals/new", element: <RentalCreatePage /> },
      { path: "rentals/:rentalId", element: <RentalDetailPage /> },
      // MVP(11/3): 부스 검사 결과 조회
      { path: "inspections", element: <InspectionListPage /> },
      { path: "inspections/:rentalId/:checkpointId", element: <InspectionDetailPage /> },
      // 11/6: Grafana 대신 검사 결과 통계 그래프
      { path: "benchmark", element: <BenchmarkPage /> },
    ],
  },
];
