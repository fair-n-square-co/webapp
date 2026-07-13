/** A bare 302. Cookies queued with `setCookie`/`deleteCookie` are attached to this by the server runtime. */
export function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { location } })
}
