import type { DeviceModelSummary } from "../../../shared/api/types";

/**
 * 기종 목록 정렬 기준. 기종 수가 적어(서버가 전부 줌) 화면에서 거르고 정렬한다.
 * 진단 등급·벤치마크 열은 diagnostics-server를 다시 켤 때(11/10 이후) 여기에 키를 더한다
 */
export type ModelSort = "name" | "modelCode" | "manufacturer" | "ramDesc" | "ssdDesc";

export const MODEL_SORT_LABEL: Record<ModelSort, string> = {
  name: "이름순",
  modelCode: "기종 코드순",
  manufacturer: "제조사순",
  ramDesc: "메모리 큰 순",
  ssdDesc: "저장 공간 큰 순",
};

const collator = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

/** 이름·코드·제조사·CPU·GPU 어디에든 검색어가 들어 있으면 남긴다(대소문자 무시) */
export function matchesModel(m: DeviceModelSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [m.name, m.modelCode, m.manufacturer, m.spec?.cpu, m.spec?.gpu].some((v) => !!v && v.toLowerCase().includes(q));
}

/** 숫자 정렬은 값이 없는 기종을 맨 뒤로, 같으면 이름순 */
function byNumberDesc(a: number | undefined, b: number | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return b - a;
}

export function sortModels(models: readonly DeviceModelSummary[], sort: ModelSort): DeviceModelSummary[] {
  const byName = (a: DeviceModelSummary, b: DeviceModelSummary) => collator.compare(a.name, b.name);
  const compare: Record<ModelSort, (a: DeviceModelSummary, b: DeviceModelSummary) => number> = {
    name: byName,
    modelCode: (a, b) => collator.compare(a.modelCode, b.modelCode),
    manufacturer: (a, b) => {
      // 제조사가 없는 기종은 맨 뒤
      if (!a.manufacturer !== !b.manufacturer) return a.manufacturer ? -1 : 1;
      return collator.compare(a.manufacturer ?? "", b.manufacturer ?? "") || byName(a, b);
    },
    ramDesc: (a, b) => byNumberDesc(a.spec?.ramGb, b.spec?.ramGb) || byName(a, b),
    ssdDesc: (a, b) => byNumberDesc(a.spec?.ssdGb, b.spec?.ssdGb) || byName(a, b),
  };
  return [...models].sort(compare[sort]);
}

/** 용량 표시: 1024GB 이상은 TB로 */
export function formatGb(gb: number | undefined): string {
  if (gb === undefined) return "-";
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024}TB` : `${gb}GB`;
}
