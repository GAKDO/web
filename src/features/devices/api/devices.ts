import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "../../../shared/api/client";
import type { DeviceCreateRequest, DeviceStatus, DeviceUpdateRequest } from "../../../shared/api/types";

export interface DeviceFilters {
  modelCode?: string;
  status?: DeviceStatus;
  q?: string;
  limit?: number;
}

const DEVICES = ["devices"] as const;

/** 기기 목록. 거르기마다 따로 캐시하고, "다음 쪽"은 커서로 이어 붙인다(FR-010) */
export function useDevices(filters: DeviceFilters) {
  return useInfiniteQuery({
    queryKey: [...DEVICES, filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(api.GET("/api/v1/devices", { params: { query: { ...filters, q: filters.q || undefined, cursor: pageParam } } })),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useDeviceModels() {
  return useQuery({
    queryKey: ["deviceModels"],
    queryFn: () => unwrap(api.GET("/api/v1/device-models")),
    select: (page) => page.items,
  });
}

/** 상태·색상·자산번호·OS 고치기. 성공이든 409든 목록을 다시 읽어 서버 상태를 보인다 */
export function useUpdateDevice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, body }: { deviceId: string; body: DeviceUpdateRequest }) =>
      unwrap(api.PATCH("/api/v1/devices/{deviceId}", { params: { path: { deviceId } }, body })),
    onSettled: () => client.invalidateQueries({ queryKey: DEVICES }),
  });
}

export function useCreateDevice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: DeviceCreateRequest) => unwrap(api.POST("/api/v1/devices", { body })),
    onSuccess: () => client.invalidateQueries({ queryKey: DEVICES }),
  });
}
