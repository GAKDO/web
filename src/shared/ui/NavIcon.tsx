/** 왼쪽 메뉴 아이콘(장식). 글자 메뉴가 뜻을 전하므로 화면 읽기에서는 숨긴다 */
const PATHS = {
  inspections: "M9 3h6l1 2h3v16H5V5h3zM9 12l2 2 4-4",
  devices: "M4 5h16v11H4zM2 19h20",
  models: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  rentals: "M6 3h9l4 4v14H6zM9 12h7M9 16h7",
  logout: "M10 4H5v16h5M14 8l4 4-4 4M18 12H9",
} as const;

export type NavIconName = keyof typeof PATHS;

export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
