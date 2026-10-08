import "jasmine";
import { parseString } from "../src/main";
import { BadGateError } from "../src/errors";

describe("parser edge cases", () => {
  it("should parse inline physical qubit declarations", () => {
    const qasm = "OPENQASM 3.0; qubit q = $0;";
    expect(() => parseString(qasm, 3)).not.toThrow();
  });

  it("should parse C-style extern signatures", () => {
    const qasm = "OPENQASM 3.0; extern double my_random();";
    expect(() => parseString(qasm, 3)).not.toThrow();
  });

  it("should parse unknown native gates with array index operands", () => {
    const qasm = "OPENQASM 3.0; qubit[1] q; my_native_gate q[0];";
    expect(() => parseString(qasm, 3)).not.toThrow();
  });

  it("should accept id and the Qiskit and QASMBench qelib1 gates in QASM 2", () => {
    const qasm = [
      "OPENQASM 2.0;",
      'include "qelib1.inc";',
      "qreg q[5];",
      "id q[0];",
      "u0(1) q[0];",
      "rxx(0.5) q[0],q[1];",
      "rzz(0.5) q[0],q[2];",
      "rccx q[0],q[1],q[2];",
      "rc3x q[0],q[1],q[2],q[3];",
      "c3x q[0],q[1],q[2],q[3];",
      "c3sqrtx q[0],q[1],q[2],q[3];",
      "c4x q[0],q[1],q[2],q[3],q[4];",
      "u(0.1,0.2,0.3) q[0];",
      "p(0.5) q[1];",
      "sx q[0];",
      "sxdg q[1];",
      "cp(0.25) q[0],q[1];",
      "csx q[0],q[1];",
      "cu(0.1,0.2,0.3,0.4) q[0],q[1];",
    ].join("\n");
    const names = parseString(qasm, 2).ast
      .filter((node) => node.constructor.name === "ApplyGate")
      .map((node) => (node as { name: string }).name);
    expect(names).toEqual([
      "id",
      "u0",
      "rxx",
      "rzz",
      "rccx",
      "rc3x",
      "c3x",
      "c3sqrtx",
      "c4x",
      "u",
      "p",
      "sx",
      "sxdg",
      "cp",
      "csx",
      "cu",
    ]);
  });

  it("should reject a bare ryy call in QASM 2", () => {
    const qasm = [
      "OPENQASM 2.0;",
      'include "qelib1.inc";',
      "qreg q[2];",
      "ryy(0.5) q[0],q[1];",
    ].join("\n");
    expect(() => parseString(qasm, 2)).toThrowError(BadGateError);
  });
});
