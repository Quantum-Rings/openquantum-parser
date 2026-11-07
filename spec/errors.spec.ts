import "jasmine";
import { parseString } from "../src/main";
import {
  BadArgumentError,
  BadIncludeError,
  BadQregError,
  BadEqualsError,
  BadCregError,
  BadConditionalError,
  BadMeasurementError,
  BadGateError,
  BadParameterError,
  MissingSemicolonError,
  MissingBraceError,
  UnsupportedOpenQASMVersionError,
  BadStringLiteralError,
  BadClassicalTypeError,
  BadExpressionError,
  BadSubroutineError,
  BadLoopError,
  BadQuantumInstructionError,
  BadBarrierError
} from "../src/errors";

describe("Error Handling", () => {
  describe("QASM 2.0", () => {
    it("should throw MissingSemicolonError", () => {
      const code = `OPENQASM 2.0;
qreg q[1]`;
      expect(() => parseString(code, 2)).toThrowError(MissingSemicolonError);
    });

    it("should throw UnsupportedOpenQASMVersionError", () => {
      const code = `OPENQASM 1.0;`;
      expect(() => parseString(code, 2)).toThrowError(UnsupportedOpenQASMVersionError);
    });

    it("should throw BadStringLiteralError", () => {
      const code = `OPENQASM 2.0;
include "stdgates.inc;`;
      expect(() => parseString(code, 2)).toThrowError(BadStringLiteralError);
    });

    it("should throw BadQregError", () => {
      const code = `OPENQASM 2.0;
qreg q;`;
      expect(() => parseString(code, 2)).toThrowError(BadQregError);
    });

    it("should throw BadCregError", () => {
      const code = `OPENQASM 2.0;
creg c;`;
      expect(() => parseString(code, 2)).toThrowError(BadCregError);
    });

    it("should throw BadArgumentError", () => {
      const code = `OPENQASM 2.0;
qreg q[2];
cx 1;`;
      expect(() => parseString(code, 2)).toThrowError(BadArgumentError);
    });

    it("should parse a gate declaration with a non-qelib1 name", () => {
      const code = `OPENQASM 2.0;
qreg q[1];
gate X a { x a; }`;
      const result = parseString(code, 2);
      const gate = result.ast.find((node) => node.constructor.name === "Gate") as { name: string };
      expect(gate.name).toBe("X");
    });

    it("should throw BadGateError when a gate declaration has no name", () => {
      const code = `OPENQASM 2.0;
gate;`;
      expect(() => parseString(code, 2)).toThrowError(BadGateError, /expected gate name/);
    });

    it("should throw BadGateError when a gate declaration has no qubit", () => {
      const code = `OPENQASM 2.0;
gate foo { x foo; }`;
      expect(() => parseString(code, 2)).toThrowError(BadGateError, /expected qubit argument/);
    });

    it("should throw BadGateError when a gate qubit list misses a comma", () => {
      const code = `OPENQASM 2.0;
gate foo a b { x a; }`;
      expect(() => parseString(code, 2)).toThrowError(
        BadGateError,
        /expected comma or opening brace for gate body/,
      );
    });

    it("should throw BadGateError when an opaque declaration has no qubit", () => {
      const code = `OPENQASM 2.0;
opaque foo;`;
      expect(() => parseString(code, 2)).toThrowError(BadGateError, /expected qubit argument/);
    });

    it("should throw MissingSemicolonError when an opaque declaration has no semicolon", () => {
      const code = `OPENQASM 2.0;
opaque my_gate q`;
      expect(() => parseString(code, 2)).toThrowError(MissingSemicolonError);
    });

    it("should parse an unknown gate name", () => {
      const code = `OPENQASM 2.0;
qreg q[1];
unknown q[0];`;
      const result = parseString(code, 2);
      const call = result.ast.find((node) => node.constructor.name === "ApplyGate") as { name: string };
      expect(call.name).toBe("unknown");
    });

    it("should throw BadMeasurementError", () => {
      const code = `OPENQASM 2.0;
qreg q[1];
measure q[0];`;
      expect(() => parseString(code, 2)).toThrowError(BadMeasurementError);
    });

    it("should throw BadConditionalError", () => {
      const code = `OPENQASM 2.0;
qreg q[1];
creg c[1];
if (c) x q[0];`;
      expect(() => parseString(code, 2)).toThrowError(BadConditionalError);
    });

    it("should throw BadEqualsError", () => {
      const code = `OPENQASM 2.0;
qreg q[1];
creg c[1];
if (c = 1) x q[0];`;
      expect(() => parseString(code, 2)).toThrowError(BadEqualsError);
    });

    it("should throw MissingBraceError", () => {
      const code = `OPENQASM 2.0;
gate foo q {`;
      expect(() => parseString(code, 2)).toThrowError(MissingBraceError);
    });

    it("should throw BadIncludeError", () => {
      const code = `OPENQASM 2.0;
include;`;
      expect(() => parseString(code, 2)).toThrowError(BadIncludeError);
    });

    it("should throw BadBarrierError for empty barrier", () => {
      const code = `OPENQASM 2.0;
qreg q[1];
barrier;`;
      expect(() => parseString(code, 2)).toThrowError(BadBarrierError);
    });

    it("should throw BadArgumentError for trailing comma in barrier", () => {
      const code = `OPENQASM 2.0;
qreg q[2];
barrier q[0], ;`;
      expect(() => parseString(code, 2)).toThrowError(BadArgumentError);
    });

    it("should throw BadStringLiteralError for block comments (/* */) which are not supported in QASM 2.0", () => {
      const code = `OPENQASM 2.0;
qreg q[1];
h q[0]; /* not allowed in 2.0 */`;
      expect(() => parseString(code, 2)).toThrowError(BadStringLiteralError);
    });
  });

  describe("QASM 3.0", () => {
    it("should throw MissingSemicolonError", () => {
      const code = `OPENQASM 3.0;
bit c`;
      expect(() => parseString(code, 3)).toThrowError(MissingSemicolonError);
    });

    it("should throw BadClassicalTypeError", () => {
      const code = `OPENQASM 3.0;
complex[int] c;`;
      expect(() => parseString(code, 3)).toThrowError(BadClassicalTypeError);
    });

    it("should throw BadExpressionError", () => {
      const code = `OPENQASM 3.0;
bit c;
c = 1 +;`;
      expect(() => parseString(code, 3)).toThrowError(BadExpressionError);
    });

    it("should throw BadLoopError", () => {
      const code = `OPENQASM 3.0;
for int in [0:1] { }`;
      expect(() => parseString(code, 3)).toThrowError(BadLoopError);
    });

    it("should throw BadSubroutineError", () => {
      const code = `OPENQASM 3.0;
def (int a) { }`;
      expect(() => parseString(code, 3)).toThrowError(BadSubroutineError);
    });

    it("should throw BadQuantumInstructionError", () => {
      const code = `OPENQASM 3.0;
reset ;`;
      expect(() => parseString(code, 3)).toThrowError(BadQuantumInstructionError);
    });

    it("should throw BadParameterError", () => {
      const code = `OPENQASM 3.0;
gate mygate(a b) q { }`;
      expect(() => parseString(code, 3)).toThrowError(BadParameterError);
    });

    it("should throw BadExpressionError for trailing comma in barrier", () => {
      const code = `OPENQASM 3.0;
qubit[2] q;
barrier q[0], ;`;
      expect(() => parseString(code, 3)).toThrowError(BadExpressionError);
    });

    it("should throw BadStringLiteralError for unterminated block comment", () => {
      const code = `OPENQASM 3.0;
/* this block is never closed
qubit[1] q;
`;
      expect(() => parseString(code, 3)).toThrowError(BadStringLiteralError);
    });
  });
});