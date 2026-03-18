import "jasmine";
import { parseString } from "../src/main";
import { Barrier } from "../src/qasm2/ast";
import { QuantumBarrier, Identifier, SubscriptedIdentifier, AstNode } from "../src/qasm3/ast";

describe("Barrier Statements", () => {
  describe("QASM 2.0", () => {
    it("should parse multiple qubits in a barrier", () => {
      const code = `OPENQASM 2.0;
qreg q[2];
barrier q[0], q[1];`;
      const ast = parseString(code, 2) as any[];
      const barrier = ast.find((node) => node instanceof Barrier) as Barrier;
      
      expect(barrier).toBeDefined();
      expect(barrier.qubits.length).toBe(2);
      expect(barrier.qubits[0]).toEqual(["q", 0]);
      expect(barrier.qubits[1]).toEqual(["q", 1]);
    });

    it("should parse full register in a barrier", () => {
      const code = `OPENQASM 2.0;
qreg q[2];
barrier q;`;
      const ast = parseString(code, 2) as any[];
      const barrier = ast.find((node) => node instanceof Barrier) as Barrier;
      
      expect(barrier).toBeDefined();
      expect(barrier.qubits.length).toBe(1);
      expect(barrier.qubits[0]).toEqual(["q", undefined]);
    });
  });

  describe("QASM 3.0", () => {
    it("should parse an empty barrier", () => {
      const code = `OPENQASM 3.0;
barrier;`;
      const ast = parseString(code, 3) as AstNode[];
      const barrier = ast.find((node) => node instanceof QuantumBarrier) as QuantumBarrier;
      
      expect(barrier).toBeDefined();
      expect(barrier.qubits.length).toBe(0);
    });

    it("should parse multiple qubits in a barrier", () => {
      const code = `OPENQASM 3.0;
qubit[2] q;
barrier q[0], q[1];`;
      const ast = parseString(code, 3) as AstNode[];
      const barrier = ast.find((node) => node instanceof QuantumBarrier) as QuantumBarrier;
      
      expect(barrier).toBeDefined();
      expect(barrier.qubits.length).toBe(2);
      expect(barrier.qubits[0] instanceof SubscriptedIdentifier).toBe(true);
      expect((barrier.qubits[0] as SubscriptedIdentifier).name).toBe("q");
      expect(barrier.qubits[1] instanceof SubscriptedIdentifier).toBe(true);
      expect((barrier.qubits[1] as SubscriptedIdentifier).name).toBe("q");
    });

    it("should parse full register in a barrier", () => {
      const code = `OPENQASM 3.0;
qubit[2] q;
barrier q;`;
      const ast = parseString(code, 3) as AstNode[];
      const barrier = ast.find((node) => node instanceof QuantumBarrier) as QuantumBarrier;
      
      expect(barrier).toBeDefined();
      expect(barrier.qubits.length).toBe(1);
      expect(barrier.qubits[0] instanceof Identifier).toBe(true);
      expect((barrier.qubits[0] as Identifier).name).toBe("q");
    });
  });
});