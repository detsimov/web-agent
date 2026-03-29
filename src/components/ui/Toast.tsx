"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: number;
  message: string;
  action?: ToastAction;
  duration: number;
  createdAt: number;
};

type ToastContextValue = {
  showToast: (opts: {
    message: string;
    action?: ToastAction;
    duration?: number;
  }) => number;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (opts: { message: string; action?: ToastAction; duration?: number }) => {
      const id = nextId++;
      const duration = opts.duration ?? 5000;
      setToasts((prev) => [
        ...prev,
        {
          id,
          message: opts.message,
          action: opts.action,
          duration,
          createdAt: Date.now(),
        },
      ]);
      return id;
    },
    [],
  );

  return (
    <ToastContext value={{ showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col-reverse gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 200);
    }, toast.duration);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, toast.duration, onDismiss]);

  const handleAction = () => {
    clearTimeout(timerRef.current);
    toast.action?.onClick();
    onDismiss(toast.id);
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-full bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900 ${
        exiting ? "animate-fade-out" : "animate-slide-up"
      }`}
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={handleAction}
          className="font-medium text-blue-400 hover:text-blue-300 dark:text-blue-600 dark:hover:text-blue-700"
        >
          {toast.action.label}
        </button>
      )}
      <div
        className="absolute bottom-0 left-0 h-0.5 rounded-full bg-white/30 dark:bg-zinc-900/30"
        style={{
          animation: `shrink ${toast.duration}ms linear forwards`,
        }}
      />
    </div>
  );
}
