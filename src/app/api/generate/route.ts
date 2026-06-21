import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, ratio_id, image_data } = body;

    if (!prompt || !ratio_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = Buffer.from(`${prompt}${ts}`).toString("base64");

    const requestBody: Record<string, string> = {
      prompt,
      ts,
      sig,
      ratio_id,
    };

    if (image_data) {
      requestBody.image_data = image_data;
    }

    const generatorRes = await fetch("https://image-generator.freegen.app", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://freegen.app",
        "Referer": "https://freegen.app/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify(requestBody),
    });

    const contentType = generatorRes.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Generator returned invalid response. Try again." },
        { status: 502 }
      );
    }

    if (!generatorRes.ok) {
      let errorData;
      try {
        errorData = await generatorRes.json();
      } catch {
        errorData = { error: `Generator Error (${generatorRes.status})` };
      }

      return NextResponse.json(
        { error: errorData.error || `Error ${generatorRes.status}` },
        { status: generatorRes.status }
      );
    }

    const data = await generatorRes.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Generator proxy error:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
