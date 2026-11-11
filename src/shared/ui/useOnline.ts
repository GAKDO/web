import { useEffect, useState } from "react";

/**
 * 브라우저가 인터넷에 연결돼 있는지(11/11, 1팀 앱의 연결 끊김 막대에서 아이디어).
 * navigator.onLine은 "확실히 끊김"만 믿을 수 있으므로 끊겼을 때 안내하는 데만 쓴다
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
