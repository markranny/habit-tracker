import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  console.log("🚀 AUTH CALLBACK ROUTE HIT!");
  console.log("URL:", request.url);
  
  // Just redirect to dashboard for now - we'll add auth logic later
  console.log("Redirecting to dashboard...");
  return NextResponse.redirect(new URL("/dashboard", request.url));
}

// Also handle POST requests just in case
export async function POST(request: NextRequest) {
  console.log("🚀 AUTH CALLBACK POST HIT!");
  return NextResponse.redirect(new URL("/dashboard", request.url));
}