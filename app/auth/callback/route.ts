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
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Auth callback error:", error);
        return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
      }

      // Check if the user is an admin
      const user = data.session?.user;
      if (user) {
        try {
          // First, create or update the user profile
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              user_id: user.id,
              first_name: user.user_metadata?.full_name?.split(' ')[0] || user.user_metadata?.name || 'User',
              last_name: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
              email: user.email || '',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            });

          if (profileError) {
            console.error("Error creating/updating profile:", profileError);
          }

          // Check if user is admin
          const { data: adminData, error: adminError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (!adminError && adminData) {
            // User is admin, redirect to admin dashboard
            const response = NextResponse.redirect(new URL("/admin", request.url));
            response.cookies.set("isAdmin", "true", {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              maxAge: 60 * 60 * 24, // 1 day
              path: "/",
            });
            return response;
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
        }
      }

      // Regular user, redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch (error) {
      console.error("Session exchange error:", error);
      return NextResponse.redirect(new URL("/login?error=session_failed", request.url));
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(new URL("/login?error=no_code", request.url));
}