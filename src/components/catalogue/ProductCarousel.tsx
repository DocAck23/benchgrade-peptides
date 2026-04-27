"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalogue/data";
import { PRODUCTS, getMinPrice } from "@/lib/catalogue/data";
import { formatPrice } from "@/lib/utils";
import { QuickAddButton } from "./QuickAddButton";

/**
 * Homepage product carousel.
 *
 * JS-driven auto-scroll over a native horizontal-scroll viewport. The
 * tile list is rendered once as the real (announced, keyboard-reachable)
 * set and once as an aria-hidden + inert decorative duplicate so the
 * loop is seamless: when scrollLeft passes the halfway mark we subtract
 * half the track width in a single frame — invisible because the second
 * set is pixel-identical to the first at that position.
 *
 * Why JS instead of a CSS `transform` animation?
 *  - CSS transform animations interfere with native horizontal scroll on
 *    mobile (the user's swipe gets fought by the transform under their
 *    finger). Driving `scrollLeft` directly composes cleanly with touch:
 *    a finger drag IS the scroll, and our auto-tick just resumes after
 *    a short idle.
 *  - Identical behavior on desktop and mobile — no `@media` divergence.
 *
 * Pause rules:
 *  - hover / focus-within → pause until the cursor / focus leaves
 *  - pointer/touch/wheel interaction → pause for ~2.5s after the last event
 *  - prefers-reduced-motion: reduce → no animation at all
 */
export function ProductCarousel() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    // Force a clean starting position. If the browser restored a
    // prior scroll offset from history (back-button restore can do
    // this, even for non-`overflow:auto` boxes that get later
    // upgraded), the carousel could appear "stuck" at an arbitrary
    // mid-position when in fact it was already mid-loop.
    viewport.scrollLeft = 0;

    let hovered = false;
    let lastInteraction = 0;
    let visible = true;
    const RESUME_DELAY_MS = 2500;

    // Pause when the section scrolls off-screen (tab off, footer
    // viewport, etc) so we're not burning rAF on invisible paint.
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) visible = e.isIntersecting;
        },
        { threshold: 0 },
      );
      observer.observe(viewport);
    }

    let raf = 0;
    let last = performance.now();
    // Subpixel accumulator. `viewport.scrollLeft` is rounded by the
    // browser, so a per-frame increment under 1px (e.g. 28 px/sec ×
    // 0.016 s = 0.45) gets rounded back to 0 every frame and the
    // carousel never moves. Track the fractional remainder here and
    // only apply integer deltas to scrollLeft.
    let pendingScroll = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!hovered && visible && now - lastInteraction > RESUME_DELAY_MS) {
        // Speed tuned so motion is perceptible at first glance —
        // 28/50 read as "static" because a single card sweep takes
        // ~10s. 60/90 sweeps a card every ~3-4s, which the eye picks
        // up immediately without feeling rushed.
        const speed = window.innerWidth < 768 ? 60 : 90;
        const half = track.scrollWidth / 2;
        if (half > viewport.clientWidth) {
          pendingScroll += speed * dt;
          const whole = Math.floor(pendingScroll);
          if (whole > 0) {
            viewport.scrollLeft += whole;
            pendingScroll -= whole;
            if (viewport.scrollLeft >= half) {
              viewport.scrollLeft -= half;
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onEnter = () => { hovered = true; };
    const onLeave = () => { hovered = false; };
    const onInteract = () => { lastInteraction = performance.now(); };

    viewport.addEventListener("mouseenter", onEnter);
    viewport.addEventListener("mouseleave", onLeave);
    viewport.addEventListener("focusin", onEnter);
    viewport.addEventListener("focusout", onLeave);
    viewport.addEventListener("pointerdown", onInteract);
    viewport.addEventListener("touchstart", onInteract, { passive: true });
    viewport.addEventListener("touchmove", onInteract, { passive: true });
    viewport.addEventListener("touchend", onInteract, { passive: true });
    viewport.addEventListener("wheel", onInteract, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      viewport.removeEventListener("mouseenter", onEnter);
      viewport.removeEventListener("mouseleave", onLeave);
      viewport.removeEventListener("focusin", onEnter);
      viewport.removeEventListener("focusout", onLeave);
      viewport.removeEventListener("pointerdown", onInteract);
      viewport.removeEventListener("touchstart", onInteract);
      viewport.removeEventListener("touchmove", onInteract);
      viewport.removeEventListener("touchend", onInteract);
      viewport.removeEventListener("wheel", onInteract);
    };
  }, []);

  return (
    <section
      aria-label="Featured compounds"
      data-surface="wine"
      className="py-16 sm:py-20 overflow-hidden bg-wine"
    >
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 mb-10 flex items-end justify-between gap-4">
        <div>
          <div className="label-eyebrow text-gold-light mb-2">Featured compounds</div>
          <h2 className="font-display text-3xl lg:text-4xl text-paper leading-tight">
            From the catalogue
          </h2>
        </div>
        <Link href="/catalogue" className="text-sm text-gold-light hover:underline whitespace-nowrap">
          Browse all {PRODUCTS.length} →
        </Link>
      </div>

      <div
        ref={viewportRef}
        className="relative overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}
      >
        {/* Edge fades — desktop only; on mobile they get in the way of
            the swipe-to-end visual cue. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 lg:w-10 bg-gradient-to-r from-wine to-transparent z-10 hidden md:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 lg:w-10 bg-gradient-to-l from-wine to-transparent z-10 hidden md:block" />

        <div
          ref={trackRef}
          className="flex gap-2 sm:gap-4 lg:gap-5 w-max px-3 sm:px-6 lg:px-10"
        >
          {/* Real set — keyboard-reachable, announced */}
          <ul className="flex gap-2 sm:gap-4 lg:gap-5 shrink-0">
            {PRODUCTS.map((product) => (
              <li key={product.slug}>
                <ProductCarouselCard product={product} />
              </li>
            ))}
          </ul>
          {/* Decorative duplicate — hidden from assistive tech + removed
              from tab order. Identical to the real set so the wrap-around
              is invisible. */}
          <ul
            className="flex gap-2 sm:gap-4 lg:gap-5 shrink-0"
            aria-hidden="true"
            inert
          >
            {PRODUCTS.map((product) => (
              <li key={`dup-${product.slug}`}>
                <ProductCarouselCard product={product} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ProductCarouselCard({ product }: { product: CatalogProduct }) {
  const minPrice = getMinPrice(product);
  const sizes = product.variants.map((v) => `${v.size_mg}mg`).join(" · ");
  return (
    <article className="w-[108px] sm:w-[240px] lg:w-[280px] shrink-0 bg-paper border rule p-2 sm:p-5 hover:bg-paper-soft transition-colors flex flex-col">
      <Link
        href={`/catalogue/${product.category_slug}/${product.slug}`}
        className="block focus-visible:outline-none"
      >
        {/* Vial photograph */}
        <div className="relative aspect-square bg-paper-soft border rule mb-2 sm:mb-4 overflow-hidden">
          <Image
            src={product.vial_image}
            alt={`${product.name} research vial`}
            fill
            sizes="(min-width: 640px) 280px, 108px"
            className="object-cover scale-[1.1] [object-position:60%_50%]"
          />
        </div>

        {product.molecular_formula && (
          <div className="hidden sm:block font-mono-data text-[10px] text-ink-muted mb-2 truncate">
            {product.molecular_formula}
          </div>
        )}
        <h3 className="font-display text-[12px] sm:text-lg text-ink leading-tight mb-2 sm:mb-3 line-clamp-2 sm:truncate min-h-[2.4em] sm:min-h-0">
          {product.name}
        </h3>
        <div className="flex items-baseline justify-between pt-2 sm:pt-3 border-t rule gap-1">
          <span className="font-mono-data text-[11px] sm:text-sm text-ink">
            from {formatPrice(minPrice * 100)}
          </span>
          <span className="hidden sm:inline label-eyebrow text-ink-muted">{sizes}</span>
        </div>
      </Link>

      {/* Quick-add hidden on mobile — the cramped 108px card prefers the
          tap-to-open detail page. From sm up the size selector + add CTA
          land back as siblings. */}
      <div className="hidden sm:block mt-3">
        <QuickAddButton product={product} size="sm" />
      </div>
    </article>
  );
}
