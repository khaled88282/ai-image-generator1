import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, ts, sig, ratio_id, image_data } = body;

    if (!prompt || !ts || !sig || !ratio_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!generatorRes.ok) {
      let errorData;
      try {
        errorData = await generatorRes.json();
      } catch {
        errorData = { error: `Generator Error (${generatorRes.status})` };
      }

      if (generatorRes.status === 400 && errorData.user_error) {
        return NextResponse.json(
          {
            error:
              errorData.error ||
              "Image cannot be processed. Please try a different image.",
            user_error: true,
          },
          { status: 400 }
        );
      } else if (generatorRes.status === 429) {
        return NextResponse.json(
          {
            error:
              errorData.error ||
              "Too many requests. Please wait a moment and try again.",
          },
          { status: 429 }
        );
      } else {
        return NextResponse.json(
          { error: errorData.error || `Generator Error (${generatorRes.status})` },
          { status: generatorRes.status }
        );
      }
    }

    const data = await generatorRes.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Generator proxy error:", error);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}
