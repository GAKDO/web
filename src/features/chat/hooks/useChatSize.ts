import { useCallback, useEffect, useState } from "react";

/** 도우미 버튼 크기. 사용자가 창 머리에서 고른다 */
export type ButtonSize = "sm" | "md" | "lg";
export const BUTTON_SIZES: readonly { value: ButtonSize; label: string }[] = [
  { value: "sm", label: "작게" },
  { value: "md", label: "보통" },
  { value: "lg", label: "크게" },
];

export const DEFAULT_PANEL = { width: 384, height: 576 } as const;
export const MIN_PANEL = { width: 320, height: 360 } as const;
/** 화면 가장자리에서 띄울 여백(왼쪽·위 16px씩 + 오른쪽·아래 16px씩) */
const EDGE = 32;

export interface ChatSize {
  button: ButtonSize;
  width: number;
  height: number;
}

const KEY = "trace.chat.size";
const DEFAULT: ChatSize = { button: "md", ...DEFAULT_PANEL };

function viewport() {
  // 테스트(jsdom)처럼 창 크기를 모르면 넉넉하게 본다
  const w = typeof window !== "undefined" && window.innerWidth > 0 ? window.innerWidth : 1280;
  const h = typeof window !== "undefined" && window.innerHeight > 0 ? window.innerHeight : 800;
  return { w, h };
}

/** 최소 크기 이상, 화면 안쪽으로 맞춘다. 화면이 최소보다 작으면 최소를 지킨다(CSS max가 다시 줄임) */
export function clampPanel(width: number, height: number): { width: number; height: number } {
  const { w, h } = viewport();
  const clamp = (v: number, min: number, max: number) => Math.round(Math.min(Math.max(v, min), Math.max(min, max)));
  return { width: clamp(width, MIN_PANEL.width, w - EDGE), height: clamp(height, MIN_PANEL.height, h - EDGE) };
}

function read(): ChatSize {
  // 토큰이 아닌 화면 취향만 저장한다. 사생활 모드 등에서 막히면 기본값으로
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw) as Partial<ChatSize>;
    const button = BUTTON_SIZES.some((b) => b.value === v.button) ? (v.button as ButtonSize) : DEFAULT.button;
    const width = typeof v.width === "number" ? v.width : DEFAULT.width;
    const height = typeof v.height === "number" ? v.height : DEFAULT.height;
    return { button, width, height };
  } catch {
    return DEFAULT;
  }
}

/** 도우미 버튼 크기와 창 크기. 이 브라우저에 기억해 다음에 열어도 그대로다 */
export function useChatSize() {
  const [size, setSize] = useState<ChatSize>(read);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(size));
    } catch {
      // 저장하지 못해도 이번 화면에서는 그대로 쓴다
    }
  }, [size]);

  const setButton = useCallback((button: ButtonSize) => setSize((s) => ({ ...s, button })), []);
  const setPanel = useCallback((width: number, height: number) => setSize((s) => ({ ...s, ...clampPanel(width, height) })), []);
  const resetPanel = useCallback(() => setSize((s) => ({ ...s, ...DEFAULT_PANEL })), []);

  return { size, setButton, setPanel, resetPanel };
}
