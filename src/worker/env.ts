import { randomId, sha256Hex } from './auth/crypto';

export interface Env {
  ENVIRONMENT: string;
  PAYMENT_MODE: string;
  APP_ORIGIN: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  RECEIPTS?: R2BucketLike;
  CORE: DurableObjectNamespaceLike;
  SESSION_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  PLATFORM_FEE_BPS?: string;
  ALLOW_DEMO_SEED?: string;
  DEBUG_ERRORS?: string;
  /** Optional rate-limit overrides, e.g. RL_REGISTER. */
  RL_REGISTER?: string;
  RL_LOGIN?: string;
  RL_PAYMENT_INTENT?: string;
}

export interface R2ObjectLike {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  size: number;
  etag: string;
}

export interface R2BucketLike {
  put(key: string, value: ArrayBuffer | Uint8Array | ReadableStream, options?: Record<string, unknown>): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
  delete(key: string): Promise<void>;
}

export interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

export type CoreStubResult<T> = { ok: true; data: T } | { ok: false; code: string; fields?: Record<string, string> };

/**
 * Typed RPC fa莽ade over the Core Durable Object. Every business write happens
 * inside the object so it is serialized and transactional.
 */
export class Core {
  constructor(private readonly env: Env) {}

  get stub(): DurableObjectStubLike {
    return this.env.CORE.get(this.env.CORE.idFromName('billswipe-core'));
  }

  async call<T>(method: string, payload: unknown = {}): Promise<T> {
    const res = await this.stub.fetch('https://core.internal/rpc', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-core-secret': this.env.SESSION_SECRET ?? 'dev-core-secret',
      },
      body: JSON.stringify({ method, payload }),
    });
    if (!res.ok && res.status >= 500) {
      const detail = await res.text().catch(() => '');
      throw new Error(`core_unavailable:${res.status}:${detail.slice(0, 900)}`);
    }
    const body = (await res.json()) as { ok: boolean; data?: T; code?: string; message?: string; fields?: Record<string, string> };
    if (!body.ok) {
      const error = new Error(body.message ?? 'request_failed') as Error & { code?: string; fields?: Record<string, string> };
      error.code = body.code ?? 'request_failed';
      error.fields = body.fields;
      throw error;
    }
    return body.data as T;
  }
}

export async function ipHash(request: Request, salt: string): Promise<string> {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  return (await sha256Hex(`${salt}:${ip}`)).slice(0, 24);
}

export function newId(prefix: string): string {
  return randomId(prefix);
}

