/**
 * Buffered fetch for server-side calls made through the generated hey-api
 * clients.
 *
 * The generated client wraps every call in a `Request` object before
 * fetching. In Node (route handlers, server actions) a `Request` body is a
 * stream, so undici sends it with `Transfer-Encoding: chunked` — which
 * Django's dev server (WSGIServer) rejects with `Bad request syntax`.
 * Browsers buffer request bodies and send Content-Length, so this only
 * bites server-side. Re-issue the request with a fully buffered body.
 */
export const serverBufferedFetch: typeof fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();
  return fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body,
    redirect: request.redirect,
  });
};
