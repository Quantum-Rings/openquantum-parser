import { parseString } from "../src/main";
import { lex } from "../src/lexer";
import { MissingSemicolonError } from "../src/errors";
import { Token } from "../src/qasm3/token";

const statement = "b[1] = measure q[1];sd x";
const circuit = [
  "OPENQASM 3.0;",
  "bit[2] b;",
  "qubit[2] q;",
  "h q[0];",
  "cnot q[0], q[1];",
  "b[0] = measure q[0];",
  statement,
].join("\n");

function missingSemicolon(source: string, version = 3): MissingSemicolonError {
  try {
    parseString(source, version);
  } catch (err) {
    expect(err).toBeInstanceOf(MissingSemicolonError);
    return err as MissingSemicolonError;
  }
  fail("expected MissingSemicolonError");
}

describe("missing semicolon location", () => {
  ["", "\n", "\n\n"].forEach((suffix) => {
    const label = suffix.length === 0 ? "no trailing newline" : `${suffix.length} trailing newline(s)`;

    it(`points expected semicolon at the end of the statement with ${label}`, () => {
      const error = missingSemicolon(circuit + suffix);
      expect(error.line).toBe(7);
      expect(error.column).toBe(statement.length + 1);
      expect(error.sourceLine).toBe(statement);
      expect(error.message.startsWith("expected semicolon")).toBeTrue();
    });
  });

  it("parses the same circuit once the statement is terminated", () => {
    const fixed = circuit.replace(/sd x$/, "sd x;");
    const lengths = ["", "\n", "\n\n"].map((suffix) => parseString(fixed + suffix, 3).ast.length);
    expect(lengths[0]).toBeGreaterThan(0);
    expect(lengths[1]).toBe(lengths[0]);
    expect(lengths[2]).toBe(lengths[0]);
  });

  it("points a line with no semicolon at the end of that line", () => {
    const line = "qubit[1] q";
    let caught: unknown;
    try {
      lex(`OPENQASM 3.0;\n${line}\nh q[0];\n`, 0, 3);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MissingSemicolonError);
    const error = caught as MissingSemicolonError;
    expect(error.line).toBe(2);
    expect(error.column).toBe(line.length + 1);
    expect(error.sourceLine).toBe(line);
  });

  it("keeps the end-of-file token on the last line of code", () => {
    const source = "OPENQASM 3.0;";
    const tokens = lex(source + "\n\n", 0, 3);
    const eof = tokens[tokens.length - 1];
    expect(eof[0]).toBe(Token.EndOfFile);
    expect(eof[2]).toBe(1);
    expect(eof[3]).toBe(source.length + 1);
    expect(eof[4]).toBe(source);
    expect(tokens.filter((token) => token[0] === Token.EndOfFile).length).toBe(1);
  });
});
