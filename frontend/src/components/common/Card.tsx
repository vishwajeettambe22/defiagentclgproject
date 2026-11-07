import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  elevated = false,
  hoverable = false,
  className = "",
  style,
  ...props
}) => {
  const classes = [
    "defi-card",
    elevated ? "defi-card-elevated" : "",
    hoverable ? "defi-card-hover" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style} {...props}>
      {children}
    </div>
  );
};

