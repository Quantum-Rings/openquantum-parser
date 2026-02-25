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
  return c == "." || !isNaN(parseInt(c));
}

/**
 * Returns whether a given character is a letter.
 * @param c - The character.
 * @param matchCase - Whether to check for a letter that is upper case, lower case, or either. (optional)
 * @return Whether the character is a letter.
 */
function isLetter(c: string, matchCase?: "upper" | "lower"): boolean {
  switch (matchCase) {
    case "upper":
      return /^[A-Z]$/.test(c);
    case "lower":
      return /^[a-z]$/.test(c);
    default:
      return /^[A-Za-z]$/.test(c);
  }
}

/**
 * Returns whether a given character is unicode.
 * @param c - The character.
 * @param excludePi - Whether to exclude the Pi symbol from consideration.
 * @return - Whether the given character is valid unicode.
 */
function isUnicode(c: string, excludePi?: boolean): boolean {
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
function isAlpha(c: string): boolean {
  return /^[0-9a-zA-Z]+$/.test(c);
}

/**
 * Returns whether a given character is a newline character.
 * @param c - The character.
 * @return Whether the character is a newline.
 */
function isNewline(c: string): boolean {
  return /\n|\r(?!\n)|\u2028|\u2029|\r\n/.test(c);
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

  /**
   * Creates a lexer.
   * @param input - The string to lex.
   * @param cursor - The starting cursor position.
   */
  constructor(input: string, cursor: number = 0) {
    this.input = input;
    this.cursor = cursor;
    this.lines = this.input.split(/\n|\r(?!\n)|\u2028|\u2029|\r\n/);
    this.lineStartIndices = [0];
    const regex = /\n|\r(?!\n)|\u2028|\u2029|\r\n/g;
    let match;
    while ((match = regex.exec(this.input)) !== null) {
      this.lineStartIndices.push(match.index + match[0].length);
    }
  }

  /**
   * Verifies that all appropriate lines end with a semicolon.
   * @return A tuple of the status and if False, returns the problematic line.
   */
  verifyInput = (): [boolean, number | null, string | null] => {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (
        !line.startsWith("//") &&
        !(line.length == 0) &&
        !line.includes("gate") &&
        !(line.trim() == "{" || line.trim() == "}") &&
        !line.includes(";")
      ) {
        return [false, i + 1, line];
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
      throwLexerError(
        MissingSemicolonError,
        verifyInputResult[1],
        0,
        verifyInputResult[2],
        "Missing semicolon",
      );
    }
    while (this.cursor < this.input.length) {
      token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }
    return tokens;
  };

  /**
   * Reads a character and advances the cursor.
   * @param num - Optional cursor position modifier.
   */
  readChar = (num: number = 1): string => {
    this.cursor += num;
    return this.input[this.cursor - num];
  };

  /**
   * Advances the cusor past the next comment.
   */
  skipComment = () => {
    let char = "";
    while (!isNewline(char)) {
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
    while (isNumeric(this.peek())) {
      num += this.readChar();
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
    while (isAlpha(next) || next == "_" || isUnicode(next)) {
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
    while (" \t\n\r\v".indexOf(this.peek()) > -1) {
      this.cursor += 1;
    }
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
   * Lexes the next token.
   * @return The next token and its corresponding value.
   */
  nextToken = (): [Token, (number | string) | undefined, number, number, string] => {
    this.skipWhitespace();
    const startCursor = this.cursor;
    const line = this.getLineNumber(startCursor);
    const lineIndex = line - 1;
    const lineStart = this.lineStartIndices[lineIndex];
    const col = startCursor - lineStart + 1;
    const lineText = this.lines[lineIndex];

    if (this.cursor == this.input.length) {
      return [Token.EndOfFile, undefined, line, col, lineText];
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
          if (num.indexOf(".") != -1) {
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
