import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind 클래스 합치기(shadcn/ui 기본 도우미). 뒤에 온 값이 앞 값을 이긴다 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
