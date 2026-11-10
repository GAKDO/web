import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../../shared/api/client";
import type { DeviceModelUpsertRequest } from "../../../shared/api/types";

// 기종 등록·수정(FR-RNT-03). 목록은 기기 화면과 같은 캐시(["deviceModels"])를 쓴다
const MODELS = ["deviceModels"] as const;

/** 기종 하나(치수·사양). 고치기 화면에서 채워 넣을 값 */
export function useDeviceModel(modelCode: string | undefined) {
  return useQuery({
    queryKey: [...MODELS, "one", modelCode],
    queryFn: () => unwrap(api.GET("/api/v1/device-models/{modelCode}", { params: { path: { modelCode: modelCode ?? "" } } })),
    enabled: !!modelCode,
  });
}

/** PUT은 없으면 만들고 있으면 바꾼다. 저장하면 목록·기기 화면의 기종 이름도 다시 읽는다 */
export function useUpsertDeviceModel() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ modelCode, body }: { modelCode: string; body: DeviceModelUpsertRequest }) =>
      unwrap(api.PUT("/api/v1/device-models/{modelCode}", { params: { path: { modelCode } }, body })),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: MODELS });
      void client.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}

/** 기종 지우기(11/10). 이 기종으로 등록된 기기가 있으면 409 DEVICE_MODEL_IN_USE */
export function useDeleteDeviceModel() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (modelCode: string) => unwrap(api.DELETE("/api/v1/device-models/{modelCode}", { params: { path: { modelCode } } })),
    onSuccess: () => void client.invalidateQueries({ queryKey: MODELS }),
  });
}
