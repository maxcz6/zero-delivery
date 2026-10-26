"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "zd_install_prompt_shown";
const VISIBLE_MS = 3000;

/**
 * Banner de instalación PWA: se muestra una única vez por usuario durante 3
 * segundos, solo cuando el navegador emite beforeinstallprompt.
 */
export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setDeferred(promptEvent);
      let alreadyShown = false;
      try {
        alreadyShown = window.localStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        alreadyShown = true;
      }
      if (!alreadyShown) {
        setVisible(true);
        try {
          window.localStorage.setItem(STORAGE_KEY, "1");
        } catch {
          // almacenamiento no disponible: el banner vuelve a mostrarse, sin impacto
        }
        window.setTimeout(() => setVisible(false), VISIBLE_MS);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !deferred) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[calc(16px+env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-modal border border-border bg-card p-4 shadow-xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Download className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">Instala Zero Delivery</p>
          <p className="truncate text-xs text-muted-foreground">Acceso rápido desde tu teléfono</p>
        </div>
        <button
          type="button"
          className="btn-primary !px-4 !py-2 text-sm"
          onClick={() => {
            void deferred.prompt();
            setVisible(false);
          }}
        >
          Instalar
        </button>
        <button
          type="button"
          aria-label="Cerrar"
          className="cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
          onClick={() => setVisible(false)}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
