import { useQuery } from "@tanstack/react-query";
import { publicApi, unwrap } from "../../../shared/api/client";

/** 계약 report-server.yaml verifyToken 형식(32자 소문자 16진수) */
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export function isVerifyToken(token: string | undefined): token is string {
  return token !== undefined && TOKEN_PATTERN.test(token);
}

/** 공개 검증. 형식이 틀린 토큰은 서버를 부르지 않는다(FR-006) */
export function useVerify(token: string | undefined) {
  return useQuery({
    queryKey: ["verify", token],
    enabled: isVerifyToken(token),
    queryFn: () =>
      unwrap(publicApi.GET("/api/v1/verify/{verifyToken}", { params: { path: { verifyToken: token ?? "" } } })),
  });
}
