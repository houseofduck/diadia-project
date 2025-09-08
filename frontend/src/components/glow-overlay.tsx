"use client";

import { usePathname } from "next/navigation";

export function GlowOverlay() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 w-screen aspect-[2/1] rounded-full bg-[#fff596] blur-[100px] z-0 ${
        isHomePage ? 'top-[-40vw]' : 'top-[5vw]'
      }`}
    />
  );
}