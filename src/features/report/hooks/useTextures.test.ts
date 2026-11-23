// 이 파일이 확인하는 것: 3D 리포트에서 노트북 모형의 각 면(윗면 등)에 사진을 입히는 기능(useTextures).
// 사진(텍스처)을 다시 읽거나 버릴 때 메모리를 제대로 풀어 주는지, 못 읽은 면을 알려 주는지 본다.
// 실제 사진은 읽지 않고, 사진 읽기를 가짜로 바꿔 테스트가 "다 읽혔다/실패했다"를 직접 정한다.

import { act, renderHook } from "@testing-library/react";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckpointMedia } from "../../../shared/api/types";
import { useTextures } from "./useTextures";

type OnLoad = (t: THREE.Texture) => void;
type OnError = (e: unknown) => void;
const calls: { url: string; onLoad: OnLoad; onError: OnError }[] = [];

// 테스트 도구: 3D 라이브러리의 사진 읽기를 가로채, 요청된 주소와 완료·실패 신호를 calls에 모아 둔다.
vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(function (url, onLoad, _progress, onError) {
  calls.push({ url, onLoad: onLoad as OnLoad, onError: onError as OnError });
  return new THREE.Texture();
});

// 테스트 도구: 다 읽힌 가짜 사진(400×300). 해제(dispose)가 불렸는지 셀 수 있게 해 둔다.
function texture(): THREE.Texture {
  const t = new THREE.Texture();
  t.image = { naturalWidth: 400, naturalHeight: 300 };
  vi.spyOn(t, "dispose");
  return t;
}

// 테스트 도구: 한 시점(예: 수령)의 윗면 사진 주소 하나만 담은 가짜 사진 목록.
function media(checkpointId: string, url: string): CheckpointMedia {
  return { checkpointId, textures: [{ face: "TOP", url }] } as unknown as CheckpointMedia;
}

// 테스트 도구: 테스트마다 모아 둔 사진 읽기 요청을 비운다.
afterEach(() => {
  calls.length = 0;
});

describe("useTextures", () => {
  // [상황] 같은 시점인데 사진 주소가 바뀐다(예: 만료된 사진 주소를 새로 받음).
  // [기대] 새 주소로 다시 읽고, 새 사진이 오면 이전 사진을 메모리에서 해제한다.
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

  // [상황] 윗면 사진 읽기가 실패한 뒤, 다른 시점으로 넘어간다.
  // [기대] 윗면이 실패 목록에 오르고(화면에서 "못 불러옴" 안내용), 시점이 바뀌면 목록이 비워진다.
  it("읽지 못한 면은 실패 목록에 올리고, 시점이 바뀌면 비운다", () => {
    const { result, rerender } = renderHook(({ m }) => useTextures(m), { initialProps: { m: media("cp1", "a") } });
    act(() => calls[0].onError(new Error("403")));
    expect(result.current.failed).toEqual(["TOP"]);

    rerender({ m: media("cp2", "c") });
    expect(result.current.failed).toEqual([]);
    expect(result.current.loaded).toEqual({});
  });

  // [상황] 수령 시점 사진을 읽는 중에 반납 시점으로 넘어갔고, 그 뒤에 수령 사진이 늦게 도착한다.
  // [기대] 늦게 온 사진은 모형에 입히지 않고 바로 해제한다. 화면을 닫을 때도 쓰던 사진을 해제한다.
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
