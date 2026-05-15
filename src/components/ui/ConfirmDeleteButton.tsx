"use client";

import { useEffect, useState, type ReactNode } from "react";

const ARM_MS = 4000;

export type ConfirmDeleteButtonProps = {
  onConfirm: () => void;
  children?: ReactNode;
  confirmLabel?: string;
  className?: string;
  confirmClassName?: string;
  disabled?: boolean;
};

export function ConfirmDeleteButton({
  onConfirm,
  children = "Удалить",
  confirmLabel = "Подтвердить удаление",
  className = "text-[11px] text-app-fg/55 transition hover:text-red-400",
  confirmClassName = "text-[11px] font-medium text-red-400",
  disabled = false,
}: ConfirmDeleteButtonProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), ARM_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      className={armed ? confirmClassName : className}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
