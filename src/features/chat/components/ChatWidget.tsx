import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { MessageCircle, MoveDiagonal, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "../../../shared/api/client";
import { useAuth } from "../../../shared/auth/AuthProvider";
import type { ChatMessage } from "../../../shared/api/types";
import { askChat, MAX_CONTENT } from "../api/askChat";
import { useChatSize } from "../hooks/useChatSize";

/** 관리자·부스 태블릿·폰 촬영 화면에는 띄우지 않는다(작업 화면을 가리지 않게) */
const HIDDEN_PREFIXES = ["/admin", "/booth", "/capture"];

const GREETING = "안녕하세요, TRACE 도우미예요. 이용 순서, 등급 기준, 내 렌탈 검사 결과 같은 걸 물어보세요.";
const SUGGESTIONS = ["노트북은 어떻게 빌려요?", "등급 기준이 뭐예요?", "내 렌탈 검사 결과 알려 줘"];

/** 크기 조절 손잡이를 키보드 화살표로 움직일 때 한 번에 바뀌는 픽셀 */
const RESIZE_STEP = 32;

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return "서버에 닿지 못했어요. 인터넷 연결을 확인하고 다시 보내 주세요.";
    if (error.code === "RATE_LIMITED") {
      // 하루 상한(IP당·서비스 전체)은 서버가 "내일 다시" 안내 문구를 detail로 준다. 일반 글로만 보인다
      if (error.detail?.includes("내일")) return error.detail;
      return "질문이 너무 잦아요. 1분 뒤 다시 보내 주세요.";
    }
    if (error.code === "VALIDATION_FAILED") return `질문은 ${MAX_CONTENT}자까지 보낼 수 있어요.`;
  }
  return "지금은 답할 수 없어요. 잠시 뒤 다시 보내 주세요.";
}

/**
 * 모든 고객 화면 오른쪽 아래의 사이트 도우미(11/10). 대화는 이 컴포넌트 메모리에만 두고 저장하지 않는다
 * (새로 고치면 사라짐). 답은 일반 글로 보이고, 링크·HTML로 해석하지 않는다
 */
export function ChatWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const list = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const { size, setPanel, resetPanel } = useChatSize();
  const drag = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  // 로그인·로그아웃으로 세션이 바뀌면(로그아웃 없이 다른 계정으로 로그인해도) 대화를 비운다. 앞 계정의 내 렌탈 답이
  // 다음 사람에게 보이거나 다음 요청에 섞여 가지 않게 하고, 바뀌기 전에 보낸 요청의 답은 세대 번호로 버린다
  const { status, sessionId } = useAuth();
  const session = status === "unknown" ? null : `${status}:${sessionId}`;
  const lastSession = useRef(session);
  const generation = useRef(0);

  const ask = useMutation({
    mutationFn: async ({ history, gen }: { history: ChatMessage[]; gen: number }) => ({ data: await askChat(history), gen }),
    onSuccess: ({ data, gen }) => {
      if (gen !== generation.current) return;
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: (_error, { history, gen }) => {
      if (gen !== generation.current) return;
      // 실패한 질문은 대화에서 빼고 입력 칸에 돌려놓는다. 다시 보내도 같은 질문이 두 번 쌓이지 않는다
      setMessages(history.slice(0, -1));
      setDraft((d) => d || history[history.length - 1].content);
    },
  });

  useEffect(() => {
    if (session === null) return;
    if (lastSession.current !== null && lastSession.current !== session) {
      generation.current += 1;
      setMessages([]);
      setDraft("");
      ask.reset();
    }
    lastSession.current = session;
    // ask.reset은 렌더마다 새 함수라 세션이 바뀔 때만 돈다
  }, [session]);

  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView?.({ block: "end" });
  }, [messages, ask.isPending, ask.isError]);

  // 열면 입력 칸으로, 닫으면(여는 버튼이 다시 그려진 뒤) 여는 버튼으로 초점을 옮긴다
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) input.current?.focus();
    else if (wasOpen.current) opener.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  function send(text: string) {
    const content = text.trim().slice(0, MAX_CONTENT);
    if (!content || ask.isPending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    ask.mutate({ history: next, gen: generation.current });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter는 보내기, Shift+Enter는 줄바꿈. 한글 조합 중 Enter는 글자 확정이므로 보내지 않는다
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  }

  function close() {
    setOpen(false);
  }

  // 방침 화면으로 갈 때는 창만 접고, 초점을 여는 버튼으로 되돌리지 않는다(새 화면 본문을 읽게)
  function leaveToPrivacy() {
    wasOpen.current = false;
    setOpen(false);
  }
  // 창은 오른쪽 아래에 붙어 있으므로 왼쪽 위 손잡이를 왼쪽·위로 끌면 커진다
  function onResizeStart(e: PointerEvent<HTMLButtonElement>) {
    if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height };
  }
  function onResizeMove(e: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    setPanel(start.width + (start.x - e.clientX), start.height + (start.y - e.clientY));
  }
  function onResizeEnd() {
    drag.current = null;
  }
  function onResizeKey(e: KeyboardEvent<HTMLButtonElement>) {
    // Home은 처음 크기로(방향키와 겹치지 않는 키. 손잡이를 두 번 누르는 것과 같다)
    if (e.key === "Home") {
      e.preventDefault();
      resetPanel();
      return;
    }
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [RESIZE_STEP, 0],
      ArrowRight: [-RESIZE_STEP, 0],
      ArrowUp: [0, RESIZE_STEP],
      ArrowDown: [0, -RESIZE_STEP],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    setPanel(size.width + d[0], size.height + d[1]);
  }

  if (!open) {
    return (
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="TRACE 도우미 열기"
        className="fixed right-4 bottom-4 z-40 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <MessageCircle aria-hidden="true" className="size-6" />
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="TRACE 도우미"
      onKeyDown={(e) => e.key === "Escape" && close()}
      style={{ "--chat-w": `${size.width}px`, "--chat-h": `${size.height}px` } as CSSProperties}
      className="fixed inset-x-4 bottom-4 z-40 flex h-[min(var(--chat-h),calc(100svh-2rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[min(var(--chat-w),calc(100vw-2rem))]"
    >
      <button
        type="button"
        aria-label="창 크기 조절"
        title="끌어서(또는 방향키로) 창 크기를 바꿔요. 두 번 누르거나 Home 키를 누르면 처음 크기로 돌아가요"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        onKeyDown={onResizeKey}
        onDoubleClick={resetPanel}
        className="tap-target tap-inward absolute top-0 left-0 z-10 flex size-6 cursor-nwse-resize touch-none items-center justify-center rounded-br-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <MoveDiagonal aria-hidden="true" className="size-3.5" />
      </button>
      <header className="flex items-center justify-between gap-2 border-b py-3 pr-4 pl-7">
        <div>
          <h2 className="text-sm font-semibold">TRACE 도우미</h2>
          <p className="text-xs text-muted-foreground">
            AI(Google Gemini)가 답해요. 정확하지 않을 수 있어요.{" "}
            <Link to="/privacy" onClick={leaveToPrivacy} className="underline underline-offset-2 hover:text-foreground">
              개인정보처리방침
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={close} aria-label="도우미 닫기" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      </header>

      <ol ref={list} aria-label="대화" aria-live="polite" className="flex min-h-48 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3 text-sm">
        <li className="max-w-[85%] self-start rounded-2xl rounded-bl-sm bg-muted px-3 py-2 whitespace-pre-wrap">{GREETING}</li>
        {messages.map((m, i) => (
          <li
            key={i}
            className={
              m.role === "user"
                ? "max-w-[85%] self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 whitespace-pre-wrap text-primary-foreground"
                : "max-w-[85%] self-start rounded-2xl rounded-bl-sm bg-muted px-3 py-2 whitespace-pre-wrap"
            }
          >
            <span className="sr-only">{m.role === "user" ? "나: " : "도우미: "}</span>
            {m.content}
          </li>
        ))}
        {ask.isPending && (
          <li className="self-start rounded-2xl bg-muted px-3 py-2 text-muted-foreground">답을 쓰는 중…</li>
        )}
        {ask.isError && !ask.isPending && (
          <li role="alert" className="self-start rounded-2xl border border-destructive/40 px-3 py-2 text-destructive">
            {errorText(ask.error)}
          </li>
        )}
      </ol>

      {messages.length === 0 && (
        <ul aria-label="이런 걸 물어보세요" className="flex flex-wrap gap-2 px-4 pb-2">
          {SUGGESTIONS.map((q) => (
            <li key={q}>
              <button type="button" onClick={() => send(q)} className="rounded-full border px-3 py-1 text-xs hover:bg-muted">
                {q}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2 border-t p-3">
        <p id="chat-privacy" className="w-full text-xs text-muted-foreground">
          개인정보(이름·전화번호·주소·계좌 등)는 입력하지 마세요.
        </p>
        <label htmlFor="chat-input" className="sr-only">
          질문
        </label>
        <textarea
          id="chat-input"
          ref={input}
          rows={1}
          value={draft}
          maxLength={MAX_CONTENT}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="궁금한 걸 적어 주세요"
          aria-describedby="chat-privacy"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-base sm:text-sm"
        />
        <Button type="submit" size="icon" aria-label="보내기" disabled={!draft.trim() || ask.isPending}>
          <SendHorizontal aria-hidden="true" className="size-4" />
        </Button>
      </form>
    </section>
  );
}
