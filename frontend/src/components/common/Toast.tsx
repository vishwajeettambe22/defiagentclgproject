import React, { useState, createContext, useContext, useCallback } from "react";

interface ToastItem {
  id: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
}

interface ToastContextType {
  toast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          zIndex: 10000,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-fade-in"
            style={{
              padding: "12px 18px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-surface-elevated)",
              border: `1px solid ${
                t.type === "success"
                  ? "var(--status-success)"
                  : t.type === "error"
                  ? "var(--status-danger)"
                  : t.type === "warning"
                  ? "var(--status-warning)"
                  : "var(--border-default)"
              }`,
              color: "var(--text-primary)",
              fontSize: "14px",
              fontWeight: 500,
              boxShadow: "var(--shadow-lg)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              pointerEvents: "auto",
              minWidth: "260px",
            }}
          >
            <span>
              {t.type === "success"
                ? "✓"
                : t.type === "error"
                ? "✕"
                : t.type === "warning"
                ? "⚠️"
                : "ℹ"}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

