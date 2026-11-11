// 보관 기능의 화면 주소. MVP 배포(VITE_ARCHIVED_FEATURES)에서 숨긴 기능은 주소를 직접 쳐도 첫 화면으로 돌려보낸다
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isArchived, type ArchivableFeature } from "./features";

interface ArchivedRouteProps {
  /** 이 중 하나라도 보관 중이 아니면 화면을 연다 */
  features: ArchivableFeature[];
  children: ReactNode;
}

/** 넘긴 기능이 모두 보관 중이면 첫 화면으로 보낸다. 비어 있는 개발·테스트 기본값에서는 그대로 연다 */
export function ArchivedRoute({ features, children }: ArchivedRouteProps) {
  if (features.every((f) => isArchived(f))) return <Navigate to="/" replace />;
  return <>{children}</>;
}
