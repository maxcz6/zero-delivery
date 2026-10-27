"use client";

import { create } from "zustand";

/**
 * Estado de la barra lateral.
 * - Escritorio (≥1024px): expandida (empuja el contenido) o contraída (solo íconos). Se recuerda.
 * - Móvil: contraída como riel de íconos; al expandir se superpone al contenido con fondo difuminado.
 */
interface UiState {
  expanded: boolean;
  ready: boolean;
  init: () => void;
  toggle: () => void;
  setExpanded: (value: boolean) => void;
}

const KEY = "zd_sidebar_expanded";
const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

export const useUiStore = create<UiState>((set, get) => ({
  expanded: false,
  ready: false,
  init: () => {
    if (get().ready) return;
    let value = false;
    if (isDesktop()) {
      const saved = window.localStorage.getItem(KEY);
      value = saved === null ? true : saved === "1";
    }
    set({ expanded: value, ready: true });
  },
  toggle: () => get().setExpanded(!get().expanded),
  setExpanded: (value) => {
    if (isDesktop()) window.localStorage.setItem(KEY, value ? "1" : "0");
    set({ expanded: value });
  },
}));
