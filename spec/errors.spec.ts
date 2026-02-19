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
  BadQuantumInstructionError
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

    it("should throw BadGateError", () => {
      const code = `OPENQASM 2.0;
qreg q[1];
unknown q[0];`;
      expect(() => parseString(code, 2)).toThrowError(BadGateError);
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
  });
});