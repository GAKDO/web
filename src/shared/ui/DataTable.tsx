import type { CSSProperties, ReactNode } from "react";

interface DataTableProps {
  /** 열 너비(grid-template-columns). 머리 줄과 각 카드가 같은 값을 쓴다 */
  cols: string;
  /** 머리 줄 글자. 빈 글자는 버튼 칸 */
  labels: string[];
  /** 안에 넣는 `<ul className="cards table-list">` */
  children: ReactNode;
}

/**
 * 목록 카드를 1100px 이상에서 표처럼 보이게 하는 틀(11/4 목업).
 * 목록(ul·li) 구조는 그대로 두고 CSS만 바꾼다. 머리 줄은 보이는 글자만이라 화면 읽기에서는 숨긴다
 */
export function DataTable({ cols, labels, children }: DataTableProps) {
  return (
    <div className="table" style={{ "--cols": cols } as CSSProperties}>
      <div className="table-head" aria-hidden="true">
        {labels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
      {children}
    </div>
  );
}
