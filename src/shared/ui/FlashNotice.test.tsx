import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { FlashNotice } from "./FlashNotice";

function Page() {
  const location = useLocation();
  return <p>state: {JSON.stringify(location.state)}</p>;
}

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

test("알림을 보여 주고 기록에서는 notice만 지워 다른 state(serial)는 남긴다", async () => {
  const router = setup();
  await act(() => router.navigate("/b", { state: { serial: "SN-1", notice: "저장했습니다." } }));
  expect(screen.getByRole("status")).toHaveTextContent("저장했습니다.");
  expect(router.state.location.state).toEqual({ serial: "SN-1" });
});

test("알림이 떠 있는 동안 다른 화면으로 옮기면 바로 닫힌다", async () => {
  const router = setup();
  await act(() => router.navigate("/b", { state: { notice: "저장했습니다." } }));
  expect(screen.getByRole("status")).toBeInTheDocument();
  await act(() => router.navigate("/c"));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
