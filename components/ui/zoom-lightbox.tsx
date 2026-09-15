"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X } from "lucide-react";

/**
 * Full-screen image lightbox with zoom and pan. Fit-to-screen was often not
 * enough for dense design screenshots — participants (glasses, phones, big
 * screenshots of small UI) need to get closer.
 *
 *   wheel / trackpad   zoom at the cursor
 *   pinch              zoom at the pinch midpoint (Pointer Events, so one code
 *                      path covers mouse and touch)
 *   drag               pan while zoomed
 *   double click/tap   toggle 1× ↔ 2.5× at that point
 *   +/− buttons        keyboard-free zoom for viewers who have neither wheel
 *                      nor touch (and a visible affordance that zoom exists)
 *   Esc / backdrop / × close
 *
 * The transform is translate+scale with origin 0,0 on a wrapper around the
 * image, and every mutation goes through one clamp: smaller-than-viewport
 * stays centered, larger-than-viewport can never be dragged fully off-screen.
 */

const MAX_SCALE = 8;
const DBL_SCALE = 2.5;

interface View {
  s: number;
  tx: number;
  ty: number;
}

export function ZoomLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Fitted (scale=1) layout size of the image, computed from its natural size.
  const [fit, setFit] = React.useState<{ w: number; h: number } | null>(null);
  const [view, setView] = React.useState<View>({ s: 1, tx: 0, ty: 0 });
  // Pointer state lives in refs — pans happen per-move and must not depend on
  // stale closures or re-render timing.
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = React.useRef(0);
  const moved = React.useRef(false);
  /** Whether the press began on the backdrop itself. The container captures
      the pointer for panning, and capture retargets the subsequent click to
      the container — so the click's own target can't distinguish image from
      backdrop; only the pointerdown target can. */
  const downOnBackdrop = React.useRef(false);

  const clamp = React.useCallback(
    (v: View, f = fit): View => {
      const el = containerRef.current;
      if (!el || !f) return v;
      const { clientWidth: cw, clientHeight: ch } = el;
      const s = Math.min(MAX_SCALE, Math.max(1, v.s));
      const sw = f.w * s;
      const sh = f.h * s;
      const tx = sw <= cw ? (cw - sw) / 2 : Math.min(0, Math.max(cw - sw, v.tx));
      const ty = sh <= ch ? (ch - sh) / 2 : Math.min(0, Math.max(ch - sh, v.ty));
      return { s, tx, ty };
    },
    [fit],
  );

  /** Rescale so the content point under (px,py) stays under (px,py). */
  const zoomAt = React.useCallback(
    (px: number, py: number, factor: number) => {
      setView((v) => {
        const s = Math.min(MAX_SCALE, Math.max(1, v.s * factor));
        const k = s / v.s;
        return clamp({ s, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k });
      });
    },
    [clamp],
  );

  // Fit the image to the viewport once its natural size is known, and refit on
  // window resize (resetting the view — keeping a zoom anchored through a
  // resize isn't worth the math).
  const measure = React.useCallback(
    (img: HTMLImageElement) => {
      const el = containerRef.current;
      if (!el) return;
      // SVGs without an intrinsic size report 0×0 — give them a sane canvas.
      const nw = img.naturalWidth || 800;
      const nh = img.naturalHeight || 600;
      const pad = 32;
      const k = Math.min((el.clientWidth - pad) / nw, (el.clientHeight - pad) / nh);
      const f = { w: Math.max(1, nw * k), h: Math.max(1, nh * k) };
      setFit(f);
      setView(clamp({ s: 1, tx: 0, ty: 0 }, f));
    },
    [clamp],
  );

  const imgRef = React.useRef<HTMLImageElement>(null);
  React.useEffect(() => {
    // A cached image can be `complete` before React attaches onLoad — measure
    // it here or the lightbox opens at 1×1.
    if (imgRef.current?.complete && !fit) measure(imgRef.current);
    const onResize = () => imgRef.current?.complete && imgRef.current && measure(imgRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure, fit]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Wheel must be a non-passive native listener — React's synthetic onWheel
  // can't preventDefault the page scroll behind the lightbox.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.18 : 1 / 1.18);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const pos = (e: React.PointerEvent) => {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Never capture presses that start on a control: pointer capture retargets
    // the subsequent click to the container, so the button's onClick never
    // fires and the backdrop-close check sees a container click instead — the
    // zoom buttons would close the lightbox.
    if ((e.target as HTMLElement).closest("button")) return;
    downOnBackdrop.current = e.target === containerRef.current;
    containerRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, pos(e));
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    const cur = pos(e);
    pointers.current.set(e.pointerId, cur);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist.current > 0) {
        moved.current = true;
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / pinchDist.current);
      }
      pinchDist.current = dist;
      return;
    }

    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true;
    setView((v) => clamp({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinchDist.current = 0;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const r = containerRef.current!.getBoundingClientRect();
    if (view.s > 1.01) setView(clamp({ s: 1, tx: 0, ty: 0 }));
    else zoomAt(e.clientX - r.left, e.clientY - r.top, DBL_SCALE);
  };

  const center = () => {
    const el = containerRef.current;
    return el ? { x: el.clientWidth / 2, y: el.clientHeight / 2 } : { x: 0, y: 0 };
  };

  const zoomed = view.s > 1.01;

  // Portal to <body>: the runner is embedded inside transformed wrappers in
  // the builder's glance panel and the preview page, and a transform hijacks
  // position:fixed — the "full-screen" overlay would size against a 0×0 box.
  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className={`fixed inset-0 z-[110] overflow-hidden bg-[hsl(224_40%_8%/0.85)] ${zoomed ? "cursor-grab" : "cursor-zoom-in"}`}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={onDoubleClick}
      onClick={() => {
        // Close only for a stationary click that STARTED on the backdrop —
        // the click's own target is unreliable under pointer capture.
        if (!moved.current && downOnBackdrop.current) onClose();
      }}
    >
      <div
        style={{
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`,
          transformOrigin: "0 0",
          width: fit?.w,
          height: fit?.h,
          willChange: "transform",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          onLoad={(e) => measure(e.currentTarget)}
          className="h-full w-full select-none rounded-lg shadow-lg"
        />
      </div>

      <div
        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-surface p-1 shadow"
        /* Keep toolbar interaction out of the pan/zoom gesture handlers — a
           double-tap on + must not also trigger the container's zoom toggle. */
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button
          className="rounded-full p-2 text-foreground transition-colors hover:bg-surface-hover disabled:opacity-30"
          onClick={() => { const c = center(); zoomAt(c.x, c.y, 1 / 1.5); }}
          disabled={!zoomed}
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-12 text-center font-mono text-xs text-muted">{Math.round(view.s * 100)}%</span>
        <button
          className="rounded-full p-2 text-foreground transition-colors hover:bg-surface-hover disabled:opacity-30"
          onClick={() => { const c = center(); zoomAt(c.x, c.y, 1.5); }}
          disabled={view.s >= MAX_SCALE - 0.01}
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <p className="pointer-events-none absolute bottom-4 right-4 hidden text-xs text-white/60 sm:block">
        Scroll or pinch to zoom · drag to pan · double-click to {zoomed ? "reset" : "zoom"}
      </p>

      <button
        className="absolute right-4 top-4 rounded-full bg-surface p-2.5 text-foreground shadow"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  );
}
