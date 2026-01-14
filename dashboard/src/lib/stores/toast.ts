import { writable } from "svelte/store";

export interface ToastMessage {
  id: number;
  message: string;
  type: "info" | "success" | "error" | "warning";
  duration: number;
}

let nextId = 0;

function createToastStore() {
  const { subscribe, update } = writable<ToastMessage[]>([]);

  function add(message: string, type: ToastMessage["type"] = "info", duration = 4000): number {
    const id = nextId++;
    const toast: ToastMessage = { id, message, type, duration };

    update((toasts) => [...toasts, toast]);

    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }

    return id;
  }

  function remove(id: number): void {
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  function clear(): void {
    update(() => []);
  }

  return {
    subscribe,
    add,
    remove,
    clear,
  };
}

export const toasts = createToastStore();

// Convenience functions
export function addToast(message: string, type: ToastMessage["type"] = "info", duration = 4000): number {
  return toasts.add(message, type, duration);
}

export function removeToast(id: number): void {
  toasts.remove(id);
}
