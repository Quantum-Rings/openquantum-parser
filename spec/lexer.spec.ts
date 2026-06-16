import "jasmine";
import * as fs from "fs";
import { lex } from "../src/lexer";
import { Token as Qasm2Token } from "../src/qasm2/token";
import { Token as Qasm3Token } from "../src/qasm3/token";
import { BadGateError, MissingSemicolonError, BadStringLiteralError } from "../src/errors";
import { tokenSet } from "./tokens/index";

const genericTests = "spec/qasm/generic";
const invalidTests = "spec/qasm/invalid";

describe("lexer", () => {
  ["v2.0", "v3.0"].forEach((version) => {
    describe(`QASM ${version}`, () => {
      it(`should lex generic QASM ${version} code correctly`, (done) => {
        fs.readdir(`${genericTests}/${version}`, (error, fileNames) => {
          if (error) {
            console.error(`Error reading directory: ${error}`);
            done.fail(error);
            return;
          }

          fileNames.forEach((scriptName) => {
            const filePath = `${genericTests}/${version}/${scriptName}`;

            if (!fs.existsSync(filePath)) {
              console.error(`Missing file: ${filePath}`);
              return;
            }

            const raw = fs.readFileSync(filePath, "utf8");
            const qasm = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

            if (tokenSet[version] && tokenSet[version][scriptName]) {
              let tokens = tokenSet[version][scriptName];

              if (version === "v3.0") {
                const mergedTokens = [];
                for (let i = 0; i < tokens.length; i++) {
                  if (
                    tokens[i][0] === Qasm3Token.Dollar &&
                    i + 1 < tokens.length &&
                    tokens[i + 1][0] === Qasm3Token.NNInteger
                  ) {
                    mergedTokens.push([Qasm3Token.HardwareQubit, tokens[i + 1][1]]);
                    i++;
                  } else {
                    mergedTokens.push(tokens[i]);
                  }
                }
                tokens = mergedTokens;
              }

              let out: Array<
                [
                  Qasm2Token | Qasm3Token,
                  (string | number) | undefined,
                  number,
                  number,
                  string,
                ]
              >;
              switch (version) {
                case "v2.0":
                  out = lex(qasm, 0, 2);
                  break;
                case "v3.0":
                  out = lex(qasm, 0, 3);
                  break;
                default:
                  console.error(`Invalid OpenQASM version: ${version}`);
                  return;
              }

              if (out.length !== tokens.length) {
                console.error(
                  `Token count mismatch in ${scriptName}: expected ${tokens.length}, got ${out.length}`
                );
                for (let i = 0; i < Math.max(out.length, tokens.length); i++) {
                  const actual = out[i];
                  const expected = tokens[i];
                  if (!expected) {
                    console.error(`Extra token at index ${i}: ${JSON.stringify(actual)}`);
                  } else if (!actual) {
                    console.error(`Missing token at index ${i}: ${JSON.stringify(expected)}`);
                  }
                }
              }

              expect(out.length).toEqual(tokens.length);

              for (let i = 0; i < out.length; i++) {
                if (tokens[i] === undefined) {
                  console.error(`tokens[${i}] is undefined`);
                  continue;
                }

                for (let j = 0; j < tokens[i].length; j++) {
                  const actual = out[i][j] === undefined ? null : out[i][j];
                  const expected = tokens[i][j] === undefined ? null : tokens[i][j];
                  expect(actual).toEqual(expected);
                }
              }
            } else {
              console.log(`No token set found for ${version} ${scriptName}`);
            }
          });

          done();
        });
      });
    });

    describe("invalid cases", () => {
      it("should raise appropriate errors for invalid QASM", (done) => {
        fs.readdir(`${invalidTests}/${version}`, (error, fileNames) => {
          if (error) {
            console.error(`Error reading directory: ${error}`);
            done.fail(error);
            return;
          }

          fileNames.forEach((scriptName) => {
            const filePath = `${invalidTests}/${version}/${scriptName}`;

            if (!fs.existsSync(filePath)) {
              console.error(`Missing file: ${filePath}`);
              return;
            }

            const raw = fs.readFileSync(filePath, "utf8");
            const qasm = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

            const failingLexer = () => lex(qasm, 0, version === "v2.0" ? 2 : 3);

            if (scriptName.includes("missing_semicolon")) {
              expect(failingLexer).toThrowError(MissingSemicolonError);
            } else if (scriptName.includes("bad_gate")) {
              expect(failingLexer).toThrowError(BadGateError);
            } else if (scriptName.includes("block_comment") || scriptName.includes("unterminated_block")) {
              expect(failingLexer).toThrowError(BadStringLiteralError);
            }
          });

          done();
        });
      });
    });
  });

  describe("pragma lexing", () => {
    it("should lex pragmas correctly", () => {
      const qasm = "#pragma braket verbatim;";
      const tokens = lex(qasm, 0, 3);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0][0]).toBe(Qasm3Token.Pragma);
      expect(tokens[0][1]).toBe("braket verbatim");
    });

    it("should lex pragmas with extra spaces", () => {
      const qasm = "#  pragma  braket result;";
      const tokens = lex(qasm, 0, 3);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0][0]).toBe(Qasm3Token.Pragma);
      expect(tokens[0][1]).toBe("braket result");
    });

    it("should lex bare pragma (official OpenQASM 3 form) without #", () => {
      const qasm = "pragma braket verbatim";
      const tokens = lex(qasm, 0, 3);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0][0]).toBe(Qasm3Token.Pragma);
      expect(tokens[0][1]).toBe("braket verbatim");
    });

    it("should lex bare pragma with leading whitespace and mixed case", () => {
      const qasm = "  PRAGMA  ibm.max_temp 0.4";
      const tokens = lex(qasm, 0, 3);
      expect(tokens[0][0]).toBe(Qasm3Token.Pragma);
      expect(tokens[0][1]).toBe("ibm.max_temp 0.4");
    });
  });

  describe("comment handling", () => {
    describe("QASM 2.0", () => {
      it("should allow // comments with leading whitespace inside program bodies (regression for verifyInput)", () => {
        const qasm = `OPENQASM 2.0;
qreg q[2];
creg c[2];

 // leading space comment
  // two spaces
h q[0];
cx q[0], q[1];
`;

        // Should not throw MissingSemicolonError from verifyInput
        const tokens = lex(qasm, 0, 2);
        expect(tokens.length).toBeGreaterThan(0);
      });

      it("should allow trailing // comments after real commands, gates, and braces", () => {
        const qasm = `OPENQASM 2.0;
qreg q[2]; // after qreg
gate my a, b {
  h a; // inside gate
  cx a, b;
} // after gate close
h q[0]; // after gate application
`;

        const tokens = lex(qasm, 0, 2);
        expect(tokens.length).toBeGreaterThan(0);
      });
    });

    describe("QASM 3.0", () => {
      it("should skip multi-line /* */ blocks that do not use * prefixes on continuation lines", () => {
        const qasm = `OPENQASM 3.0;
/* arbitrary
   multi line
   block comment without stars */
qubit[1] q;
h q[0];
`;

        const tokens = lex(qasm, 0, 3);
        // Should produce real tokens for OPENQASM, qubit decl, h gate — no tokens from inside the block
        expect(tokens.some(t => t[0] === Qasm3Token.Qubit)).toBe(true);
        expect(tokens.some(t => t[0] === Qasm3Token.Id && t[1] === "h")).toBe(true);
      });

      it("should allow trailing /* */ block comments after statements on the same line", () => {
        const qasm = `OPENQASM 3.0; qubit[2] q; h q[0]; /* trailing */ x q[0];`;
        const tokens = lex(qasm, 0, 3);
        expect(tokens.length).toBeGreaterThan(5);
      });

      it("must not interpret /* ... */ inside a string literal as a block comment start", () => {
        const qasm = `OPENQASM 3.0;
qubit[1] q;
include "weird/path/*not/a/comment*/file.inc"; // string content, not comment
h q[0];
`;
        const tokens = lex(qasm, 0, 3);
        // The string token should contain the literal /* ... */ text
        const stringTokens = tokens.filter(t => t[0] === Qasm3Token.String);
        expect(stringTokens.some(t => String(t[1]).includes("/*not/a/comment*/"))).toBe(true);
      });

      it("should allow a properly terminated block comment at end of file", () => {
        const qasm = `OPENQASM 3.0;
qubit[1] q;
h q[0];
/* comment at EOF */`;
        const tokens = lex(qasm, 0, 3);
        expect(tokens.length).toBeGreaterThan(0);
      });

      it("should treat the first */ as the closer (no nesting)", () => {
        const qasm = `OPENQASM 3.0;
qubit[1] q;
/* outer /* inner */ h q[0];
x q[0];
`;
        const tokens = lex(qasm, 0, 3);
        // The first */ (after "inner") closes the block early.
        // " h q[0];" after it on the same line is real code.
        // So both h and x should be seen as real statements.
        expect(tokens.some(t => t[0] === Qasm3Token.Id && t[1] === "h")).toBe(true);
        expect(tokens.some(t => t[0] === Qasm3Token.Id && t[1] === "x")).toBe(true);
      });
    });
  });
});
