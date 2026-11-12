export function GET(request: Request) {
  return Response.redirect(new URL('/icons/icon.svg', request.url))
}
