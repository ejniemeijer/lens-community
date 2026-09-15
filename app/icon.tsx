import { ImageResponse } from "next/og";

/**
 * Favicon — the Lens logo (lucide Telescope on the primary indigo tile),
 * rendered to PNG at build time so every browser gets it (Safari ignores
 * SVG favicons). Colors match --primary in globals.css: hsl(234 72% 58%).
 */

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The lucide `telescope` outline (viewBox 0 0 24 24). Kept local — metadata
    routes only allow Next's own exports (default/size/contentType). */
function TelescopeMark({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44" />
      <path d="m13.56 11.747 4.332-.924" />
      <path d="m16 21-3.105-6.21" />
      <path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z" />
      <path d="m6.158 8.633 1.114 4.456" />
      <path d="m8 21 3.105-6.21" />
      <circle cx="12" cy="13" r="2" />
    </svg>
  );
}

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4756E1",
          borderRadius: 14,
        }}
      >
        <TelescopeMark px={42} />
      </div>
    ),
    size,
  );
}
