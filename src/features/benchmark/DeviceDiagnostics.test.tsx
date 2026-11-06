import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";

describe("성능 화면(기기별 진단 렌탈 전·후 비교)", () => {
  it("관리 메뉴에서 열리고, 기기를 고르면 출고와 수령·반납 진단을 벤치마크·배터리로 비교한다", async () => {
    renderAsAdmin("/admin/benchmark");
    expect(await screen.findByRole("heading", { name: "성능" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /성능/ }).length).toBeGreaterThan(0);
    // 첫 기기는 진단이 없다
    expect(await screen.findByText(/아직 진단을 올린 적이 없습니다/)).toBeInTheDocument();
    const pro = db.devices.find((d) => d.serial === "C02PRO0001")!;
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "기기" }), pro.deviceId);
    expect(await screen.findByRole("heading", { name: "렌탈 전·후 비교" })).toBeInTheDocument();
    // 배터리 최대 용량 91.2% → 84.0%, 점검 플래그
    const battery = screen.getByRole("region", { name: "배터리" });
    expect(within(battery).getAllByText("91.2%").length).toBeGreaterThan(0);
    expect(within(battery).getAllByText("84.0%").length).toBeGreaterThan(0);
    expect(within(screen.getByRole("list", { name: "점검 플래그" })).getByText(/배터리/)).toBeInTheDocument();
    // 디스크 쓰기는 14% 떨어져 경고, CPU 단일 코어는 3%만 떨어져 경고 없음
    const write = screen.getByRole("region", { name: "디스크 쓰기" });
    expect(within(write).getByText(/떨어짐/)).toBeInTheDocument();
    const cpu = screen.getByRole("region", { name: "CPU 단일 코어" });
    expect(within(cpu).queryByText(/떨어짐/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "이 기기의 진단 기록" })).toBeInTheDocument();
  });
});
