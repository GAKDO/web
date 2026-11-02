import { act, renderHook } from "@testing-library/react";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckpointMedia } from "../../../shared/api/types";
import { useTextures } from "./useTextures";

type OnLoad = (t: THREE.Texture) => void;
type OnError = (e: unknown) => void;
const calls: { url: string; onLoad: OnLoad; onError: OnError }[] = [];

vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(function (url, onLoad, _progress, onError) {
  calls.push({ url, onLoad: onLoad as OnLoad, onError: onError as OnError });
  return new THREE.Texture();
});

function texture(): THREE.Texture {
  const t = new THREE.Texture();
  t.image = { naturalWidth: 400, naturalHeight: 300 };
  vi.spyOn(t, "dispose");
  return t;
}

function media(checkpointId: string, url: string): CheckpointMedia {
  return { checkpointId, textures: [{ face: "TOP", url }] } as unknown as CheckpointMedia;
}

afterEach(() => {
  calls.length = 0;
});

describe("useTextures", () => {
  it("같은 시점에서 사진 주소가 바뀌면 다시 읽고, 바뀐 텍스처가 오면 이전 것을 해제한다", () => {
    const { result, rerender } = renderHook(({ m }) => useTextures(m), { initialProps: { m: media("cp1", "a") } });
    const first = texture();
    act(() => calls[0].onLoad(first));
    expect(result.current.loaded.TOP?.texture).toBe(first);

    rerender({ m: media("cp1", "b") });
    expect(calls.map((c) => c.url)).toEqual(["a", "b"]);
    // 새 텍스처가 오기 전까지 이전 것을 그대로 보여 준다
    expect(result.current.loaded.TOP?.texture).toBe(first);

    const second = texture();
    act(() => calls[1].onLoad(second));
    expect(result.current.loaded.TOP?.texture).toBe(second);
    expect(first.dispose).toHaveBeenCalled();
  });

  it("읽지 못한 면은 실패 목록에 올리고, 시점이 바뀌면 비운다", () => {
    const { result, rerender } = renderHook(({ m }) => useTextures(m), { initialProps: { m: media("cp1", "a") } });
    act(() => calls[0].onError(new Error("403")));
    expect(result.current.failed).toEqual(["TOP"]);

    rerender({ m: media("cp2", "c") });
    expect(result.current.failed).toEqual([]);
    expect(result.current.loaded).toEqual({});
  });

  it("다른 시점으로 넘어간 뒤 늦게 온 텍스처는 쓰지 않고 해제한다", () => {
    const { result, rerender, unmount } = renderHook(({ m }) => useTextures(m), { initialProps: { m: media("cp1", "a") } });
    rerender({ m: media("cp2", "c") });
    const late = texture();
    act(() => calls[0].onLoad(late));
    expect(result.current.loaded.TOP).toBeUndefined();
    expect(late.dispose).toHaveBeenCalled();

    const current = texture();
    act(() => calls[1].onLoad(current));
    unmount();
    expect(current.dispose).toHaveBeenCalled();
  });
});
