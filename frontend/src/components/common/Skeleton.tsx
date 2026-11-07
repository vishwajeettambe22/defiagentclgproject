import React from "react";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = "20px",
  borderRadius = "var(--radius-sm)",
  style,
}) => {
  return (
    <div
      className="animate-pulse"
      style={{
        width,
        height,
        backgroundColor: "var(--bg-surface-active)",
        borderRadius,
        ...style,
      }}
    />
  );
};

