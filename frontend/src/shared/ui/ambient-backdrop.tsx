"use client";
import { useEffect, useRef } from "react";

export function AmbientBackdrop() {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        layer.current?.style.setProperty("--drift-x", `${(event.clientX / innerWidth - .5) * 28}px`);
        layer.current?.style.setProperty("--drift-y", `${(event.clientY / innerHeight - .5) * 20}px`);
        frame = 0;
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(frame); };
  }, []);
  return <div ref={layer} className="ambient" aria-hidden="true"><div className="ambient-light" /><div className="ambient-grain" /></div>;
}
