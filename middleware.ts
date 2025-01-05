import { NextResponse } from "next/server"
import { auth } from "./auth"
 
export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isOnDashboard = req.nextUrl.pathname.startsWith('/dashboard')
 
  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL('/signin', req.url))
  }
 
  return NextResponse.next()
})

// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

