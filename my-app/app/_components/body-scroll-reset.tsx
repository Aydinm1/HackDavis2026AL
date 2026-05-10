"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function BodyScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }, [pathname]);

  return null;
}
