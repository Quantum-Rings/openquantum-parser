import "jasmine";
import { parseString } from "../src/main";

type ExprNode = {
  constructor: { name: string };
  nodes?: ExprNode[];
  value?: string | number;
};

/** Flatten a QASM 2 parameter so a grouping paren shows up as a nested Expr. */
function paramShape(node: ExprNode): string {
  const name = node.constructor.name;
  if (name === "Expression") {
    return `Expr[${(node.nodes || []).map(paramShape).join(",")}]`;
  }
  if (name === "Variable") {
    return `Var(${node.value})`;
  }
  if (name === "Real" || name === "NNInteger") {
    return `${name}(${node.value})`;
  }
  if (name === "Pi") {
    return "Pi";
  }
  return name;
}

function qasm2Param(call: string): string {
  const qasm = [
    "OPENQASM 2.0;",
    'include "qelib1.inc";',
    "qreg q[1];",
    `${call} q[0];`,
  ].join("\n");
  const gate = parseString(qasm, 2).ast.find(
    (node) => node.constructor.name === "ApplyGate",
  ) as { params: ExprNode[] };
  return paramShape(gate.params[0]);
}

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
      "ryy(0.5) q[0],q[1];",
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
      "ryy",
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

  it("should parse a device gate that is not in the qelib1 list", () => {
    const qasm = [
      "OPENQASM 2.0;",
      'include "qelib1.inc";',
      "qreg q[1];",
      "prx(0.1, 0.2) q[0];",
    ].join("\n");
    const call = parseString(qasm, 2).ast.find(
      (node) => node.constructor.name === "ApplyGate",
    ) as { name: string };
    expect(call.name).toBe("prx");
  });

  it("should parse gate names that start with a keyword", () => {
    const qasm = [
      "OPENQASM 2.0;",
      'include "qelib1.inc";',
      "qreg q[1];",
      "qreg qreg_extra[1];",
      "creg creg_m[1];",
      "gate gate_Oracle a { x a; }",
      "gate gatex a { x a; }",
      "gate measure_x a { x a; }",
      "gate barrier_x a { x a; }",
      "opaque opaque_gate a;",
      "gate_Oracle q[0];",
    ].join("\n");
    const ast = parseString(qasm, 2).ast;
    const names = ast
      .filter((node) => node.constructor.name === "Gate" || node.constructor.name === "Opaque")
      .map((node) => (node as { name: string }).name);
    expect(names).toEqual([
      "gate_Oracle",
      "gatex",
      "measure_x",
      "barrier_x",
      "opaque_gate",
    ]);
    const call = ast.find(
      (node) =>
        node.constructor.name === "ApplyGate" &&
        (node as { name: string }).name === "gate_Oracle",
    ) as { qubits: Array<[string, number?]> };
    expect(call.qubits[0][0]).toBe("q");
  });

  it("should parse parenthesized parameter expressions", () => {
    const qasm = [
      "OPENQASM 2.0;",
      'include "qelib1.inc";',
      "qreg q[1];",
      "rz((0.5)) q[0];",
      "gate g(theta) a { ry((-0.5)*theta) a; }",
      "g(0.3) q[0];",
    ].join("\n");
    const ast = parseString(qasm, 2).ast;
    const rz = ast.find((node) => node.constructor.name === "ApplyGate" && (node as { name: string }).name === "rz") as {
      params: Array<{ constructor: { name: string }; value?: number }>;
    };
    expect(rz.params[0].constructor.name).toBe("Real");
    expect(rz.params[0].value).toBe(0.5);
    const gate = ast.find((node) => node.constructor.name === "Gate") as {
      nodes: Array<{ name?: string; params?: Array<{ constructor: { name: string }; nodes?: Array<{ constructor: { name: string } }> }> }>;
    };
    const ry = gate.nodes.find((node) => node.name === "ry");
    expect(ry.params[0].constructor.name).toBe("Expression");
    expect(ry.params[0].nodes[0].constructor.name).toBe("Expression");
  });

  it("keeps parentheses that group more than one parameter term", () => {
    // A parenthesized group of several tokens is its own Expression. Folding
    // and the QASM 2 to 3 unparser rely on that node to keep the grouping.
    expect(qasm2Param("rz((pi+0.1)/4)")).toBe(
      "Expr[Expr[Pi,Plus,Real(0.1)],Divide,NNInteger(4)]",
    );
    expect(qasm2Param("rx(pi/(4+0.1))")).toBe(
      "Expr[Pi,Divide,Expr[NNInteger(4),Plus,Real(0.1)]]",
    );
    expect(qasm2Param("ry(2*(pi/4))")).toBe(
      "Expr[NNInteger(2),Times,Expr[Pi,Divide,NNInteger(4)]]",
    );
    // No extra node: `*` and `/` stay one flat list, and `(pi)` is one term.
    expect(qasm2Param("rz(2*pi/4)")).toBe(
      "Expr[NNInteger(2),Times,Pi,Divide,NNInteger(4)]",
    );
    expect(qasm2Param("rz(-(pi)/4)")).toBe(
      "Expr[Minus,Pi,Divide,NNInteger(4)]",
    );
  });

  it("should treat a formal parameter named like a qelib1 gate as a variable", () => {
    const qasm = [
      "OPENQASM 2.0;",
      'include "qelib1.inc";',
      "qreg q[1];",
      "gate g(p) a { rz(p) a; }",
      "gate hgate(x) b { rx(x) b; }",
      "g(0.1) q[0];",
      "hgate(0.2) q[0];",
    ].join("\n");
    const ast = parseString(qasm, 2).ast;
    const gates = ast.filter((node) => node.constructor.name === "Gate") as Array<{
      name: string;
      nodes: Array<{ params: Array<{ constructor: { name: string }; value?: string }> }>;
    }>;
    expect(gates.map((gate) => gate.name)).toEqual(["g", "hgate"]);
    expect(gates[0].nodes[0].params[0].constructor.name).toBe("Variable");
    expect(gates[0].nodes[0].params[0].value).toBe("p");
    expect(gates[1].nodes[0].params[0].value).toBe("x");
  });

  it("still parses a statement-level gate when a formal uses that name", () => {
    const qasm = [
      "OPENQASM 2.0;",
      'include "qelib1.inc";',
      "qreg q[1];",
      "gate g(x) a { x a; rx(x) a; }",
      "g(0.1) q[0];",
    ].join("\n");
    const gate = parseString(qasm, 2).ast.find(
      (node) => node.constructor.name === "Gate",
    ) as {
      nodes: Array<{ name: string; qubits: Array<[string, number?]>; params: Array<{ constructor: { name: string }; value?: string }> }>;
    };
    expect(gate.nodes[0].name).toBe("x");
    expect(gate.nodes[0].qubits[0][0]).toBe("a");
    expect(gate.nodes[0].params ?? []).toEqual([]);
    expect(gate.nodes[1].name).toBe("rx");
    expect(gate.nodes[1].params[0].constructor.name).toBe("Variable");
    expect(gate.nodes[1].params[0].value).toBe("x");
  });
});

describe("QASM 3 gate names versus assignments", () => {
  const qubit = "OPENQASM 3.0;\nqubit[1] q;\n";

  function assignmentTarget(source: string): string {
    const assignment = parseString(source, 3).ast.find(
      (node) => node.constructor.name === "AssignmentStatement",
    ) as { leftValue: { name: string } };
    return assignment.leftValue.name;
  }

  // The parser has no gate list. Assignment syntax is an assignment for every
  // name, including stdgates names, file-declared gates, and native ops.
  ["x", "h", "U", "u", "gphase", "cnot", "prx", "myg"].forEach((name) => {
    it(`parses ${name} = 1 as an assignment`, () => {
      const source =
        name === "myg"
          ? `${qubit}gate myg a { x a; }\nmyg = 1;`
          : `${qubit}${name} = 1;`;
      expect(assignmentTarget(source)).toBe(name);
    });
  });

  it("parses a bare gphase call and a U call", () => {
    const gphase = parseString("OPENQASM 3.0;\ngphase(pi);", 3).ast.find(
      (node) => node.constructor.name === "QuantumGateCall",
    ) as { quantumGateName: { name: string } };
    expect(gphase.quantumGateName.name).toBe("gphase");

    const u = parseString(`${qubit}U(0.1, 0.2, 0.3) q[0];`, 3).ast.find(
      (node) => node.constructor.name === "QuantumGateCall",
    ) as { quantumGateName: { name: string } };
    expect(u.quantumGateName.name).toBe("U");
  });

  it("parses a compound assignment to any name", () => {
    const assignment = parseString(`${qubit}h += 1;`, 3).ast.find(
      (node) => node.constructor.name === "AssignmentStatement",
    );
    expect(assignment).toBeDefined();
  });

  it("parses an indexed array assignment onto the array name", () => {
    const ast = parseString(
      "OPENQASM 3.0;\narray[int[32], 4] arr = {1, 2, 3, 4};\narr[2] = 99;",
      3,
    ).ast;
    const assignment = ast.find(
      (node) => node.constructor.name === "AssignmentStatement",
    ) as { leftValue: { array: { name: string } } };
    expect(assignment.leftValue.constructor.name).toBe("ArrayAccess");
    expect(assignment.leftValue.array.name).toBe("arr");
  });

  it("keeps an include in the AST and parses an unknown name as a gate call", () => {
    const ast = parseString(
      'OPENQASM 3.0;\ninclude "stdgates.inc";\nqubit[1] q;\nonly_native(0.1, 0.2) q[0];',
      3,
    ).ast;
    const include = ast.find((node) => node.constructor.name === "Include") as {
      filename: string;
    };
    expect(include.filename).toBe('"stdgates.inc"');
    const call = ast.find(
      (node) => node.constructor.name === "QuantumGateCall",
    ) as { quantumGateName: { name: string } };
    expect(call.quantumGateName.name).toBe("only_native");
  });

  it("parses a declared subroutine call and leaves an unknown call as a gate", () => {
    const ast = parseString(
      "OPENQASM 3.0;\ndef foo(int x) { return x; }\nfoo(1);\n",
      3,
    ).ast;
    const call = ast.find((node) => node.constructor.name === "SubroutineCall");
    expect(call).toBeDefined();

    const unknown = parseString("OPENQASM 3.0;\nqubit[1] q;\nnot_a_gate q[0];", 3).ast.find(
      (node) => node.constructor.name === "QuantumGateCall",
    ) as { quantumGateName: { name: string } };
    expect(unknown.quantumGateName.name).toBe("not_a_gate");
  });

  it("parses a measurement assignment onto any name", () => {
    const measurement = parseString(`${qubit}x = measure q[0];`, 3).ast.find(
      (node) => node.constructor.name === "QuantumMeasurementAssignment",
    );
    expect(measurement).toBeDefined();
  });

  it("parses a classical assignment whose name is not a gate", () => {
    const ast = parseString("OPENQASM 3.0;\nint count = 0;\ncount = 1;", 3).ast;
    const assignment = ast.find(
      (node) => node.constructor.name === "AssignmentStatement",
    ) as { leftValue: { name: string } };
    expect(assignment.leftValue.name).toBe("count");
  });

  it("parses a measurement assignment whose target is not a gate", () => {
    const ast = parseString(
      "OPENQASM 3.0;\nqubit[1] q;\nbit c;\nc = measure q[0];",
      3,
    ).ast;
    expect(
      ast.some((node) => node.constructor.name === "QuantumMeasurementAssignment"),
    ).toBe(true);
    expect(
      ast.some((node) => node.constructor.name === "AssignmentStatement"),
    ).toBe(false);
  });

  it("parses a known gate call and an unknown name with call shape", () => {
    const known = parseString(`${qubit}x q[0];`, 3).ast.find(
      (node) => node.constructor.name === "QuantumGateCall",
    ) as { quantumGateName: { name: string } };
    expect(known.quantumGateName.name).toBe("x");

    const unknown = parseString(`${qubit}prx(0.1, 0.2) q[0];`, 3).ast.find(
      (node) => node.constructor.name === "QuantumGateCall",
    ) as { quantumGateName: { name: string } };
    expect(unknown.quantumGateName.name).toBe("prx");
  });
});
