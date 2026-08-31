import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import OperatingLoop from "~/components/OperatingLoop";

export default function OperatingLoopPortal() {
  const location = useLocation();
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (location.pathname === "/" || location.pathname === "/login") {
      setMount(null);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>("main.min-w-0.flex-1");
      const parent = main?.parentElement;
      if (!main || !parent) return;

      let host = document.getElementById("ailhat-operating-loop-mount");
      if (!host) {
        host = document.createElement("div");
        host.id = "ailhat-operating-loop-mount";
        parent.insertBefore(host, main);
      }
      setMount(host);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  if (!mount || location.pathname === "/" || location.pathname === "/login") return null;
  return createPortal(<OperatingLoop />, mount);
}
