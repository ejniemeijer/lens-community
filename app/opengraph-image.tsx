import { ImageResponse } from "next/og";

// Branded social/preview card used for og:image and (as a fallback) twitter:image
// across the public site. Text-only so it renders with the built-in font.
export const alt = "Lens — UX Research Repository";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #191F55 0%, #232a63 60%, #3A48C4 140%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#4756E1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            L
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.01em" }}>Lens</div>
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, marginTop: 44, maxWidth: 940 }}>
          Be in control of your research
        </div>
        <div style={{ fontSize: 30, color: "rgba(255,255,255,0.82)", marginTop: 28, maxWidth: 900, lineHeight: 1.4 }}>
          The UX research repository — analyze interviews, surface insights with AI, and turn evidence into product decisions.
        </div>
        <div style={{ fontSize: 24, color: "#A7B5FF", marginTop: 52, fontWeight: 600 }}>lensresearch.app</div>
      </div>
    ),
    { ...size },
  );
}
