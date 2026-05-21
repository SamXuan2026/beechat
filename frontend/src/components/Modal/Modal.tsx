import type { ReactNode } from "react";
import "./Modal.css";

interface ModalProps {
  title: string;
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
}

export function Modal({ title, open, children, onClose }: ModalProps) {
  if (!open) return null;
  return (
    <>
      <div className="bc-modal-scrim" onClick={onClose} />
      <section aria-label={title} className="bc-modal" role="dialog">
        <header>
          <span />
          <strong>{title}</strong>
          {onClose ? (
            <button aria-label="关闭弹层" className="bc-modal-close" onClick={onClose} type="button">
              关闭
            </button>
          ) : (
            <span />
          )}
        </header>
        {children}
      </section>
    </>
  );
}
