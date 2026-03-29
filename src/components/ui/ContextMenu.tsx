"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MenuItem =
  | {
      label: string;
      onClick: () => void;
      variant?: "destructive";
      disabled?: boolean;
      hidden?: boolean;
    }
  | { separator: true };

type Props = {
  items: MenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
};

export function ContextMenu({ items, position, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleScroll = () => onClose();

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const menu = menuRef.current;

    if (rect.right > window.innerWidth) {
      menu.style.left = `${position.x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${position.y - rect.height}px`;
    }
  }, [position]);

  if (!mounted) return null;

  const visibleItems = items.filter(
    (item) => !("hidden" in item && item.hidden),
  );

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] animate-slide-up rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: position.x, top: position.y }}
    >
      {visibleItems.map((item) => {
        if ("separator" in item) {
          return (
            <div
              key="separator"
              className="my-1 border-t border-zinc-200 dark:border-zinc-700"
            />
          );
        }

        return (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors ${
              item.variant === "destructive"
                ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            } ${item.disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
