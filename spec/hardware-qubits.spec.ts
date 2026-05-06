import "jasmine";
import { parseString } from "../src/main";
import {
  HardwareQubit,
  QuantumGateCall,
  QuantumMeasurementAssignment,
  QuantumReset,
  QuantumBarrier,
  QuantumDelay,
  Identifier,
  AstNode
} from "../src/qasm3/ast";

describe("Hardware Qubits", () => {
  describe("QASM 3.0", () => {
    it("should parse hardware qubits in gate calls", () => {
      const code = `
OPENQASM 3.0;
include "stdgates.inc";
rx(pi/2) $0;
`;
      const result = parseString(code, 3);
      const ast = result.ast as AstNode[];
      const gateCall = ast.find((node) => node instanceof QuantumGateCall) as QuantumGateCall;
      expect(gateCall).toBeDefined();
      expect(gateCall.qubits.length).toBe(1);
      expect(gateCall.qubits[0] instanceof HardwareQubit).toBe(true);
      expect((gateCall.qubits[0] as HardwareQubit).number).toBe(0);
    });

    it("should parse hardware qubits in measurements", () => {
      const code = `
OPENQASM 3.0;
bit[1] c;
c[0] = measure $1;
`;
      const result = parseString(code, 3);
      const ast = result.ast as AstNode[];
      const measure = ast.find((node) => node instanceof QuantumMeasurementAssignment) as QuantumMeasurementAssignment;
      expect(measure).toBeDefined();
      const qubit = measure.quantumMeasurement.identifierList[0];
      expect(qubit instanceof HardwareQubit).toBe(true);
      expect((qubit as HardwareQubit).number).toBe(1);
    });

    it("should parse hardware qubits in reset", () => {
      const code = `
OPENQASM 3.0;
reset $2;
`;
      const result = parseString(code, 3);
      const ast = result.ast as AstNode[];
      const reset = ast.find((node) => node instanceof QuantumReset) as QuantumReset;
      expect(reset).toBeDefined();
      expect(reset.identifier instanceof HardwareQubit).toBe(true);
      expect((reset.identifier as HardwareQubit).number).toBe(2);
    });

    it("should parse hardware qubits in barrier", () => {
      const code = `
OPENQASM 3.0;
barrier $0, $1;
`;
      const result = parseString(code, 3);
      const ast = result.ast as AstNode[];
      const barrier = ast.find((node) => node instanceof QuantumBarrier) as QuantumBarrier;
      expect(barrier).toBeDefined();
      expect(barrier.qubits.length).toBe(2);
      expect(barrier.qubits[0] instanceof HardwareQubit).toBe(true);
      expect((barrier.qubits[0] as HardwareQubit).number).toBe(0);
      expect(barrier.qubits[1] instanceof HardwareQubit).toBe(true);
      expect((barrier.qubits[1] as HardwareQubit).number).toBe(1);
    });

    it("should parse hardware qubits in delay", () => {
      const code = `
OPENQASM 3.0;
delay[10dt] $3;
`;
      const result = parseString(code, 3);
      const ast = result.ast as AstNode[];
      const delay = ast.find((node) => node instanceof QuantumDelay) as QuantumDelay;
      expect(delay).toBeDefined();
      expect(delay.qubits.length).toBe(1);
      expect(delay.qubits[0] instanceof HardwareQubit).toBe(true);
      expect((delay.qubits[0] as HardwareQubit).number).toBe(3);
    });

    it("should parse mixed hardware and virtual qubits in gate calls", () => {
      const code = `
OPENQASM 3.0;
include "stdgates.inc";
qubit q;
cx $0, q;
`;
      const result = parseString(code, 3);
      const ast = result.ast as AstNode[];
      const gateCall = ast.find((node) => node instanceof QuantumGateCall) as QuantumGateCall;
      expect(gateCall).toBeDefined();
      expect(gateCall.qubits.length).toBe(2);
      expect(gateCall.qubits[0] instanceof HardwareQubit).toBe(true);
      expect((gateCall.qubits[0] as HardwareQubit).number).toBe(0);
      expect(gateCall.qubits[1] instanceof Identifier).toBe(true);
      expect((gateCall.qubits[1] as Identifier).name).toBe('q');
    });
  });
});