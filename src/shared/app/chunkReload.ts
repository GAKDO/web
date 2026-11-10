// 배포 뒤 옛 화면에서 지연 로딩 조각(예: 3D 뷰어 LaptopViewer-<해시>.js)을 부르면 이미 지워져 404가 난다(11/10 원인).
// Vite는 이때 window에 vite:preloadError를 보낸다. 한 번만 새로 고쳐 새 index.html과 새 조각을 받게 한다.
// 새로 고친 뒤에도 실패하면(30초 안 두 번째) 그대로 오류를 던져 화면의 대체 안내(사진 보기)가 보이게 한다.

const KEY = "trace:chunk-reload-at";
const WINDOW_MS = 30_000;

/** 지금 새로 고쳐도 되는지(최근 30초 안에 같은 이유로 새로 고친 적이 없을 때). 저장소를 못 쓰면 고치지 않는다 */
export function shouldReload(now: number, storage: Pick<Storage, "getItem" | "setItem"> | null): boolean {
  if (!storage) return false;
  try {
    const last = Number(storage.getItem(KEY) ?? 0);
    if (now - last < WINDOW_MS) return false;
    storage.setItem(KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

/** 지연 로딩 조각을 못 받은 오류인지(브라우저마다 문구가 다르다) */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS/i.test(message);
}

export function installChunkReload(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("vite:preloadError", (event) => {
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    if (shouldReload(Date.now(), storage)) {
      event.preventDefault();
      window.location.reload();
    }
  });
}
