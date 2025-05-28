import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const user = data.session?.user;
    if (user) {
      const { data: userData, error: userError } = await supabase
        .from('users') 
        .select('role') 
        .eq('id', user.id)
        .single();

      if (userError || !userData) {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      if (userData.role === 'admin') {
        return NextResponse.redirect(new URL("/admin", request.url)); 
      }
    }
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}