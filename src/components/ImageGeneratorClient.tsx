"use client";

import { useState, useRef, useCallback } from "react";

// ─── Constants ──────────────────────────────────────────────
const WEBSOCKET_URL = "wss://websocket-bridge.freegen.app/ws";
const MAX_IMAGE_SIZE = 1024;

// ─── Types ──────────────────────────────────────────────────
type AspectRatio = "1:1" | "4:3" | "3:4" | "16:9" | "9:16";

interface FAQItem {
  q: string;
  a: string;
}

// ─── Data ───────────────────────────────────────────────────
const ASPECT_RATIOS: AspectRatio[] = ["1:1", "4:3", "3:4", "16:9", "9:16"];

const FEATURES = [
  {
    emoji: "🎨",
    title: "Flexible Aspect Ratios",
    desc: "Choose from 1:1, 4:3, 3:4, 16:9, or 9:16 to fit any use case.",
  },
  {
    emoji: "⚡",
    title: "Lightning Fast",
    desc: "Generate high-quality AI images in less than 10 seconds. Real-time delivery powered by WebSocket technology.",
  },
  {
    emoji: "🔓",
    title: "No Signup Required",
    desc: "Start creating immediately. No account registration, no credit card, no hidden costs. Unlimited free generations.",
  },
  {
    emoji: "🖼️",
    title: "Text & Image Prompts",
    desc: "Create from text descriptions or upload your own images for AI-powered transformations and enhancements.",
  },
  {
    emoji: "🚀",
    title: "Z-Image Turbo",
    desc: "Powered by Z-Image Turbo for professional-quality results with stunning detail and artistic coherence at blazing speed.",
  },
  {
    emoji: "💯",
    title: "100% Free Forever",
    desc: "No trials, no subscriptions, no limits. Our AI image generator will always be free to use for everyone.",
  },
];

const STEPS = [
  {
    num: "1",
    title: "Enter Your Prompt",
    desc: "Describe the image you want to create in the text box. Be specific and detailed for best results.",
  },
  {
    num: "2",
    title: "Choose Your Aspect Ratio",
    desc: "Select from 1:1, 4:3, 3:4, 16:9, or 9:16 to match your creative needs.",
  },
  {
    num: "3",
    title: "Upload an Image (Optional)",
    desc: 'Use the "Image Prompt" button to upload a reference image for image-to-image AI transformation.',
  },
  {
    num: "4",
    title: "Generate & Download",
    desc: 'Click "Generate" and wait less than 10 seconds. Your AI-generated image will appear automatically. Right-click to save!',
  },
];

const EXAMPLES = [
  {
    src: "https://assets.freegen.app/web/examples/1_xs.webp",
    alt: "AI generated fluffy seal point cat with blue eyes in green grass field",
    prompt: "A fluffy seal point cat lounging in a vibrant green grass field...",
  },
  {
    src: "https://assets.freegen.app/web/examples/2_xs.webp",
    alt: "AI generated winter scene with cheerful snowman wearing red hat and scarf",
    prompt: "A cheerful snowman with a red hat and scarf next to a cabin...",
  },
  {
    src: "https://assets.freegen.app/web/examples/3_xs.webp",
    alt: "AI generated artistic stone cat sculpture made from natural rocks",
    prompt: "Cat made from stones",
  },
];

const FAQS: FAQItem[] = [
  {
    q: "Is the AI image generator really free?",
    a: "Yes! Our AI image generator is completely free to use with no signup required. You can generate unlimited images without any hidden costs, subscriptions, or paywalls. We believe AI art should be accessible to everyone.",
  },
  {
    q: "What aspect ratios are available?",
    a: "We offer multiple aspect ratios: 1:1 (square), 4:3 and 3:4 (classic), and 16:9 and 9:16 (widescreen/portrait) to fit any use case from social media to wallpapers.",
  },
  {
    q: "Do I need to create an account?",
    a: "No account creation is required. Simply visit the site, enter your text prompt, and click generate to create AI images instantly. No email, no password, no personal information needed.",
  },
  {
    q: "How long does image generation take?",
    a: "Image generation typically takes less than 10 seconds. You'll see your generated image appear in real-time once processing is complete thanks to our WebSocket-powered delivery system.",
  },
  {
    q: "Can I use the generated images commercially?",
    a: "Yes, you can use the AI-generated images for both personal and commercial projects.",
  },
  {
    q: "What is the resolution of generated images?",
    a: "Generated images have a resolution of 1024×768 pixels, which is great for most uses.",
  },
  {
    q: "What AI model powers this generator?",
    a: "We use Z-Image Turbo, an advanced AI image generation model. It delivers high-quality, detailed images with excellent prompt adherence and artistic coherence, while maintaining blazing-fast generation speeds.",
  },
];

// ─── Helper: resize image ──────────────────────────────────
function resizeImage(dataUrl: string, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ─── Helper: WebSocket auth ────────────────────────────────
async function createWebSocketAuth(jobId: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = jobId + timestamp;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return btoa(hashHex).substring(0, 20) + ":" + timestamp;
}

// ─── Component ──────────────────────────────────────────────
export default function ImageGeneratorClient() {
  // State
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("4:3");
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("0.00s");
  const [error, setError] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showImageUpload, setShowImageUpload] = useState(true);
  const [seoVisible, setSeoVisible] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generatorRef = useRef<HTMLDivElement>(null);

  // ─── Start Timer ─────────────────────────────────────────
  const startTimer = useCallback(() => {
    const startTime = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedTime(elapsed.toFixed(2) + "s");
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ─── Handle Image Upload ─────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const dataUrl = ev.target?.result as string;
        const resized = await resizeImage(dataUrl, MAX_IMAGE_SIZE);
        setUploadedImage(resized);
      } catch {
        setError("Failed to process image.");
      }
    };
    reader.readAsDataURL(file);
  };

  // ─── Generate Image ──────────────────────────────────────
  const handleGenerate = async () => {
    if (isGenerating) return;

    const trimmed = prompt.trim();
    if (!trimmed && !uploadedImage) {
      setError("Please enter a prompt.");
      return;
    }
    if (trimmed.length > 2000) {
      setError("Prompt is too long. Please keep it under 2000 characters.");
      return;
    }

    setError("");
    setGeneratedImage(null);
    setStatusMessage("");
    setIsGenerating(true);
    startTimer();
    setSeoVisible(false);

    // Scroll to generator
    setTimeout(() => {
      generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);

    try {
      // Step 1: Sign the prompt
      const signerRes = await fetch("/api/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      if (!signerRes.ok) {
        const errData = await signerRes.json();
        throw new Error(errData.error || `Signer Error (${signerRes.status})`);
      }

      const { ts, sig } = await signerRes.json();

      // Step 2: Request image generation
      const genBody: Record<string, string> = {
        prompt: trimmed,
        ts,
        sig,
        ratio_id: aspectRatio,
      };

      if (uploadedImage) {
        genBody.image_data = uploadedImage;
      }

      const generatorRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(genBody),
      });

      if (!generatorRes.ok) {
        const errData = await generatorRes.json();
        throw new Error(errData.error || `Generator Error (${generatorRes.status})`);
      }

      const data = await generatorRes.json();

      // Step 3: Connect to WebSocket for real-time result
      if (data.job_id) {
        setStatusMessage("Connecting to generation server...");
        const auth = await createWebSocketAuth(data.job_id);
        const ws = new WebSocket(WEBSOCKET_URL);

        const wsTimeout = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
          setError("Connection timeout. Please try again.");
          setIsGenerating(false);
          stopTimer();
        }, 300000);

        ws.onopen = () => {
          setStatusMessage("Generating your image...");
          ws.send(
            JSON.stringify({
              type: "subscribe",
              job_id: data.job_id,
              auth,
            })
          );
        };

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);

          if (message.type === "status") {
            setStatusMessage(message.message || "Processing...");
          } else if (message.type === "result") {
            setGeneratedImage(message.image_data);
            setStatusMessage("");
            setIsGenerating(false);
            stopTimer();
            clearTimeout(wsTimeout);
            ws.close();
          } else if (message.type === "error") {
            setError(message.message || "Failed to generate image.");
            setStatusMessage("");
            setIsGenerating(false);
            stopTimer();
            clearTimeout(wsTimeout);
            ws.close();
          }
        };

        ws.onerror = () => {
          setError("WebSocket connection error. Please try again.");
          setStatusMessage("");
          setIsGenerating(false);
          stopTimer();
          clearTimeout(wsTimeout);
        };
      } else if (data.image_data) {
        // Direct result (fallback)
        setGeneratedImage(data.image_data);
        setIsGenerating(false);
        stopTimer();
      } else {
        throw new Error("Unexpected response from generator.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
      setStatusMessage("");
      setIsGenerating(false);
      stopTimer();
    }
  };

  // ─── Download Image ──────────────────────────────────────
  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = "generated_image.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Use Example Prompt ──────────────────────────────────
  const useExamplePrompt = (p: string) => {
    setPrompt(p);
    generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      {/* ── Navigation ──────────────────────────────────── */}
      <nav className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <a href="/" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />
            </svg>
            FreeGen
          </a>
          <div className="flex items-center gap-2">
            <a
              href="https://imgsearch.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 sm:flex"
            >
              <img src="https://imgsearch.com/favicon-96x96.png" alt="" width="14" height="14" className="align-text-bottom" />
              Free Images
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16" className="ml-0.5 opacity-60">
                <path fillRule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" />
                <path fillRule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" />
              </svg>
            </a>
            <a href="https://freegen.app/examples" target="_blank" rel="noopener noreferrer" className="hidden rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 sm:block">
              Examples
            </a>
            <a href="https://freegen.app/about" target="_blank" rel="noopener noreferrer" className="hidden rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 sm:block">
              About
            </a>
            <a href="https://freegen.app/terms" target="_blank" rel="noopener noreferrer" className="hidden rounded px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 sm:block">
              Terms
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero Banner ─────────────────────────────────── */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 py-10 text-white sm:py-14">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex flex-col items-center gap-8 lg:flex-row">
            <div className="flex-1 text-center lg:text-left">
              <h1 className="mb-3 flex items-center justify-center gap-2 text-3xl font-bold sm:text-4xl lg:justify-start">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Free AI Image Generator
              </h1>
              <p className="mb-4 text-lg text-blue-100 sm:text-xl">
                Create AI art instantly. Free, no signup.
              </p>
              <p className="text-sm text-blue-200">
                Generate stunning images from text prompts powered by Z-Image Turbo.
                No account needed, unlimited generations, multiple aspect ratios.
              </p>
              {/* Quick Stats */}
              <div className="mt-6 flex flex-wrap justify-center gap-4 lg:justify-start">
                <div className="rounded-lg bg-white/15 px-4 py-2 text-center backdrop-blur-sm">
                  <div className="text-lg font-bold">&lt;10s</div>
                  <div className="text-xs text-blue-200">Generation</div>
                </div>
                <div className="rounded-lg bg-white/15 px-4 py-2 text-center backdrop-blur-sm">
                  <div className="text-lg font-bold">5</div>
                  <div className="text-xs text-blue-200">Aspect Ratios</div>
                </div>
                <div className="rounded-lg bg-white/15 px-4 py-2 text-center backdrop-blur-sm">
                  <div className="text-lg font-bold">∞</div>
                  <div className="text-xs text-blue-200">Free</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Generator Tool ──────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-8" ref={generatorRef}>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-lg sm:p-6">
          {/* Prompt Label */}
          <label htmlFor="prompt" className="mb-1 block font-semibold text-gray-800">
            Enter your AI image prompt
          </label>
          <p className="mb-3 text-sm text-gray-500">
            Describe the image you want to create. Be specific for best results.
          </p>

          {/* Textarea */}
          <textarea
            id="prompt"
            rows={4}
            className="w-full resize-none rounded-lg border border-gray-300 p-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            placeholder="A majestic dragon flying over a medieval castle at sunset, cinematic lighting, ultra detailed..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                handleGenerate();
              }
            }}
            disabled={isGenerating}
          />

          {/* Controls Row */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {/* Left: Image Upload */}
            <div className="flex items-center gap-2">
              {showImageUpload && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
                  disabled={isGenerating}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="rgba(0,0,0,0.6)">
                    <circle cx="7.499" cy="9.5" r="1.5" />
                    <path d="m10.499 14-1.5-2-3 4h12l-4.5-6z" />
                    <path d="M19.999 4h-16c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2zm-16 14V6h16l.002 12H3.999z" />
                  </svg>
                  Image Prompt
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {/* Right: Aspect Ratio */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-500">Aspect ratio</span>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:border-gray-400 focus:border-blue-500"
                disabled={isGenerating}
              >
                {ASPECT_RATIOS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Uploaded Image Preview */}
          {uploadedImage && (
            <div className="mt-4 inline-block">
              <div className="relative">
                <img
                  src={uploadedImage}
                  alt="Preview of uploaded image"
                  className="max-w-[100px] rounded border border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => {
                    setUploadedImage(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white hover:bg-red-600"
                  aria-label="Remove uploaded image"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="mt-4">
            <button
              id="generateBtn"
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full rounded-lg px-6 py-3 text-base font-semibold text-white transition ${
                isGenerating
                  ? "cursor-not-allowed bg-blue-400"
                  : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
              }`}
            >
              {isGenerating ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                  </svg>
                  Generating... {elapsedTime}
                </span>
              ) : (
                "Generate"
              )}
            </button>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
              </svg>
              {statusMessage}
            </div>
          )}

          {/* Progress Bar */}
          {isGenerating && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="progress-animate h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600" />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">
              {error}
            </div>
          )}

          {/* Generated Image */}
          {generatedImage && (
            <div className="mt-6 text-center fade-in">
              <img
                src={generatedImage}
                alt="Generated Image"
                className="mx-auto max-h-[600px] w-auto rounded-lg shadow-md"
              />
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Image
                </button>
                <button
                  onClick={() => {
                    setGeneratedImage(null);
                    setError("");
                    setPrompt("");
                    setUploadedImage(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                >
                  Generate Another
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── SEO Sections (hide when generating) ─────────── */}
      {seoVisible && (
        <>
          {/* Features */}
          <section className="mx-auto max-w-5xl px-4 py-10 sm:py-14" style={{ borderTop: "1px solid #e0e0e0" }}>
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 sm:text-3xl">
              Why Choose Our Free AI Image Generator?
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <div key={i} className="text-center">
                  <div className="mb-3 text-4xl">{f.emoji}</div>
                  <h3 className="mb-1 text-base font-semibold text-gray-900">{f.title}</h3>
                  <p className="text-sm text-gray-500">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* How It Works */}
          <section className="mx-auto max-w-5xl px-4 py-10 sm:py-14" style={{ borderTop: "1px solid #e0e0e0" }}>
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 sm:text-3xl">
              How to Generate AI Images
            </h2>
            <div className="mx-auto max-w-2xl space-y-5">
              {STEPS.map((s, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {s.num}
                  </div>
                  <div>
                    <h3 className="mb-0.5 text-base font-semibold text-gray-900">{s.title}</h3>
                    <p className="text-sm text-gray-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Examples */}
          <section className="mx-auto max-w-5xl px-4 py-10 sm:py-14" style={{ borderTop: "1px solid #e0e0e0" }}>
            <h2 className="mb-2 text-center text-2xl font-bold text-gray-900 sm:text-3xl">
              AI-Generated Image Examples
            </h2>
            <p className="mb-8 text-center text-sm text-gray-500">
              See what&apos;s possible with our free AI image generator. Each image was created in seconds from a simple text prompt.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {EXAMPLES.map((ex, i) => (
                <div
                  key={i}
                  className="cursor-pointer overflow-hidden rounded-lg border border-gray-200 shadow-sm transition hover:shadow-md"
                  onClick={() => useExamplePrompt(ex.prompt)}
                >
                  <img
                    src={ex.src}
                    alt={ex.alt}
                    loading="lazy"
                    className="h-48 w-full object-cover"
                  />
                  <div className="p-3">
                    <p className="text-xs text-gray-500">
                      <strong>Prompt:</strong> &quot;{ex.prompt}&quot;
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 text-center">
              <a
                href="https://freegen.app/examples"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-blue-600 px-5 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
              >
                View 15+ More Examples →
              </a>
            </div>
          </section>

          {/* FAQ */}
          <section className="mx-auto max-w-3xl px-4 py-10 sm:py-14" style={{ borderTop: "1px solid #e0e0e0" }}>
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 sm:text-3xl">
              Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-gray-200 transition hover:border-gray-300"
                >
                  <button
                    className="flex w-full items-center justify-between gap-4 p-4 text-left"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <h3 className="text-sm font-semibold text-gray-900 sm:text-base">{faq.q}</h3>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`shrink-0 text-gray-400 transition-transform ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      openFaq === i ? "max-h-96 pb-4" : "max-h-0"
                    }`}
                  >
                    <p className="px-4 text-sm leading-relaxed text-gray-500">{faq.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-gray-200 bg-gray-50 py-8">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" />
            </svg>
            <span className="text-sm font-semibold text-gray-700">FreeGen</span>
          </div>
          <div className="mb-4 flex flex-wrap justify-center gap-4 text-xs text-gray-500">
            <a href="https://freegen.app/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">
              Home
            </a>
            <a href="https://freegen.app/examples" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">
              Examples
            </a>
            <a href="https://freegen.app/about" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">
              About
            </a>
            <a href="https://freegen.app/terms" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">
              Terms
            </a>
          </div>
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} FreeGen. Powered by{" "}
            <a href="https://freegen.app/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">
              freegen.app
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
