import { parseString } from '../src/main';
import { PragmaStatement } from '../src/qasm3/ast';

describe('Pragma parsing', () => {
  it('parses pragma without semicolon', () => {
    const source = `OPENQASM 3.0;
#pragma braket verbatim
qubit[2] q;`;

    const result = parseString(source);
    const ast = result.ast;

    const pragmaNode = ast.find((node: any) => node instanceof PragmaStatement);
    expect(pragmaNode).toBeDefined();
    expect(pragmaNode.name).toBe('braket');
    expect(pragmaNode.command).toBe('verbatim');
  });

  it('parses pragma with semicolon', () => {
    const source = `OPENQASM 3.0;
#pragma braket verbatim;
qubit[2] q;`;

    const result = parseString(source);
    const ast = result.ast;

    const pragmaNode = ast.find((node: any) => node instanceof PragmaStatement);
    expect(pragmaNode).toBeDefined();
    expect(pragmaNode.name).toBe('braket');
    expect(pragmaNode.command).toBe('verbatim');
  });

  it('parses complex Amazon Braket pragmas with math, matrices, and hardware qubits', () => {
    const source = `OPENQASM 3.0;
#pragma braket noise bit_flip(0.2) q[0]
#pragma braket result adjoint_gradient expectation(2.2 * x[0] @ x[1]) all
#pragma braket result variance hermitian([[0, -1im], [1im, 0]]) $0
qubit[2] q;`;

    const result = parseString(source);
    const ast = result.ast;

    const pragmaNodes = ast.filter((node: any) => node instanceof PragmaStatement);
    expect(pragmaNodes.length).toBe(3);
    
    expect(pragmaNodes[0].name).toBe('braket');
    expect(pragmaNodes[0].command).toBe('noise bit_flip(0.2) q[0]');
    expect(pragmaNodes[1].name).toBe('braket');
    expect(pragmaNodes[1].command).toBe('result adjoint_gradient expectation(2.2 * x[0] @ x[1]) all');
    expect(pragmaNodes[2].name).toBe('braket');
    expect(pragmaNodes[2].command).toBe('result variance hermitian([[0, -1im], [1im, 0]]) $0');
  });

  it('parses # pragma with a space and without semicolon', () => {
    const source = `OPENQASM 3.0;
# pragma braket verbatim
qubit[2] q;`;

    const result = parseString(source);
    const ast = result.ast;

    const pragmaNode = ast.find((node: any) => node instanceof PragmaStatement);
    expect(pragmaNode).toBeDefined();
    expect(pragmaNode.name).toBe('braket');
    expect(pragmaNode.command).toBe('verbatim');
  });

  it('parses bare pragma (official OpenQASM 3 spec form) without #', () => {
    const source = `OPENQASM 3.0;
pragma braket verbatim
qubit[2] q;`;

    const result = parseString(source);
    const ast = result.ast;

    const pragmaNode = ast.find((node: any) => node instanceof PragmaStatement);
    expect(pragmaNode).toBeDefined();
    expect(pragmaNode.name).toBe('braket');
    expect(pragmaNode.command).toBe('verbatim');
  });
});