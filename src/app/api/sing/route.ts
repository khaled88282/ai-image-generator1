import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    const ts = Math.floor(Date.now() / 1000).toString();
    const encoder = new TextEncoder();
    const data = encoder.encode(prompt + ts);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const sig = btoa(hashHex).substring(0, 20);

    return NextResponse.json({ ts, sig });
  } catch {
    return NextResponse.json({ error: "Sign failed" }, { status: 500 });
  }
}
