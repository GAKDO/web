import { api, unwrap } from "../../../shared/api/client";
import type { ChatMessage, ChatResponse } from "../../../shared/api/types";

/** 서버가 받는 최대 길이(contracts chat-server.yaml): 메시지 40개, 한 메시지 2000자 */
export const MAX_MESSAGES = 40;
export const MAX_CONTENT = 2000;

/**
 * 챗봇에 지금까지의 대화를 보내고 답을 받는다. 로그인해 있으면 공용 클라이언트가 토큰을 붙여
 * 챗봇이 내 렌탈·검사 결과도 읽어 답한다(읽기만 함). 로그인하지 않았으면 사이트 안내만 답한다
 */
export function askChat(messages: ChatMessage[]): Promise<ChatResponse> {
  return unwrap(api.POST("/api/v1/chat", { body: { messages: messages.slice(-MAX_MESSAGES) } }));
}
