import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.evolink.ai",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Native deps used to burn caption overlays onto slide media must run via
  // Node's require (not be bundled), so their binaries resolve at runtime.
  serverExternalPackages: ["@napi-rs/canvas", "ffmpeg-static"],
  // Ensure the bundled font + ffmpeg/canvas binaries ship with the status
  // route's serverless function (it composites image + video overlays).
  outputFileTracingIncludes: {
    "/api/carousel-status/*": [
      "./src/lib/carousel/fonts/**",
      "./node_modules/ffmpeg-static/**",
      "./node_modules/@napi-rs/canvas-*/**",
    ],
    // The video export route stitches slide images into an MP4 (ffmpeg) and, for
    // video carousels, burns captions onto the text-free slide images (canvas +
    // fonts), so it needs the same native assets in its function bundle.
    "/api/carousel/*/export-video": [
      "./src/lib/carousel/fonts/**",
      "./node_modules/ffmpeg-static/**",
      "./node_modules/@napi-rs/canvas-*/**",
    ],
    // Publishing a video carousel concatenates its clips into one MP4 (ffmpeg)
    // before upload — captions are already on the clips, so no canvas/fonts.
    "/api/publish/*": ["./node_modules/ffmpeg-static/**"],
    // The founder hook reels engine burns minimalist storyline captions onto the
    // uploaded app clips at generation time (ffmpeg + canvas + fonts).
    "/api/founder-hooks/generate": [
      "./src/lib/carousel/fonts/**",
      "./node_modules/ffmpeg-static/**",
      "./node_modules/@napi-rs/canvas-*/**",
    ],
  },
};

export default nextConfig;
