"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const KEY = "markia-cookies-ok";
const subscribe = () => () => {};

function readAccepted() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // si no hay almacenamiento, no molestamos
  }
}

export function CookieNotice() {
  const stored = useSyncExternalStore(subscribe, readAccepted, () => true);
  const [closed, setClosed] = useState(false);
  if (stored || closed) return null;

  function accept() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* sin almacenamiento */
    }
    setClosed(true);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-2xl border border-[#D9B382]/60 bg-[#FDFBF7] p-4 text-sm text-[#4A154B] shadow-xl sm:flex sm:items-center sm:gap-4">
      <p className="flex-1">
        Usamos solo cookies esenciales para mantener tu sesión.{" "}
        <Link href="/legal/cookies" className="font-semibold underline">Más información</Link>
      </p>
      <button onClick={accept} className="mt-3 w-full rounded-full bg-[#4A154B] px-5 py-2 font-semibold text-[#FAF5EF] sm:mt-0 sm:w-auto">
        Entendido
      </button>
    </div>
  );
}
