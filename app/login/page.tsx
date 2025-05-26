"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "@/lib/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, Shield } from "lucide-react"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const registered = searchParams.get("registered")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(true)
  const [isAdminLogin, setIsAdminLogin] = useState(false)

  useEffect(() => {
    // Check if Supabase is configured
    setIsConfigured(isSupabaseConfigured())

    // Clear any lingering session data on page load
    localStorage.removeItem("firstName")
    localStorage.removeItem("lastName")
    localStorage.removeItem("isAdmin")
    localStorage.removeItem("profileImage")

    // Force refresh storage listeners
    window.dispatchEvent(new Event("storage"))
  }, [])

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      if (!isConfigured) return

      const { data } = await supabase.auth.getSession()
      if (data.session) {
        // Check if user is admin
        const { data: adminData } = await supabase.from("admin_users").select("*").eq("user_id", data.session.user.id).single()
        
        if (adminData) {
          localStorage.setItem("isAdmin", "true")
          router.push("/admin")
        } else {
          router.push("/dashboard")
        }
      }
    }

    checkSession()
  }, [router, isConfigured])

  useEffect(() => {
    if (registered) {
      setSuccess("Account created successfully! You can now sign in.")
    }
  }, [registered])

  const handleGoogleSignIn = async () => {
    if (!isConfigured) {
      setError("Google sign-in requires Supabase configuration.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error
    } catch (error: any) {
      console.error("Google sign-in failed:", error)
      setError(error.message || "Failed to sign in with Google")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    try {
      if (isAdminLogin) {
        // Verify admin credentials
        if (email !== "admin@example.com" || password !== "admin123") {
          throw new Error("Invalid admin credentials. Please use admin@example.com and admin123.")
        }

        // Set admin data in localStorage
        localStorage.setItem("firstName", "Admin")
        localStorage.setItem("lastName", "User")
        localStorage.setItem("isAdmin", "true")

        // Trigger storage event for other components
        window.dispatchEvent(new Event("storage"))

        // Set a success message
        setSuccess("Admin login successful! Redirecting to admin dashboard...")

        // Use setTimeout to ensure the success message is shown before redirecting
        setTimeout(() => {
          // Use window.location for a hard redirect to ensure state is reset
          window.location.href = "/admin"
        }, 500)

        return
      } else {
        // Regular user login
        if (!isConfigured) {
          // For demo mode, just set some localStorage values and redirect
          localStorage.setItem("firstName", "Demo")
          localStorage.setItem("lastName", "User")

          // Trigger storage event for other components
          window.dispatchEvent(new Event("storage"))

          // Redirect to dashboard
          router.push("/dashboard")
          return
        }

        const { user, error } = await signIn(email, password)

        if (error) throw error

        if (user) {
          // Store user info in localStorage for compatibility with existing code
          localStorage.setItem("firstName", user.user_metadata?.first_name || "User")
          localStorage.setItem("lastName", user.user_metadata?.last_name || "")

          // Check if user is admin
          const { data: adminData } = await supabase.from("admin_users").select("*").eq("user_id", user.id).single()

          if (adminData) {
            localStorage.setItem("isAdmin", "true")
            // Trigger storage event
            window.dispatchEvent(new Event("storage"))
            router.push("/admin")
          } else {
            // Trigger storage event for other components
            window.dispatchEvent(new Event("storage"))
            router.push("/dashboard")
          }
        }
      }
    } catch (error: any) {
      console.error("Login failed:", error)
      setError(error.message || "Invalid email or password")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      <div className="m-auto w-full max-w-md p-8 bg-white rounded-lg shadow-xl">
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-black"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
            <h1 className="text-xl font-bold">Learning Habit Tracker</h1>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center mb-6">Sign in</h2>

        {!isConfigured && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p>Supabase is not configured. For demo purposes, you can still:</p>
              <ul className="list-disc pl-5 mt-2">
                <li>Use the "Login as Admin" button to access the admin interface</li>
                <li>Or enter any email/password to access the user dashboard</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="default" className="mb-4 border-green-500 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder={isAdminLogin ? "admin@example.com" : "john@example.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder={isAdminLogin ? "admin123" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="text-right">
              <Link href="/reset-password" className="text-sm text-indigo-600 hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>

          <div className="flex items-center p-3 mb-4 bg-gray-50 border border-gray-200 rounded-md">
            <input
              id="admin-login"
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              onChange={(e) => setIsAdminLogin(e.target.checked)}
              checked={isAdminLogin}
            />
            <label htmlFor="admin-login" className="ml-2 block text-sm text-gray-900 flex items-center">
              <Shield className="h-4 w-4 text-indigo-600 mr-1" />
              <span>Login as Admin</span>
            </label>
          </div>

          {isAdminLogin && (
            <Alert className="mb-4 bg-blue-50 border-blue-200">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-blue-600 mr-2" />
                <AlertDescription className="text-blue-700 text-sm">
                  Admin credentials: email <strong>admin@example.com</strong> and password <strong>admin123</strong>
                </AlertDescription>
              </div>
            </Alert>
          )}

          <div>
            <Button
              type="submit"
              className={`w-full ${
                isAdminLogin
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              }`}
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : isAdminLogin ? "Sign in as Admin" : "Sign in"}
            </Button>
          </div>
        </form>

        <div className="text-center mt-4 text-sm">
          <span className="text-gray-600">Don't have an account? </span>
          <Link href="/register" className="text-indigo-600 hover:underline">
            Register
          </Link>
        </div>

        <div className="mt-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-4">
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-50"
              onClick={handleGoogleSignIn}
              disabled={isLoading || !isConfigured}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
                <path
                  fill="#FFC107"
                  d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
                />
                <path
                  fill="#4CAF50"
                  d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
                />
              </svg>
              Sign in with Google
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}