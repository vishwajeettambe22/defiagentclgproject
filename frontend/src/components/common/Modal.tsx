import React, { useEffect } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "480px",
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(5, 7, 10, 0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="defi-card animate-fade-in"
        style={{
          width: "100%",
          maxWidth,
          backgroundColor: "var(--bg-surface-elevated)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-lg)",
          padding: 0,
          overflow: "hidden",
        }}
      >
        {title && (
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "18px",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: "var(--radius-sm)",
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--text-primary)")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text-muted)")}
            >
              ✕
            </button>
          </div>
        )}
        <div style={{ padding: "20px" }}>{children}</div>
      </div>
    </div>
  );
};

