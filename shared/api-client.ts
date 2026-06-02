import * as z from "zod";
import { safeValidate } from "./schemas";

export class HttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
    this.name = "HttpError";
  }
}

export interface ApiClientOptions {
  /** API 서버의 기본 URL (예: "/api" 또는 "https://api.fullcount.kr") */
  baseUrl: string;
  /** 요청 타임아웃 (ms). 기본값 8000 */
  timeout?: number;
  /** 에러 발생 시 호출될 콜백. UI 계층에서 toast 등을 표시할 때 사용 */
  onError?: (path: string, error: unknown) => void;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private onError?: (path: string, error: unknown) => void;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeout = options.timeout ?? 8000;
    this.maxRetries = 2;
    this.onError = options.onError;
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof Error && error.name === "AbortError") return false;
    if (error instanceof TypeError) return true; // network error
    // HttpError carries the actual HTTP status code
    if (error instanceof HttpError) {
      // 4xx: don't retry (client error — invalid request or no data)
      if (error.status >= 400 && error.status < 500) return false;
      // 5xx: retry
      return true;
    }
    return false;
  }

  async getWithStatus<T>(path: string): Promise<{ data: T | null; status: number }> {
    const url = `${this.baseUrl}${path}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new HttpError(res.status);
        const json = await res.json();
        return { data: json as T, status: 200 };
      } catch (error) {
        clearTimeout(timer);
        if (attempt < this.maxRetries && this.isRetryable(error)) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        const status = error instanceof HttpError ? error.status : 0;
        this.onError?.(path, error);
        return { data: null, status };
      }
    }
    return { data: null, status: 0 };
  }

  async get<T>(path: string, schema?: z.ZodType<T>): Promise<T | null> {
    const url = `${this.baseUrl}${path}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new HttpError(res.status);
        const json = await res.json();
        if (schema) return safeValidate(schema, json, path);
        return json as T;
      } catch (error) {
        clearTimeout(timer);
        if (attempt < this.maxRetries && this.isRetryable(error)) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        this.onError?.(path, error);
        return null;
      }
    }
    return null;
  }
}
