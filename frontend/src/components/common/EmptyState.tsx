import React from "react";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "📭",
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: "36px", marginBottom: "14px" }}>{icon}</div>
      <h4 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
        {title}
      </h4>
      {description && (
        <p style={{ fontSize: "14px", color: "var(--text-muted)", maxWidth: "340px", marginBottom: "18px" }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

