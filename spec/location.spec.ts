import { parseString } from '../src/main';

describe('AST Location Tracking', () => {
  it('should track line and column numbers in QASM 2', () => {
    const qasm = 'OPENQASM 2.0;\nqreg q[2];\nh q[0];';
    const { ast } = parseString(qasm, 2);
    
    expect(ast[0].line).toBe(1);
    expect(ast[0].column).toBe(1);
    
    expect(ast[1].line).toBe(2);
    expect(ast[1].column).toBe(1);
    
    expect(ast[2].line).toBe(3);
    expect(ast[2].column).toBe(1);
  });

  it('should track line and column numbers in QASM 3', () => {
    const qasm = 'OPENQASM 3.0;\nqubit[2] q;\nh q[0];';
    const { ast } = parseString(qasm, 3);
    
    expect(ast[0].line).toBe(1);
    expect(ast[0].column).toBe(1);
    
    expect(ast[1].line).toBe(2);
    expect(ast[1].column).toBe(1);
    
    expect(ast[2].line).toBe(3);
    expect(ast[2].column).toBe(1);
  });
});