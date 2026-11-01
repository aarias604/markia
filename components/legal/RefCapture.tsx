"use client";

// Guarda el código de referido (?ref=CODIGO) de cualquier página para usarlo al registrarse.
import { useEffect } from "react";

export const REF_KEY = "markia-ref";

export function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref)) localStorage.setItem(REF_KEY, ref.toUpperCase());
    } catch {
      /* sin almacenamiento */
    }
  }, []);
  return null;
}

export function readStoredRef(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("ref");
    if (fromUrl && /^[A-Za-z0-9]{4,16}$/.test(fromUrl)) return fromUrl.toUpperCase();
    return localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}
