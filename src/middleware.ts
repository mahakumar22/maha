import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image files, and /api.
     *
     * API routes are excluded deliberately: they are called by machines that
     * carry no session cookie, so redirecting them to /login would break them
     * silently -- the nightly reminder cron did exactly that before this
     * exclusion. Anything under /api authenticates itself.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
