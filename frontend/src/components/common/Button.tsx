import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  ...props
}) => {
  const variantClass = `defi-btn-${variant}`;
  const sizeClass = size === "sm" ? "defi-btn-sm" : size === "lg" ? "defi-btn-lg" : "";

  return (
    <button
      className={`defi-btn ${variantClass} ${sizeClass} ${className}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          style={{
            width: 16,
            height: 16,
            border: "2px solid rgba(255,255,255,0.25)",
            borderTopColor: "currentColor",
            borderRadius: "50%",
            display: "inline-block",
          }}
          className="animate-spin"
        />
      ) : icon ? (
        <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>
      ) : null}
      {children}
    </button>
  );
};

