import React from "react";

export const QRCode: React.FC<{ address: string; size?: number }> = ({ address, size = 180 }) => {
  // Generate deterministic grid pattern based on address characters
  const gridCells: boolean[][] = [];
  const gridSize = 21;
  const cleanHex = address.replace(/^0x/, "").padEnd(40, "0");

  for (let r = 0; r < gridSize; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < gridSize; c++) {
      // Standard QR position detection patterns (corners)
      const isTopLeft = r < 7 && c < 7;
      const isTopRight = r < 7 && c >= gridSize - 7;
      const isBottomLeft = r >= gridSize - 7 && c < 7;
      const isCenter = r >= 8 && r <= 12 && c >= 8 && c <= 12;

      if (isTopLeft) {
        row.push(r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      } else if (isTopRight) {
        row.push(r === 0 || r === 6 || c === gridSize - 7 || c === gridSize - 1 || (r >= 2 && r <= 4 && c >= gridSize - 5 && c <= gridSize - 3));
      } else if (isBottomLeft) {
        row.push(r === gridSize - 7 || r === gridSize - 1 || c === 0 || c === 6 || (r >= gridSize - 5 && r <= gridSize - 3 && c >= 2 && c <= 4));
      } else if (isCenter) {
        row.push(false); // Clean spot for logo
      } else {
        const charIdx = (r * gridSize + c) % cleanHex.length;
        const val = parseInt(cleanHex[charIdx], 16);
        row.push(val % 2 === 0);
      }
    }
    gridCells.push(row);
  }

  const cellSize = size / gridSize;

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: "#ffffff",
        padding: "16px",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {gridCells.map((row, r) =>
          row.map((active, c) =>
            active ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#0b0f17"
              />
            ) : null
          )
        )}
        {/* Center Ethereum Diamond Badge */}
        <circle cx={size / 2} cy={size / 2} r={cellSize * 2.5} fill="#0b0f17" />
        <path
          d={`M ${size / 2} ${size / 2 - 12} L ${size / 2 + 8} ${size / 2} L ${size / 2} ${size / 2 + 4} L ${size / 2 - 8} ${size / 2} Z`}
          fill="#6366f1"
        />
        <path
          d={`M ${size / 2} ${size / 2 + 6} L ${size / 2 + 8} ${size / 2 + 2} L ${size / 2} ${size / 2 + 12} L ${size / 2 - 8} ${size / 2 + 2} Z`}
          fill="#38bdf8"
        />
      </svg>
    </div>
  );
};

