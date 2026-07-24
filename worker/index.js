function secure(response, cacheControl) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (cacheControl) headers.set('Cache-Control', cacheControl);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const assetUrl = new URL(incoming);
    if (assetUrl.pathname === '/' || assetUrl.pathname.endsWith('/')) assetUrl.pathname += 'index.html';
    let response = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (response.status === 404 && !assetUrl.pathname.split('/').at(-1).includes('.')) {
      response = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }
    const immutable = /\.(?:png|jpe?g|webp|mp4|woff2?)$/i.test(assetUrl.pathname);
    return secure(response, immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
  },
};
