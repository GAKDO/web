import { http, HttpResponse } from "msw";
import type { ChatMessage, ChatResponse } from "../../api/types";
import { problem } from "./problem";

// 사이트 도우미 챗봇 목(contracts chat-server.yaml). 질문 글로 경우를 고른다
export const CHAT_TRIGGERS = { rateLimited: "너무 많이", dailyLimited: "하루 한도", serverError: "고장" } as const;

export const chatHandlers = [
  http.post("*/api/v1/chat", async ({ request }) => {
    const body = (await request.json()) as { messages: ChatMessage[] };
    const last = body.messages[body.messages.length - 1]?.content ?? "";
    if (last.includes(CHAT_TRIGGERS.rateLimited)) return problem(429, "RATE_LIMITED", "요청 제한");
    if (last.includes(CHAT_TRIGGERS.dailyLimited)) {
      return problem(429, "RATE_LIMITED", "오늘 질문 한도를 넘었습니다", "오늘 질문할 수 있는 횟수를 다 썼어요. 내일 다시 물어봐 주세요.");
    }
    if (last.includes(CHAT_TRIGGERS.serverError)) return problem(503, "INTERNAL_ERROR", "두 모델 모두 실패");
    const loggedIn = request.headers.get("Authorization") !== null;
    const reply: ChatResponse = {
      reply: `${loggedIn ? "[로그인] " : ""}대화 ${body.messages.length}개를 받았어요. 질문: ${last}`,
      provider: "gemini",
    };
    return HttpResponse.json(reply);
  }),
];
