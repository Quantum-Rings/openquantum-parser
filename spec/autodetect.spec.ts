import { parseString } from '../src/main';
import { QReg, Gate } from '../src/qasm2/ast';
import { QuantumDeclaration } from '../src/qasm3/ast';

describe('OpenQASM Version Autodetection', () => {
  it('autodetects OpenQASM 2.0 from header', () => {
    const source = `OPENQASM 2.0;
qreg q[2];
creg c[2];
h q[0];`;

    const result = parseString(source);
    const ast = result.ast;

    expect(result.version).toBe(2);
    // Verify we got QASM 2 AST nodes (QReg is specific to QASM 2 AST in this parser)
    const hasQReg = ast.some((node: any) => node instanceof QReg);
    expect(hasQReg).toBe(true);
  });

  it('autodetects OpenQASM 3.0 from header', () => {
    const source = `OPENQASM 3.0;
qubit[2] q;
bit[2] c;`;

    const result = parseString(source);
    const ast = result.ast;

    expect(result.version).toBe(3);
    // Verify we got QASM 3 AST nodes (QuantumDeclaration is specific to QASM 3 AST)
    const hasQuantumDecl = ast.some((node: any) => node instanceof QuantumDeclaration);
    expect(hasQuantumDecl).toBe(true);
  });

  it('autodetects OpenQASM 3.1 from header', () => {
    const source = `OPENQASM 3.1;
qubit[2] q;
bit[2] c;`;

    const result = parseString(source);
    const ast = result.ast;

    expect(result.version).toBe(3);
    // Verify we got QASM 3 AST nodes (QuantumDeclaration is specific to QASM 3 AST)
    const hasQuantumDecl = ast.some((node: any) => node instanceof QuantumDeclaration);
    expect(hasQuantumDecl).toBe(true);
  });

  it('defaults to OpenQASM 3.0 when header is missing', () => {
    const source = `qubit[2] q;`;

    const result = parseString(source);
    const ast = result.ast;

    expect(result.version).toBe(3);
    // Should parse as QASM 3 by default
    const hasQuantumDecl = ast.some((node: any) => node instanceof QuantumDeclaration);
    expect(hasQuantumDecl).toBe(true);
  });

  it('handles leading whitespace and comments before header', () => {
    const source = `// Some comment
    OPENQASM 2.0;
qreg q[1];`;

    const result = parseString(source);
    const ast = result.ast;

    expect(result.version).toBe(2);
    const hasQReg = ast.some((node: any) => node instanceof QReg);
    expect(hasQReg).toBe(true);
  });
});