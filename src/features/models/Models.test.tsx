import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";
import { toRequest } from "./components/ModelEditPage";

test("관리 메뉴의 기종을 누르면 등록된 기종이 모두 보인다", async () => {
  const user = userEvent.setup();
  renderAsAdmin("/admin/devices");
  await user.click(await screen.findByRole("link", { name: "기종" }));
  expect(await screen.findByRole("heading", { name: "기종 목록" })).toBeInTheDocument();
  for (const code of ["MBA13-M2", "MBP14-M3", "LG-GRAM16"]) {
    expect(await screen.findByRole("listitem", { name: code })).toBeInTheDocument();
  }
});

async function fillDims(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("가로(mm)"), "357.7");
  await user.type(screen.getByLabelText("세로(mm)"), "248.2");
  await user.type(screen.getByLabelText("본체 두께(mm)"), "10.5");
  await user.type(screen.getByLabelText("덮개 두께(mm)"), "6.4");
}

test("새 기종을 등록하면 목록에 보이고 기기 등록 화면에서 고를 수 있다", async () => {
  const user = userEvent.setup();
  const { router } = renderAsAdmin("/admin/models/new");
  await screen.findByRole("heading", { name: "기종 등록" });
  await user.type(screen.getByLabelText("기종 코드"), "mba15-m3");
  await user.type(screen.getByLabelText("이름"), "MacBook Air 15 (M3, 2024)");
  await user.type(screen.getByLabelText("제조사(선택)"), "Apple");
  await fillDims(user);
  await user.type(screen.getByLabelText("메모리(GB)"), "16");
  await user.click(screen.getByRole("button", { name: "저장" }));

  expect(await screen.findByRole("listitem", { name: "MBA15-M3" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/admin/models");
  const saved = db.models.find((m) => m.modelCode === "MBA15-M3");
  expect(saved?.dimensions).toEqual({ widthMm: 357.7, depthMm: 248.2, baseHMm: 10.5, lidHMm: 6.4 });
  expect(saved?.spec).toEqual({ ramGb: 16 });

  await router.navigate("/admin/devices/new");
  expect(await screen.findByRole("option", { name: "MacBook Air 15 (M3, 2024)" })).toBeInTheDocument();
});

test("이미 있는 기종 코드로 새로 등록하면 덮어쓰지 않고 고치기로 안내한다", async () => {
  const user = userEvent.setup();
  renderAsAdmin("/admin/models/new");
  await screen.findByRole("heading", { name: "기종 등록" });
  await user.type(screen.getByLabelText("기종 코드"), "MBA13-M2");
  await user.type(screen.getByLabelText("이름"), "덮어쓰기");
  await fillDims(user);
  await waitFor(() => expect(screen.getByRole("button", { name: "저장" })).toBeEnabled());
  await user.click(screen.getByRole("button", { name: "저장" }));
  expect(await screen.findByText("이미 있는 기종 코드입니다. 기종 목록에서 고치기를 눌러 주세요.")).toBeInTheDocument();
  expect(db.models.find((m) => m.modelCode === "MBA13-M2")?.name).toBe("MacBook Air (M2, 2022)");
});

test("기종을 고치면 지금 값이 채워져 있고, 바꾼 치수와 이름이 저장되며 기기 목록 이름도 바뀐다", async () => {
  const user = userEvent.setup();
  const { router } = renderAsAdmin("/admin/models/MBA13-M2");
  await screen.findByRole("heading", { name: "기종 고치기" });
  expect(await screen.findByDisplayValue("MacBook Air (M2, 2022)")).toBeInTheDocument();
  expect(screen.getByLabelText("기종 코드")).toHaveAttribute("readonly");
  const lid = screen.getByLabelText("덮개 두께(mm)");
  await user.clear(lid);
  await user.type(lid, "4.3");
  const name = screen.getByLabelText("이름");
  await user.clear(name);
  await user.type(name, "MacBook Air 13 (M2)");
  await user.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/admin/models"));
  const saved = db.models.find((m) => m.modelCode === "MBA13-M2");
  expect(saved?.dimensions.lidHMm).toBe(4.3);
  expect(db.devices.filter((d) => d.modelCode === "MBA13-M2").every((d) => d.modelName === "MacBook Air 13 (M2)")).toBe(true);
});

test("없는 기종을 고치러 들어가면 찾을 수 없다는 안내와 목록 링크가 보인다", async () => {
  renderAsAdmin("/admin/models/NOPE-1");
  expect(await screen.findByRole("alert")).toHaveTextContent("찾는 항목이 없습니다");
  expect(screen.getByRole("link", { name: "기종 목록으로" })).toBeInTheDocument();
});

test("치수가 비거나 0 이하, 코드 형식이 틀리면 칸마다 이유가 보이고 보내지 않는다", () => {
  const { body, errors } = toRequest({
    modelCode: "a",
    name: " ",
    manufacturer: "",
    formFactor: "CLAMSHELL",
    cpu: "",
    ramGb: "1.5",
    ssdGb: "",
    widthMm: "0",
    depthMm: "",
    baseHMm: "-1",
    lidHMm: "abc",
  });
  expect(body).toBeUndefined();
  expect(Object.keys(errors).sort()).toEqual(["baseHMm", "depthMm", "lidHMm", "modelCode", "name", "ramGb", "widthMm"]);
});

test("사양을 비우면 spec 없이, 제조사를 비우면 manufacturer 없이 보낸다", () => {
  const { body } = toRequest({
    modelCode: "X1-2",
    name: "X",
    manufacturer: "",
    formFactor: "CLAMSHELL",
    cpu: "",
    ramGb: "",
    ssdGb: "",
    widthMm: "300",
    depthMm: "200",
    baseHMm: "10",
    lidHMm: "5",
  });
  expect(body).toEqual({ name: "X", formFactor: "CLAMSHELL", dimensions: { widthMm: 300, depthMm: 200, baseHMm: 10, lidHMm: 5 } });
});
