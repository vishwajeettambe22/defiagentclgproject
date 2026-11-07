import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  dot = false,
  className = "",
  style,
  ...props
}) => {
  return (
    <span
      className={`defi-badge defi-badge-${variant} ${className}`.trim()}
      style={style}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "currentColor",
          }}
        />
      )}
      {children}
    </span>
  );
};

