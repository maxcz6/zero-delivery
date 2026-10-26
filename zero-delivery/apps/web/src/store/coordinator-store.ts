import { create } from "zustand";
import type { EstadoOperativoPedidoDb } from "@zero-delivery/shared-types";

export type CoordinatorModal =
  | { type: "yape"; pedidoId: string }
  | { type: "assign"; pedidoId: string }
  | { type: "restaurant"; pedidoId: string }
  | { type: "motivo"; pedidoId: string; nuevoEstado: EstadoOperativoPedidoDb }
  | null;

interface CoordinatorState {
  sucursalId: string | null;
  query: string;
  modal: CoordinatorModal;
  setSucursalId: (id: string | null) => void;
  setQuery: (q: string) => void;
  openModal: (modal: NonNullable<CoordinatorModal>) => void;
  closeModal: () => void;
}

export const useCoordinatorStore = create<CoordinatorState>((set) => ({
  sucursalId: null,
  query: "",
  modal: null,
  setSucursalId: (sucursalId) => set({ sucursalId }),
  setQuery: (query) => set({ query }),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
}));
