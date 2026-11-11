import type { CameraFailure } from "../camera";
import { Button } from "../../../shared/ui/Button";

/** 카메라를 켜지 못했을 때 이유와 다시 허용하는 방법(US3-6, FR-013) */
export function CameraHelp({ kind, onRetry }: { kind: CameraFailure; onRetry(): void }) {
  return (
    <section className="card" role="alert">
      {kind === "denied" && (
        <>
          <strong>사진을 찍으려면 카메라 권한이 필요합니다.</strong>
          <p>노트북 상태를 기록하려고 카메라를 씁니다. 사진은 이 렌탈 기록에만 쓰입니다.</p>
          <ul>
            <li>iPhone(Safari): 주소창 왼쪽 <b>가가</b> 버튼 → 웹 사이트 설정 → 카메라 → 허용</li>
            <li>Android(Chrome): 주소창 왼쪽 자물쇠 아이콘 → 권한 → 카메라 → 허용</li>
          </ul>
        </>
      )}
      {kind === "none" && <strong>카메라를 찾지 못했습니다. 후면 카메라가 있는 폰으로 열어 주세요.</strong>}
      {kind === "failed" && <strong>카메라를 켜지 못했습니다. 다른 앱이 카메라를 쓰고 있는지 확인해 주세요.</strong>}
      <Button onClick={onRetry}>다시 시도</Button>
    </section>
  );
}
