import { api } from './api';
import type { Env } from './env';

export { Core } from './core';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const response = await api.fetch(request, env, ctx);
      return withSecurityHeaders(response, url);
    }

    // Static SPA assets (Vite build output) served by the assets binding.
    if (env.ASSETS) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status === 404 && request.method === 'GET' && isNavigation(request)) {
        const fallback = await env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
        return withSecurityHeaders(fallback, url);
      }
      return withSecurityHeaders(asset, url);
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

function isNavigation(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('text/html');
}

function withSecurityHeaders(response: Response, url: URL): Response {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'geolocation=(), microphone=(), camera=()');
  if (!headers.has('cache-control')) {
    const isHashed = /\/assets\/[^/]+-[a-zA-Z0-9]{8,}\.(js|css|woff2?)$/.test(url.pathname);
    headers.set('cache-control', isHashed ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
