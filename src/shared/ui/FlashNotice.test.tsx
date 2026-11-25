// 이 파일이 확인하는 것: 저장 뒤 화면 위에 잠깐 뜨는 알림("저장했습니다.")이 한 번만 보이게 하는 동작.

import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { FlashNotice } from "./FlashNotice";

// 테스트 도구: 지금 화면 기록(state)을 글자로 보여 주는 빈 화면.
function Page() {
  const location = useLocation();
  return <p>state: {JSON.stringify(location.state)}</p>;
}

// 테스트 도구: 알림 부품과 빈 화면을 /a 주소로 연다.
function setup() {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <>
            <FlashNotice />
            <Page />
          </>
        ),
      },
    ],
    { initialEntries: ["/a"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

// [상황] 다른 화면으로 옮기면서 알림("저장했습니다.")과 다른 정보(시리얼)를 함께 넘긴다.
// [기대] 알림이 보이고, 화면 기록에서는 알림만 지워 시리얼은 남긴다(뒤로 가기·새로 고침 때 알림이 다시 뜨지 않게).
test("알림을 보여 주고 기록에서는 notice만 지워 다른 state(serial)는 남긴다", async () => {
  const router = setup();
  await act(() => router.navigate("/b", { state: { serial: "SN-1", notice: "저장했습니다." } }));
  expect(screen.getByRole("status")).toHaveTextContent("저장했습니다.");
  expect(router.state.location.state).toEqual({ serial: "SN-1" });
});

// [상황] 알림이 떠 있는 동안 또 다른 화면으로 옮긴다.
// [기대] 알림이 바로 닫힌다.
test("알림이 떠 있는 동안 다른 화면으로 옮기면 바로 닫힌다", async () => {
  const router = setup();
  await act(() => router.navigate("/b", { state: { notice: "저장했습니다." } }));
  expect(screen.getByRole("status")).toBeInTheDocument();
  await act(() => router.navigate("/c"));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
