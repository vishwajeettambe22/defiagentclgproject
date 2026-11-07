/**
 * ValidationStatus component.
 * NFR-01: Explainable, evidence-linked validation outcomes.
 * Shows each individual check with its result and reason.
 */

import React from "react";
import type { ValidationResult } from "../../types";

interface Props { validation: ValidationResult; }

export function ValidationStatus({ validation }: Props) {
  const passed = validation.overall_status === "passed";

  return (
    <div style={{ ...styles.container, borderColor: passed ? "#238636" : "#da3633" }}>
      <div style={styles.header}>
        <span style={{ ...styles.badge, background: passed ? "#238636" : "#da3633" }}>
          {passed ? "✓ VALIDATION PASSED" : "✗ VALIDATION FAILED"}
        </span>
        <span style={styles.summary}>{validation.human_readable_summary}</span>
      </div>

      <div style={styles.checks}>
        {validation.checks.map((check) => (
          <div key={check.check_name} style={styles.checkRow}>
            <span style={{ color: check.passed ? "#3fb950" : "#f85149", fontSize: 14 }}>
              {check.passed ? "✓" : "✗"}
            </span>
            <div>
              <div style={styles.checkName}>{check.check_name}</div>
              {check.reason && <div style={styles.checkReason}>{check.reason}</div>}
            </div>
          </div>
        ))}
      </div>

      {!passed && validation.failure_reasons.length > 0 && (
        <div style={styles.failures}>
          <strong>Blocked because:</strong>
          <ul style={{ margin: "6px 0 0 16px" }}>
            {validation.failure_reasons.map((r, i) => (
              <li key={i} style={{ color: "#ffa198", fontSize: 13, marginTop: 4 }}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#161b22", border: "1px solid", borderRadius: 12, padding: 20,
  },
  header: { marginBottom: 16 },
  badge: {
    display: "inline-block", padding: "4px 10px", borderRadius: 6,
    fontSize: 12, fontWeight: 700, color: "white", marginBottom: 8,
  },
  summary: { display: "block", fontSize: 13, color: "#8b949e", lineHeight: 1.5 },
  checks: { display: "flex", flexDirection: "column", gap: 10 },
  checkRow: { display: "flex", gap: 10, alignItems: "flex-start" },
  checkName: { fontSize: 13, fontWeight: 600, color: "#e6edf3" },
  checkReason: { fontSize: 12, color: "#6e7681", marginTop: 2 },
  failures: {
    marginTop: 16, padding: 12, background: "#1c1010",
    borderRadius: 8, border: "1px solid #da3633",
  },
};
