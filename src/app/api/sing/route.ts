import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const signerRes = await fetch("https://prompt-signer.freegen.app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!signerRes.ok) {
      if (signerRes.status === 429) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment and try again." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `Signer Error (${signerRes.status})` },
        { status: signerRes.status }
      );
    }

    const data = await signerRes.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Signer proxy error:", error);
    return NextResponse.json({ error: "Failed to sign prompt" }, { status: 500 });
  }
}
