/**
 * Copyright 2026 Quantum Rings.
 * Licensed under the Apache License, Version 2.0.
 */

import "jasmine";
import { parseString } from "../src/main";

// Builds a circuit with `n` single-qubit gate statements.
function longCircuit(version: 2 | 3, n: number): string {
  const header =
    version === 2
      ? 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[4];\n'
      : 'OPENQASM 3.0;\ninclude "stdgates.inc";\nqubit[4] q;\n';
  const body: string[] = [];
  for (let i = 0; i < n; i++) body.push(`h q[${i % 4}];`);
  return header + body.join("\n") + "\n";
}

// Parse time must grow roughly linearly with the number of statements.
// Building the AST by copying the whole array for every statement made it
// quadratic: 100k statements took several seconds instead of ~0.1 s.
describe("parse performance", () => {
  const n = 100_000;
  const limitMs = 2000;

  for (const version of [2, 3] as const) {
    it(`parses ${n} QASM ${version} statements in under ${limitMs} ms`, () => {
      const src = longCircuit(version, n);
      const start = Date.now();
      const { ast } = parseString(src, version);
      const elapsed = Date.now() - start;
      expect(ast.length).toBeGreaterThanOrEqual(n);
      expect(elapsed).toBeLessThan(limitMs);
    });
  }
});
