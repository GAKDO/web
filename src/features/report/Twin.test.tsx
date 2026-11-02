import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsCustomer } from "../../test/renderApp";
import { http } from "msw";
import { db } from "../../shared/mocks/db";
import { server } from "../../shared/mocks/node";
import { problem } from "../../shared/mocks/handlers/problem";

const firstRentalId = () => [...db.report.owners.keys()][0];

async function openTwin() {
  const u = userEvent.setup();
  renderAsCustomer(`/my/rentals/${firstRentalId()}`);
  const twin = await screen.findByRole("region", { name: /3D로 보기/ });
  return { u, twin };
}

const slider = () => screen.getByRole("slider", { name: "시점" });
const newTags = (twin: HTMLElement) => within(twin).queryAllByText("신규");

test("출고 흠집 0개·수령 신규 1개일 때 슬라이더를 출고에서 수령으로 옮기면 핀 1개가 '신규'로 구분돼 나타난다", async () => {
  const { twin } = await openTwin();
  fireEvent.change(slider(), { target: { value: "0" } });
  expect(within(twin).getByRole("heading", { name: "3D로 보기 · 출고" })).toBeInTheDocument();
  expect(newTags(twin)).toHaveLength(0);
  fireEvent.change(slider(), { target: { value: "1" } });
  expect(within(twin).getByRole("heading", { name: "3D로 보기 · 수령" })).toBeInTheDocument();
  const list = within(twin).getByRole("list", { name: "흠집" });
  expect(within(list).getByRole("button", { name: /신규 윗면\(덮개\) 흠집/ })).toHaveClass("pin-new");
  expect(newTags(twin)).toHaveLength(1);
});

test("수령 시점에서 슬라이더를 다시 출고로 옮기면 신규 핀이 사라지고 출고 사진으로 돌아간다", async () => {
  const { twin } = await openTwin();
  expect(newTags(twin)).toHaveLength(1);
  fireEvent.change(slider(), { target: { value: "0" } });
  expect(newTags(twin)).toHaveLength(0);
  expect(await within(twin).findByRole("img", { name: "키보드 사진" })).toBeInTheDocument();
});

test("핀을 누르면 그 흠집의 크롭 사진, 종류, 면, 크기가 보인다", async () => {
  const { u, twin } = await openTwin();
  await u.click(within(twin).getByRole("button", { name: /신규 윗면/ }));
  const detail = await screen.findByRole("dialog", { name: "흠집 상세" });
  expect(await within(detail).findByText("긁힘")).toBeInTheDocument();
  expect(within(detail).getByText("윗면(덮개)")).toBeInTheDocument();
  expect(within(detail).getByText("12mm")).toBeInTheDocument();
  expect(within(detail).getByText("3.1mm²")).toBeInTheDocument();
  expect(within(detail).getByRole("img", { name: "흠집 확대 사진" })).toBeInTheDocument();
  expect(within(detail).getByText("직전 시점에 없던 흠집")).toBeInTheDocument();
  expect(within(detail).getByText("grade-rules-v1")).toBeInTheDocument();
});

test("출고 시점 핀은 '이전부터 있음' 대신 비교하지 않는다고 보인다", async () => {
  const { u, twin } = await openTwin();
  fireEvent.change(slider(), { target: { value: "0" } });
  await u.click(within(twin).getAllByRole("button", { name: /바닥/ })[0]);
  const detail = await screen.findByRole("dialog", { name: "흠집 상세" });
  expect(within(detail).getByText("출고는 기준 시점이라 비교하지 않음")).toBeInTheDocument();
});

test("아직 봉인되지 않은 시점은 '검사 중'으로 보이고 슬라이더에 오르지 않는다", async () => {
  const { twin } = await openTwin();
  expect(within(twin).getByText("반납: 검사 중이라 아직 볼 수 없습니다.")).toBeInTheDocument();
  expect(slider()).toHaveAttribute("max", "1");
});

test("슬라이더를 키보드(좌우 화살표)로 움직이면 마우스와 같은 결과가 나온다", async () => {
  const { u, twin } = await openTwin();
  slider().focus();
  await u.keyboard("{ArrowLeft}");
  expect(within(twin).getByRole("heading", { name: "3D로 보기 · 출고" })).toBeInTheDocument();
});

test("사진이 없는 면(폰 촬영의 키보드)은 '사진 없음'으로 보이고, 3D를 그릴 수 없으면 면별 사진으로 대신 보인다", async () => {
  const { twin } = await openTwin();
  expect(await within(twin).findByText(/3D를 볼 수 없어 면별 사진으로/)).toBeInTheDocument();
  const kb = within(twin).getByRole("listitem", { name: "키보드" });
  expect(within(kb).getByText("사진 없음")).toBeInTheDocument();
  expect(await within(twin).findByRole("img", { name: "윗면(덮개) 사진" })).toBeInTheDocument();
});

test("사진을 불러오지 못하면 '사진 없음' 대신 오류와 다시 불러오기 버튼이 보인다", async () => {
  server.use(http.get("*/api/v1/captures/checkpoints/:checkpointId/media", () => problem(500, "INTERNAL_ERROR", "서버 오류")));
  const { twin } = await openTwin();
  expect(await within(twin).findByRole("alert")).toHaveTextContent("사진을 불러오지 못했습니다.");
  expect(within(twin).getByRole("button", { name: "사진 다시 불러오기" })).toBeInTheDocument();
});

test("검사 결과를 불러오지 못하면 흠집 상세가 '확인 중'에 머물지 않고 다시 불러오기를 보인다", async () => {
  server.use(http.get("*/api/v1/captures/checkpoints/:checkpointId/inspection", () => problem(500, "INTERNAL_ERROR", "서버 오류")));
  const { u, twin } = await openTwin();
  await u.click(within(twin).getByRole("button", { name: /신규 윗면/ }));
  const detail = await screen.findByRole("dialog", { name: "흠집 상세" });
  expect(await within(detail).findByText("검사 결과를 불러오지 못했습니다")).toBeInTheDocument();
  expect(within(detail).getByRole("button", { name: "검사 결과 다시 불러오기" })).toBeInTheDocument();
});

test("한 면에 흠집이 둘이면 목록에서 1, 2로 구별된다", async () => {
  const timeline = db.report.timelines.get(firstRentalId());
  const rcv = timeline?.checkpoints.find((c) => c.type === "RCV");
  rcv?.pins.push({ defectId: "bbbbbbbbbbbbbbbbbbbbb", face: "TOP", x: 300, y: 200, isNew: true });
  const { twin } = await openTwin();
  const list = within(twin).getByRole("list", { name: "흠집" });
  expect(within(list).getByRole("button", { name: "신규 윗면(덮개) 흠집 1" })).toBeInTheDocument();
  expect(within(list).getByRole("button", { name: "신규 윗면(덮개) 흠집 2" })).toBeInTheDocument();
});
