// 이 파일이 확인하는 것: 관리 화면의 기종 관리. 기종(예: MacBook Air M2)마다 크기(가로·세로·본체·덮개 두께)와 기준 사양을 등록하고 고친다.
// 크기는 3D 리포트 모형과 흠집 길이(mm) 계산에 쓰인다.

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAsAdmin } from "../../test/renderApp";
import { db } from "../../shared/mocks/db";
import { toRequest } from "./components/ModelEditPage";

// [상황] 관리 메뉴에서 "기종"을 누른다.
// [기대] 기종 목록에 등록된 기종 3개가 모두 보인다.
test("관리 메뉴의 기종을 누르면 등록된 기종이 모두 보인다", async () => {
  const user = userEvent.setup();
  renderAsAdmin("/admin/devices");
  await user.click(await screen.findByRole("link", { name: "기종" }));
  expect(await screen.findByRole("heading", { name: "기종 목록" })).toBeInTheDocument();
  for (const code of ["MBA13-M2", "MBP14-M3", "LG-GRAM16"]) {
    expect(await screen.findByRole("listitem", { name: code })).toBeInTheDocument();
  }
});

// 테스트 도구: 가로·세로·본체 두께·덮개 두께 칸에 값을 넣는다.
async function fillDims(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("가로(mm)"), "357.7");
  await user.type(screen.getByLabelText("세로(mm)"), "248.2");
  await user.type(screen.getByLabelText("본체 두께(mm)"), "10.5");
  await user.type(screen.getByLabelText("덮개 두께(mm)"), "6.4");
}

// [상황] 기종 코드를 소문자(mba15-m3)로, 이름·제조사·크기·메모리 16GB를 넣어 등록한다.
// [기대] 코드는 대문자로 바뀌어 목록에 보이고 "기종을 등록했습니다."가 뜬다. 크기·사양이 저장되고, 기기 등록 화면의 기종 목록에도 나온다.
test("새 기종을 등록하면 목록에 보이고 기기 등록 화면에서 고를 수 있다", async () => {
  const user = userEvent.setup();
  const { router } = renderAsAdmin("/admin/models/new");
  await screen.findByRole("heading", { name: "기종 등록" });
  await user.type(screen.getByLabelText("기종 코드"), "mba15-m3");
  await user.type(screen.getByLabelText("이름"), "MacBook Air 15 (M3, 2024)");
  await user.type(screen.getByLabelText("제조사(선택)"), "Apple");
  await fillDims(user);
  await user.type(screen.getByLabelText("메모리(GB)"), "16");
  await user.click(screen.getByRole("button", { name: "등록" }));

  expect(await screen.findByRole("listitem", { name: "MBA15-M3" })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/admin/models");
  expect(screen.getByRole("status")).toHaveTextContent("기종을 등록했습니다.");
  const saved = db.models.find((m) => m.modelCode === "MBA15-M3");
  expect(saved?.dimensions).toEqual({ widthMm: 357.7, depthMm: 248.2, baseHMm: 10.5, lidHMm: 6.4 });
  expect(saved?.spec).toEqual({ ramGb: 16 });

  await router.navigate("/admin/devices/new");
  expect(await screen.findByRole("option", { name: "MacBook Air 15 (M3, 2024)" })).toBeInTheDocument();
});

// [상황] 이미 있는 기종 코드(MBA13-M2)로 다른 이름을 넣어 새로 등록한다.
// [기대] 덮어쓰지 않고 "이미 있는 기종 코드입니다. 기종 목록에서 수정을 눌러 주세요."가 보이며, 원래 이름이 그대로다.
test("이미 있는 기종 코드로 새로 등록하면 덮어쓰지 않고 고치기로 안내한다", async () => {
  const user = userEvent.setup();
  renderAsAdmin("/admin/models/new");
  await screen.findByRole("heading", { name: "기종 등록" });
  await user.type(screen.getByLabelText("기종 코드"), "MBA13-M2");
  await user.type(screen.getByLabelText("이름"), "덮어쓰기");
  await fillDims(user);
  await waitFor(() => expect(screen.getByRole("button", { name: "등록" })).toBeEnabled());
  await user.click(screen.getByRole("button", { name: "등록" }));
  expect(await screen.findByText("이미 있는 기종 코드입니다. 기종 목록에서 수정을 눌러 주세요.")).toBeInTheDocument();
  expect(db.models.find((m) => m.modelCode === "MBA13-M2")?.name).toBe("MacBook Air (M2, 2022)");
});

// [상황] MBA13-M2 기종 수정 화면에서 덮개 두께와 이름을 바꿔 저장한다.
// [기대] 지금 값이 미리 채워져 있고 코드는 고칠 수 없다. 저장하면 목록으로 돌아가 "기종을 수정했습니다."가 뜨고,
//        그 기종의 기기들 이름도 새 이름으로 바뀐다.
test("기종을 고치면 지금 값이 채워져 있고, 바꾼 치수와 이름이 저장되며 기기 목록 이름도 바뀐다", async () => {
  const user = userEvent.setup();
  const { router } = renderAsAdmin("/admin/models/MBA13-M2/edit");
  await screen.findByRole("heading", { name: "기종 수정" });
  expect(await screen.findByDisplayValue("MacBook Air (M2, 2022)")).toBeInTheDocument();
  expect(screen.getByLabelText("기종 코드")).toHaveAttribute("readonly");
  const lid = screen.getByLabelText("덮개 두께(mm)");
  await user.clear(lid);
  await user.type(lid, "4.3");
  const name = screen.getByLabelText("이름");
  await user.clear(name);
  await user.type(name, "MacBook Air 13 (M2)");
  await user.click(screen.getByRole("button", { name: "수정 저장" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/admin/models"));
  expect(await screen.findByRole("status")).toHaveTextContent("기종을 수정했습니다.");
  const saved = db.models.find((m) => m.modelCode === "MBA13-M2");
  expect(saved?.dimensions.lidHMm).toBe(4.3);
  expect(db.devices.filter((d) => d.modelCode === "MBA13-M2").every((d) => d.modelName === "MacBook Air 13 (M2)")).toBe(true);
});

// [상황] 기종 코드가 하필 "NEW"인 기종의 수정 화면을 연다.
// [기대] 새 기종 등록 화면과 헷갈리지 않고 그 기종의 수정 화면이 열린다.
test("기종 코드가 NEW여도 고치기 화면이 열린다(새로 등록 경로와 겹치지 않음)", async () => {
  db.models.push({ ...db.models[0], modelCode: "NEW", name: "새 기종 코드" });
  renderAsAdmin("/admin/models/NEW/edit");
  expect(await screen.findByRole("heading", { name: "기종 수정" })).toBeInTheDocument();
  expect(await screen.findByDisplayValue("새 기종 코드")).toBeInTheDocument();
});

// [상황] 없는 기종의 수정 주소를 연다.
// [기대] "찾는 항목이 없습니다"와 "기종 목록으로" 링크가 보인다.
test("없는 기종을 고치러 들어가면 찾을 수 없다는 안내와 목록 링크가 보인다", async () => {
  renderAsAdmin("/admin/models/NOPE-1/edit");
  expect(await screen.findByRole("alert")).toHaveTextContent("찾는 항목이 없습니다");
  expect(screen.getByRole("link", { name: "기종 목록으로" })).toBeInTheDocument();
});

// [상황] 코드 형식이 틀리고(한 글자), 이름이 빈칸, 메모리가 소수, 크기가 0·빈 값·음수·글자인 입력을 서버로 보낼 모양으로 바꾼다.
// [기대] 보낼 내용을 만들지 않고, 틀린 칸마다(코드·이름·메모리·가로·세로·본체·덮개) 이유를 단다.
test("치수가 비거나 0 이하, 코드 형식이 틀리면 칸마다 이유가 보이고 보내지 않는다", () => {
  const { body, errors } = toRequest({
    modelCode: "a",
    name: " ",
    manufacturer: "",
    formFactor: "CLAMSHELL",
    cpu: "",
    ramGb: "1.5",
    ssdGb: "",
    gpu: "",
    widthMm: "0",
    depthMm: "",
    baseHMm: "-1",
    lidHMm: "abc",
  });
  expect(body).toBeUndefined();
  expect(Object.keys(errors).sort()).toEqual(["baseHMm", "depthMm", "lidHMm", "modelCode", "name", "ramGb", "widthMm"]);
});

// [상황] 사양과 제조사를 모두 비운 입력을 바꾼다.
// [기대] 사양(spec)과 제조사 칸 없이 이름·형태·크기만 보낸다.
test("사양을 비우면 spec 없이, 제조사를 비우면 manufacturer 없이 보낸다", () => {
  const { body } = toRequest({
    modelCode: "X1-2",
    name: "X",
    manufacturer: "",
    formFactor: "CLAMSHELL",
    cpu: "",
    ramGb: "",
    ssdGb: "",
    gpu: "",
    widthMm: "300",
    depthMm: "200",
    baseHMm: "10",
    lidHMm: "5",
  });
  expect(body).toEqual({ name: "X", formFactor: "CLAMSHELL", dimensions: { widthMm: 300, depthMm: 200, baseHMm: 10, lidHMm: 5 } });
});

// [상황] 기종 목록을 보고, "메모리 큰 순"으로 정렬한 뒤, "arc"와 없는 이름으로 차례로 검색한다.
// [기대] LG gram 줄에 CPU·16GB·512GB·GPU가 보인다. 정렬은 16GB → 8GB → 사양 없음(맨 뒤) 순서, "arc" 검색은 GPU 이름으로 LG gram만,
//        없는 이름은 "검색어에 맞는 기종이 없습니다."가 된다.
test("기종 목록에 기준 사양(CPU·메모리·저장 공간·GPU)이 보이고, 검색과 정렬이 된다", async () => {
  const user = userEvent.setup();
  renderAsAdmin("/admin/models");
  const gram = await screen.findByRole("listitem", { name: "LG-GRAM16" });
  expect(gram).toHaveTextContent("Intel Core Ultra 7 155H");
  expect(gram).toHaveTextContent("16GB");
  expect(gram).toHaveTextContent("512GB");
  expect(gram).toHaveTextContent("Intel Arc Graphics");

  await user.selectOptions(screen.getByLabelText("정렬"), "메모리 큰 순");
  const codes = () => screen.getAllByRole("listitem").map((li) => li.getAttribute("aria-label"));
  // 메모리 16GB → 8GB → 사양 없음(맨 뒤)
  expect(codes()).toEqual(["LG-GRAM16", "MBA13-M2", "MBP14-M3"]);

  await user.type(screen.getByLabelText("검색"), "arc");
  expect(codes()).toEqual(["LG-GRAM16"]);
  await user.clear(screen.getByLabelText("검색"));
  await user.type(screen.getByLabelText("검색"), "없는기종");
  expect(screen.getByText("검색어에 맞는 기종이 없습니다.")).toBeInTheDocument();
});

// [상황] CPU와 앞뒤 빈칸이 있는 GPU 이름을 넣은 Windows 노트북 입력을 바꾼다.
// [기대] 사양에 CPU와 빈칸을 뗀 GPU 이름이 저장된다.
test("Windows 노트북은 기준 사양에 GPU를 적어 저장할 수 있다", () => {
  const { body } = toRequest({
    modelCode: "GRAM16-RTX",
    name: "Windows 노트북",
    manufacturer: "",
    formFactor: "CLAMSHELL",
    cpu: "Intel Core i7",
    ramGb: "",
    ssdGb: "",
    gpu: " NVIDIA GeForce RTX 4060 Laptop ",
    widthMm: "357",
    depthMm: "250",
    baseHMm: "12",
    lidHMm: "5",
  });
  expect(body?.spec).toEqual({ cpu: "Intel Core i7", gpu: "NVIDIA GeForce RTX 4060 Laptop" });
});
