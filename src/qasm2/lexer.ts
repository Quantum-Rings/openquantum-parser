/**
 * Modified by Quantum Rings, 2026.
 * Derived from qasm-ts (https://github.com/comp-phys-marc/qasm-ts), Apache-2.0.
 */

/**
 * OpenQASM 2.0 Lexical Analyzer
 *
 * This module implements the lexer for OpenQASM 2.0, which provides a simpler
 * token set compared to OpenQASM 3.0. The lexer focuses on basic quantum circuit
 * constructs without the advanced classical programming features of version 3.0.
 *
 * Key characteristics of OpenQASM 2.0 lexing:
 * - **Limited token set**: Basic quantum and classical registers only
 * - **Simple operators**: Basic arithmetic and comparison operators
 * - **No control flow**: No tokens for loops, conditionals, or functions
 * - **Gate-focused**: Emphasis on gate definitions and applications
 * - **Mathematical functions**: Built-in math functions (sin, cos, etc.)
 *
 * Supported constructs:
 * - Quantum registers (`qreg`) and classical registers (`creg`)
 * - Gate definitions and applications
 * - Measurements with arrow notation (`->`)
 * - Basic arithmetic expressions for gate parameters
 * - Include statements for library files
 *
 * @module
 *
 * @example OpenQASM 2.0 lexing
 * ```typescript
 * const lexer = new Lexer('qreg q[2]; h q[0]; measure q -> c;');
 * const tokens = lexer.lex();
 * // Produces tokens for register declaration, gate, and measurement
 * ```
 */

import { Token, lookup } from "./token";
import {
  BadEqualsError,
  MissingSemicolonError,
  UnsupportedOpenQASMVersionError,
  BadStringLiteralError,
  ReturnErrorConstructor,
} from "../errors";

/**
 * Handles throwing lexer errors with basic stack trace.
 * @param error - The error to throw.
 * @param number - The line number in the source code.
 * @param code - The source code that the error is about.
 */
function throwLexerError(
  error: ReturnErrorConstructor,
  line: number,
  column: number,
  code: string,
  message?: string,
) {
  throw new error(message || "Lexer error", line, column, code);
}

/**
 * Returns whether a given character could be an element of a numeric value.
 * @param c - The character.
 * @return Whether the character is numeric.
 */
function isNumeric(c: string): boolean {
  if (c === undefined || c.length === 0) return false;
  if (c.length === 1) {
    const code = c.charCodeAt(0);
    return code === 46 || code === 69 || code === 95 || code === 101 || (code >= 48 && code <= 57);
  }
  return !isNaN(parseInt(c));
}

/**
 * Returns whether a given character is a letter.
 * @param c - The character.
 * @param matchCase - Whether to check for a letter that is upper case, lower case, or either. (optional)
 * @return Whether the character is a letter.
 */
function isLetter(c: string, matchCase?: "upper" | "lower"): boolean {
  if (c === undefined || c.length !== 1) return false;
  const code = c.charCodeAt(0);
  switch (matchCase) {
    case "upper":
      return code >= 65 && code <= 90;
    case "lower":
      return code >= 97 && code <= 122;
    default:
      return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
  }
}

/**
 * Returns whether a given character is unicode.
 * @param c - The character.
 * @param excludePi - Whether to exclude the Pi symbol from consideration.
 * @return - Whether the given character is valid unicode.
 */
function isUnicode(c: string, excludePi?: boolean): boolean {
  if (c === undefined) return false;
  const isBasicUnicode = /^\u0000-\u00ff/.test(c);
  switch (excludePi) {
    case true:
      return isBasicUnicode && c !== "\u03C0";
    case false:
      return isBasicUnicode;
    default:
      return isBasicUnicode;
  }
}

/**
 * Returns whether a given character is alphanumeric.
 * @param c - The character.
 * @return Whether the character is alphanumeric.
 */
function isAlphaCode(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAlpha(c: string): boolean {
  if (c === undefined || c.length === 0) return false;
  if (c.length === 1) return isAlphaCode(c.charCodeAt(0));
  for (let i = 0; i < c.length; i++) {
    if (!isAlphaCode(c.charCodeAt(i))) return false;
  }
  return true;
}

/**
 * Returns whether a given character is a newline character.
 * @param c - The character.
 * @return Whether the character is a newline.
 */
function isNewline(c: string): boolean {
  if (c === undefined) return false;
  return /\n|\r(?!\n)|\u2028|\u2029|\r\n/.test(c);
}

/** Space, tab, newline, carriage return, and vertical tab. */
function isSkippedWhitespace(code: number): boolean {
  return code === 9 || code === 10 || code === 11 || code === 13 || code === 32;
}

/**
 * OpenQASM 2.0 Lexical Analyzer
 *
 * A simpler lexer implementation focused on the core quantum circuit description
 * features of OpenQASM 2.0. This lexer handles the essential constructs needed
 * for basic quantum programming without the complexity of classical programming
 * language features.
 *
 * @example Basic OpenQASM 2.0 tokenization
 * ```typescript
 * const source = `
 *   OPENQASM 2.0;
 *   include "qelib1.inc";
 *   qreg q[2];
 *   creg c[2];
 *   h q[0];
 *   cx q[0],q[1];
 *   measure q -> c;
 * `;
 *
 * const lexer = new Lexer(source);
 * const tokens = lexer.lex();
 * ```
 */
class Lexer {
  /** The string to lex. */
  input: string;
  /** The lexer's current cursor location. */
  cursor: number;
  /** Cached lines from input. */
  private lines: string[];
  /** Starting indices of each line. */
  private lineStartIndices: number[];
  /** 1-based line containing `cursor`. */
  private lineNumber = 1;
  /** Index of the first character on `lineNumber`. */
  private lineStart = 0;

  /**
   * Creates a lexer.
   * @param input - The string to lex.
   * @param cursor - The starting cursor position.
   */
  constructor(input: string, cursor: number = 0) {
    this.input = input;
    this.cursor = 0;
    this.lines = this.input.split(/\n|\r(?!\n)|\u2028|\u2029|\r\n/);
    this.lineStartIndices = [0];
    const regex = /\n|\r(?!\n)|\u2028|\u2029|\r\n/g;
    let match;
    while ((match = regex.exec(this.input)) !== null) {
      this.lineStartIndices.push(match.index + match[0].length);
    }
    if (cursor > 0) this.consumeTo(cursor);
  }

  /**
   * Verifies that all appropriate lines end with a semicolon.
   * @return A tuple of the status and if False, returns the problematic line.
   */
  verifyInput = (): [boolean, number | null, string | null] => {
    for (let i = 0; i < this.lines.length; i++) {
      const trimmedLine = this.lines[i].trim();
      if (trimmedLine.startsWith("//")) {
        continue; // line comment (supported in OpenQASM 2.0)
      }
      // Strip trailing // comments (only comment form supported in QASM 2.0)
      // so "} // foo", "gate x { // bar", "h q[0]; // cmt" etc. are still valid.
      const noComment = trimmedLine.split("//")[0].trim();
      if (
        !(noComment.length == 0) &&
        !noComment.includes("gate") &&
        !(noComment == "{" || noComment == "}") &&
        !noComment.includes(";")
      ) {
        return [false, i + 1, this.lines[i]];
      }
    }
    return [true, null, null];
  };

  /**
   * Calling this method lexes the code represented by the provided string.
   * @return An array of tokens and their corresponding values.
   */
  lex = (): Array<[Token, (number | string) | undefined, number, number, string]> => {
    const tokens: Array<[Token, (number | string) | undefined, number, number, string]> = [];
    let token: [Token, (number | string) | undefined, number, number, string];
    const verifyInputResult = this.verifyInput();
    if (!verifyInputResult[0]) {
      const lineText = verifyInputResult[2] ?? "";
      throwLexerError(
        MissingSemicolonError,
        verifyInputResult[1],
        lineText.trimEnd().length + 1,
        lineText,
        "Missing semicolon",
      );
    }
    while (this.cursor < this.input.length) {
      token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }
    if (tokens.length === 0 || tokens[tokens.length - 1][0] !== Token.EndOfFile) {
      tokens.push(this.endOfFileToken());
    }
    return tokens;
  };

  /**
   * Moves the cursor forward and counts newlines crossed on the way.
   * A CRLF pair counts as one line break, including when the two characters
   * are consumed by separate calls.
   */
  private consumeTo = (next: number): void => {
    const from = this.cursor;
    if (next > from) this.noteNewlines(from, next);
    this.cursor = next;
  };

  private noteNewlines = (from: number, to: number): void => {
    const input = this.input;
    let i = from;
    while (i < to) {
      const code = input.charCodeAt(i);
      if (code === 10 || code === 0x2028 || code === 0x2029) {
        this.lineNumber++;
        i++;
        this.lineStart = i;
      } else if (code === 13) {
        if (i + 1 < to && input.charCodeAt(i + 1) === 10) {
          this.lineNumber++;
          i += 2;
          this.lineStart = i;
        } else if (i + 1 === to && i + 1 < input.length && input.charCodeAt(i + 1) === 10) {
          i++;
        } else {
          this.lineNumber++;
          i++;
          this.lineStart = i;
        }
      } else {
        i++;
      }
    }
  };

  /**
   * Reads a character and advances the cursor.
   * @param num - Optional cursor position modifier.
   */
  readChar = (num: number = 1): string => {
    const from = this.cursor;
    this.consumeTo(from + num);
    return this.input[from];
  };

  /**
   * Advances the cusor past the next comment.
   */
  skipComment = () => {
    let char = "";
    while (this.cursor < this.input.length && !isNewline(char)) {
      char = this.readChar();
    }
  };

  /**
   * Determines whether the next character to process equals a given character.
   * @param c - The given character.
   * @return Whether the next character equals the given character.
   */
  peekEq = (c: string): boolean => this.peek() == c;

  /**
   * Reads a character without advancing the cursor.
   * @param index - Optional peek position offset.
   */
  peek = (): string => this.input[this.cursor];

  /**
   * Reads a numeric value.
   * @return The numeric value as a string.
   */
  readNumeric = (): string => {
    let num = "";
    let char = this.peek();
    while (this.cursor < this.input.length && (isNumeric(char) || char === "e" || char === "E")) {
      num += this.readChar();
      if ((char === "e" || char === "E") && (this.peek() === "-" || this.peek() === "+")) {
        num += this.readChar();
      }
      char = this.peek();
    }
    return num;
  };

  /**
   * Reads an identifier.
   * @return The identifier as a string.
   */
  readIdentifier = (): string => {
    let id = "";
    let next = this.peek();
    while (this.cursor < this.input.length && (isAlpha(next) || next == "_" || isUnicode(next))) {
      id += this.readChar();
      next = this.peek();
    }
    return id;
  };

  /**
   * Reads a string literal.
   * @param terminator - The literal's termination character.
   * @return The literal as a string.
   */
  readStringLiteral = (terminator: string): string => {
    let lit = "";
    let char = "";
    while (true) {
      if (this.cursor >= this.input.length) {
        throwLexerError(
          BadStringLiteralError,
          this.getLineNumber(this.cursor),
          this.getColumnNumber(this.cursor),
          this.getCurrentLine(this.cursor),
          "Unterminated string literal",
        );
      }
      char = this.readChar();
      lit += char;
      if (char === terminator) break;
    }
    return lit;
  };

  /**
   * Advances the cusor past the next block of whitespace.
   */
  skipWhitespace = (): null => {
    const input = this.input;
    const n = input.length;
    let cursor = this.cursor;
    while (cursor < n && isSkippedWhitespace(input.charCodeAt(cursor))) {
      cursor++;
    }
    this.consumeTo(cursor);
    return null;
  };

  /**
   * Returns the column number where the current cursor is located.
   * @param cursor - The current cursor position in the input string.
   * @return The column number.
   */
  getColumnNumber = (cursor: number): number => {
    const lineIndex = this.getLineNumber(cursor) - 1;
    const lineStart = this.lineStartIndices[lineIndex];
    return cursor - lineStart + 1;
  };

  /**
   * End-of-file token at the insertion point after the last non-whitespace
   * character. A trailing newline is not its own location: the semicolon
   * belongs on the line that still has code.
   */
  private endOfFileToken = (): [Token, undefined, number, number, string] => {
    let cursor = this.input.length;
    while (cursor > 0 && isSkippedWhitespace(this.input.charCodeAt(cursor - 1))) {
      cursor -= 1;
    }
    if (cursor === 0) {
      return [Token.EndOfFile, undefined, 1, 1, this.lines[0] ?? ""];
    }
    const line = this.getLineNumber(cursor - 1);
    const lineIndex = line - 1;
    const lineStart = this.lineStartIndices[lineIndex] ?? 0;
    return [
      Token.EndOfFile,
      undefined,
      line,
      cursor - lineStart + 1,
      this.lines[lineIndex] ?? "",
    ];
  };

  /**
   * Lexes the next token.
   * @return The next token and its corresponding value.
   */
  nextToken = (): [Token, (number | string) | undefined, number, number, string] => {
    this.skipWhitespace();
    const line = this.lineNumber;
    const col = this.cursor - this.lineStart + 1;
    const lineText = this.lines[line - 1];

    if (this.cursor == this.input.length) {
      return this.endOfFileToken();
    }

    const char = this.peek();
    this.readChar();

    let result: [Token, (number | string)?];

    switch (char) {
      case "=":
        if (this.peekEq("=")) {
          this.readChar();
          result = [Token.Equals];
        } else {
          throwLexerError(
            BadEqualsError,
            this.getLineNumber(this.cursor),
            this.getColumnNumber(this.cursor),
            this.getCurrentLine(this.cursor),
            "Unexpected token. Expected '=='",
          );
          break;
        }
        break;
      case "-":
        if (this.peekEq(">")) {
          this.readChar();
          result = [Token.Arrow];
        } else {
          result = [Token.Minus];
        }
        break;
      case "+":
        result = [Token.Plus];
        break;
      case "*":
        result = [Token.Times];
        break;
      case "^":
        result = [Token.Power];
        break;
      case ";":
        result = [Token.Semicolon];
        break;
      case ",":
        result = [Token.Comma];
        break;
      case "(":
        result = [Token.LParen];
        break;
      case "[":
        result = [Token.LSParen];
        break;
      case "{":
        result = [Token.LCParen];
        break;
      case ")":
        result = [Token.RParen];
        break;
      case "]":
        result = [Token.RSParen];
        break;
      case "}":
        result = [Token.RCParen];
        break;
      case "/":
        if (this.peekEq("/")) {
          this.skipComment();
          return;
        } else if (this.peekEq("*")) {
          // Block comments (/* */) are not part of the OpenQASM 2.0 specification.
          // Only // line comments are supported.
          throwLexerError(
            BadStringLiteralError,
            this.getLineNumber(this.cursor),
            this.getColumnNumber(this.cursor),
            this.getCurrentLine(this.cursor),
            "Block comments (/* */) are not supported in OpenQASM 2.0 (only // line comments are)",
          );
        } else {
          result = [Token.Divide];
        }
        break;
      case "g":
        if (
          this.input[this.cursor] == "a" &&
          this.input[this.cursor + 1] == "t" &&
          this.input[this.cursor + 2] == "e"
        ) {
          this.readChar(3);
          result = [Token.Gate];
        } else {
          const literal = char + this.readIdentifier();
          result = [lookup(literal), literal];
        }
        break;
      case "q":
        if (
          this.input[this.cursor] == "r" &&
          this.input[this.cursor + 1] == "e" &&
          this.input[this.cursor + 2] == "g"
        ) {
          this.readChar(3);
          result = [Token.QReg];
        } else {
          const qregLit = char + this.readIdentifier();
          result = [lookup(qregLit), qregLit];
        }
        break;
      case "c":
        if (
          this.input[this.cursor] == "r" &&
          this.input[this.cursor + 1] == "e" &&
          this.input[this.cursor + 2] == "g"
        ) {
          this.readChar(3);
          result = [Token.CReg];
        } else {
          const cregLit = char + this.readIdentifier();
          result = [lookup(cregLit), cregLit];
        }
        break;
      case "b":
        if (
          this.input[this.cursor] == "a" &&
          this.input[this.cursor + 1] == "r" &&
          this.input[this.cursor + 2] == "r" &&
          this.input[this.cursor + 3] == "i" &&
          this.input[this.cursor + 4] == "e" &&
          this.input[this.cursor + 5] == "r"
        ) {
          this.readChar(6);
          result = [Token.Barrier];
        } else {
          const barLit = char + this.readIdentifier();
          result = [lookup(barLit), barLit];
        }
        break;
      case "m":
        if (
          this.input[this.cursor] == "e" &&
          this.input[this.cursor + 1] == "a" &&
          this.input[this.cursor + 2] == "s" &&
          this.input[this.cursor + 3] == "u" &&
          this.input[this.cursor + 4] == "r" &&
          this.input[this.cursor + 5] == "e"
        ) {
          this.readChar(6);
          result = [Token.Measure];
        } else {
          const measureLit = char + this.readIdentifier();
          result = [lookup(measureLit), measureLit];
        }
        break;
      case "O":
        if (
          this.input[this.cursor].toLowerCase() == "p" &&
          this.input[this.cursor + 1].toLowerCase() == "e" &&
          this.input[this.cursor + 2].toLowerCase() == "n" &&
          this.input[this.cursor + 3] == "Q" &&
          this.input[this.cursor + 4] == "A" &&
          this.input[this.cursor + 5] == "S" &&
          this.input[this.cursor + 6] == "M"
        ) {
          this.readChar(7);
          let offset = 0;
          while (
            this.cursor + offset < this.input.length &&
            " \t".indexOf(this.input[this.cursor + offset]) > -1
          ) {
            offset++;
          }

          // Read the major version
          let majorVersion = "";
          while (
            this.cursor + offset < this.input.length &&
            !isNaN(parseInt(this.input[this.cursor + offset], 10))
          ) {
            majorVersion += this.input[this.cursor + offset];
            offset++;
          }

          // Attempt to read the minor version
          let minorVersion: string | undefined = undefined;
          if (this.input[this.cursor + offset] == ".") {
            offset++;
            minorVersion = "";
            while (
              this.cursor + offset < this.input.length &&
              !isNaN(parseInt(this.input[this.cursor + offset], 10))
            ) {
              minorVersion += this.input[this.cursor + offset];
              offset++;
            }
          }

          // Parse major and minor versions
          const major = parseInt(majorVersion, 10);
          const minor = minorVersion ? parseInt(minorVersion, 10) : undefined;

          if (major !== 2) {
            throw new UnsupportedOpenQASMVersionError(
              `Unsupported OpenQASM version detected: ${majorVersion}.${minor ?? 0}`,
              this.getLineNumber(this.cursor),
              this.getColumnNumber(this.cursor),
              this.getCurrentLine(this.cursor),
            );
          }

          result = [Token.OpenQASM];
        } else {
          const openQasmLit = char + this.readIdentifier();
          result = [lookup[openQasmLit], openQasmLit];
        }
        break;
      case "i":
        if (
          this.input[this.cursor] == "n" &&
          this.input[this.cursor + 1] == "c" &&
          this.input[this.cursor + 2] == "l" &&
          this.input[this.cursor + 3] == "u" &&
          this.input[this.cursor + 4] == "d" &&
          this.input[this.cursor + 5] == "e"
        ) {
          this.readChar(6);
          result = [Token.Include];
        } else {
          const includeLit = char + this.readIdentifier();
          result = [lookup(includeLit), includeLit];
        }
        break;
      case "o":
        if (
          this.input[this.cursor] == "p" &&
          this.input[this.cursor + 1] == "a" &&
          this.input[this.cursor + 2] == "q" &&
          this.input[this.cursor + 3] == "u" &&
          this.input[this.cursor + 4] == "e"
        ) {
          this.readChar(5);
          result = [Token.Opaque];
        } else {
          const opaqueLit = char + this.readIdentifier();
          result = [lookup(opaqueLit), opaqueLit];
        }
        break;
      case '"': {
        const stringLiteral = char + this.readStringLiteral('"');
        result = [Token.String, stringLiteral];
        break;
      }
      case "’": {
        const singleStringLiteral = char + this.readStringLiteral("’");
        result = [Token.String, singleStringLiteral];
        break;
      }
      default:
        if (isLetter(char)) {
          const literal = char + this.readIdentifier();
          result = [lookup(literal), literal];
        } else if (isNumeric(char)) {
          const num = char + this.readNumeric();
          if (num.indexOf("e") != -1 || num.indexOf("E") != -1) {
            result = [Token.Real, parseFloat(num)];
          } else if (num.indexOf(".") != -1) {
            result = [Token.Real, parseFloat(num)];
          } else {
            result = [Token.NNInteger, parseFloat(num)];
          }
        } else {
          result = [Token.Illegal];
        }
    }
    if (result) {
      return [result[0], result[1], line, col, lineText];
    }
  };

  /**
   * Returns the line number where the current cursor is located.
   * @param cursor - The current cursor position in the input string.
   * @return The line number.
   */
  getLineNumber = (cursor: number): number => {
    let low = 0;
    let high = this.lineStartIndices.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.lineStartIndices[mid] <= cursor) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return low;
  };

  /**
   * Returns the current line of code where the cursor is located.
   * @param cursor - The current cursor position in the input string.
   * @return The specific line where the cursor is located.
   */
  getCurrentLine = (cursor: number): string => {
    const lineNumber = this.getLineNumber(cursor);
    return this.lines[lineNumber - 1];
  };
}
export default Lexer;
