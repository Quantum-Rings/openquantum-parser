import "jasmine";
import { basename } from "path";
import * as fs from "fs";
import { astSet } from "./asts";
import { tokenSet } from "./tokens";
import { parse } from "../src/parser";
import { AstNode as AstNode2 } from "../src/qasm2/ast";
import { AstNode as AstNode3 } from "../src/qasm3/ast";
import { parseString, unparse } from "../src/main";
import { Expression } from "../src/qasm2/ast";

const genericTests = "spec/tokens/generic";

function normalizeV2Ast(node: any): any {
  if (Array.isArray(node)) {
    return node.map(normalizeV2Ast);
  } else if (node && typeof node === 'object') {
    if (node.type === 'ApplyGate' || node.constructor.name === 'ApplyGate') {
      if (Array.isArray(node.params)) {
        node.params = node.params.map((p: any) => {
          if (Array.isArray(p)) {
            const flattened = p.map(normalizeV2Ast).flat();
            if (flattened.length === 1) return flattened[0];
            if (flattened.length > 1) {
              return new Expression(flattened, flattened[0]?.line, flattened[0]?.column);
            }
          }
          return normalizeV2Ast(p);
        });
      }
    }
    if (node.type === 'Gate' || node.constructor.name === 'Gate') {
      if (Array.isArray(node.nodes)) {
        node.nodes = node.nodes.map(normalizeV2Ast).flat();
      }
    }
    if (node.type === 'If' || node.constructor.name === 'If') {
      if (Array.isArray(node.gate) && node.gate.length === 1) {
        node.gate = normalizeV2Ast(node.gate[0]);
      } else {
        node.gate = normalizeV2Ast(node.gate);
      }
    }
    for (const key of Object.keys(node)) {
      if (key !== 'params' && key !== 'nodes' && key !== 'gate') {
        node[key] = normalizeV2Ast(node[key]);
      }
    }
  }
  return node;
}

describe("parser", () => {
  ["v2.0", "v3.0"].forEach((version) => {
    describe(`QASM ${version}`, () => {
      it(`should parse generic QASM ${version} tokens correctly`, (done) => {
        fs.readdir(`${genericTests}/${version}`, (error, fileNames) => {
          if (error) {
            console.error(`Error reading directory: ${error}`);
            done.fail(error);
            return;
          }
          fileNames.forEach((scriptName) => {
            if (astSet[version] && astSet[version][scriptName]) {
              const tokens =
                tokenSet[version][`${basename(scriptName, ".ts")}.qasm`];
              const ast = astSet[version][scriptName];

              let out: Array<AstNode2 | AstNode3>;
              switch (version) {
                case "v2.0":
                  out = parse(tokens, 2);
                  break;
                case "v3.0":
                  out = parse(tokens, 3);
                  break;
                default:
                  console.error(`Invalid OpenQASM version: ${version}`);
                  return;
              }

              expect(out.length).toEqual(ast.length);

              for (let i = 0; i < out.length; i++) {
                if (version === "v2.0") {
                  expect(normalizeV2Ast(out[i])).toEqual(normalizeV2Ast(ast[i]));
                } else {
                  expect(out[i]).toEqual(ast[i]);
                }
              }
            } else {
              console.log(`No AST set found for ${version} ${scriptName}`);
            }
          });
          done();
        });
      });
    });
  });
});

describe('pragma support', () => {
  it('should parse #pragma (legacy) and unparse to official pragma form', () => {
    const qasm = 'OPENQASM 3.0;\n#pragma braket verbatim;';
    const result = parseString(qasm, 3);
    expect(result.ast.length).toBe(2);
    expect(result.ast[1].constructor.name).toBe('PragmaStatement');
    expect(result.ast[1].name).toBe('braket');
    expect(result.ast[1].command).toBe('verbatim');
    const unparsed = unparse(result.ast, 3);
    // Library emits the official OpenQASM 3 form (no #)
    expect(unparsed).toBe('OPENQASM 3.0;\npragma braket verbatim;');
  });

  it('should parse pragmas with only a name', () => {
    const qasm = 'OPENQASM 3.0;\n#pragma braket;';
    const result = parseString(qasm, 3);
    expect(result.ast.length).toBe(2);
    expect(result.ast[1].constructor.name).toBe('PragmaStatement');
    expect(result.ast[1].name).toBe('braket');
    expect(result.ast[1].command).toBe('');
    const unparsed = unparse(result.ast, 3);
    expect(unparsed).toBe('OPENQASM 3.0;\npragma braket;');
  });

  it('should parse pragmas with multiple command words', () => {
    const qasm = 'OPENQASM 3.0;\n#pragma braket result noise;';
    const result = parseString(qasm, 3);
    expect(result.ast.length).toBe(2);
    expect(result.ast[1].constructor.name).toBe('PragmaStatement');
    expect(result.ast[1].name).toBe('braket');
    expect(result.ast[1].command).toBe('result noise');
    const unparsed = unparse(result.ast, 3);
    expect(unparsed).toBe('OPENQASM 3.0;\npragma braket result noise;');
  });

  it('should parse pragmas with no semicolon', () => {
    const qasm = 'OPENQASM 3.0;\n#pragma braket verbatim\nqubit q;';
    const result = parseString(qasm, 3);
    expect(result.ast.length).toBe(3);
    expect(result.ast[1].constructor.name).toBe('PragmaStatement');
    expect(result.ast[1].name).toBe('braket');
    expect(result.ast[1].command).toBe('verbatim');
  });
});

describe('bug fixes', () => {
  it('should parse rx, ry, rz in QASM 2.0', () => {
    const qasm = `OPENQASM 2.0;
qreg q[1];
rx(pi) q[0];
ry(pi/2) q[0];
rz(0.1) q[0];`;
    const result = parseString(qasm, 2);
    expect(result.ast.length).toBe(5);
  });

  it('should properly register opaque gates in QASM 2.0', () => {
    const qasm = `OPENQASM 2.0;
qreg q[1];
opaque my_gate q;
my_gate q[0];`;
    // Should not throw BadGateError
    const result = parseString(qasm, 2);
    expect(result.ast.length).toBe(4);
  });

  it('should parse u gate in QASM 3.0', () => {
    const qasm = `OPENQASM 3.0;
qubit q;
u(pi, pi/2, 0) q;`;
    const result = parseString(qasm, 3);
    expect(result.ast.length).toBe(3);
  });

  it('should parse if-else blocks without missing semicolon bug', () => {
    const qasm = `OPENQASM 3.0;
qubit q;
bit c;
if (c == 1) {
  x q;
} else {
  y q;
}`;
    const result = parseString(qasm, 3);
    expect(result.ast.length).toBe(4);
  });
});
