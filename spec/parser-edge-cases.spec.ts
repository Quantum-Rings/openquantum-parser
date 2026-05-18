import "jasmine";
import { parseString } from "../src/main";

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
});
