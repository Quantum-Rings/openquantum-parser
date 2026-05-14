/* eslint-disable no-useless-escape */

/**
 * OpenQASM 3.0 Lexical Analyzer
 *
 * This module implements the lexer for OpenQASM 3.0, which transforms source code
 * into a stream of tokens. The lexer handles the significantly expanded syntax of
 * OpenQASM 3.0, including classical programming constructs, control flow, and
 * advanced quantum features.
 *
 * Key features of the OpenQASM 3.0 lexer:
 * - **Extended token set**: Classical types, control flow, functions
 * - **Complex operators**: Compound assignment, bitwise operations
 * - **Advanced literals**: Scientific notation, binary/hex/octal, durations
 * - **Gate modifiers**: ctrl, negctrl, inv, pow with @ syntax
 * - **Unicode support**: Mathematical constants (π, ℇ, τ)
 * - **Robust error handling**: Detailed syntax error reporting
 *
 * The lexer performs several validation passes:
 * - Semicolon verification for statement termination
 * - Comment handling (single-line // and multi-line /* *\/)
 * - String literal parsing with multiple quote styles
 * - Number format validation and conversion
 *
 * @module
 *
 * @example Basic lexing process
 * ```typescript
 * const lexer = new Lexer('qubit[2] q; h q[0];');
 * const tokens = lexer.lex();
 * // Returns: [
 * //   [Token.Id, 'qubit'], [Token.LSParen], [Token.NNInteger, 2],
 * //   [Token.RSParen], [Token.Id, 'q'], [Token.Semicolon], ...
 * // ]
 * ```
 */

import { Token, lookup } from "./token";
import {
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
  return c !== undefined && (c == "." || c == "e" || c == "E" || c == "_" || !isNaN(parseInt(c)));
}

/**
 * Returns whether a given character is a letter.
 * @param c - The character.
 * @param matchCase - Whether to check for a letter that is upper case, lower case, or either. (optional)
 * @return Whether the character is a letter.
 */
function isLetter(c: string, matchCase?: "upper" | "lower"): boolean {
  if (c === undefined) return false;
  switch (matchCase) {
    case "upper":
      return /^[A-Z]$/.test(c);
    case "lower":
      return /^[a-z]$/.test(c);
    default:
      return /^[A-Za-z_]$/.test(c);
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
function isAlpha(c: string): boolean {
  if (c === undefined) return false;
  return /^[0-9a-zA-Z]+$/.test(c);
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

/**
 * OpenQASM 3.0 Lexical Analyzer
 *
 * The main lexer class that processes OpenQASM 3.0 source code character by
 * character and produces a stream of tokens for the parser to consume.
 *
 * The lexer maintains state including:
 * - Current cursor position in the input
 * - Input validation status
 * - Error reporting context
 *
 * @example Creating and using a lexer
 * ```typescript
 * const source = `
 *   OPENQASM 3.0;
 *   include "stdgates.inc";
 *   qubit[2] q;
 *   h q[0];
 *   cx q[0], q[1];
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
      const trimmedLine = this.lines[i].trim();
      if (
        !trimmedLine.startsWith("//") &&
        !trimmedLine.startsWith("/*") &&
        !trimmedLine.startsWith("*") &&
        !trimmedLine.startsWith("*/") &&
        trimmedLine.length > 0 &&
        !trimmedLine.startsWith("gate") &&
        trimmedLine !== "{" &&
        trimmedLine !== "}" &&
        !trimmedLine.includes(";") &&
        !trimmedLine.startsWith("def") &&
        !trimmedLine.startsWith("if") &&
        !trimmedLine.match(/^(?:}\s*)?else\b/) &&
        !trimmedLine.startsWith("for") &&
        !trimmedLine.startsWith("while") &&
        !trimmedLine.startsWith("switch") &&
        !trimmedLine.startsWith("case") &&
        !trimmedLine.startsWith("box") &&
        !trimmedLine.startsWith("array") &&
        !trimmedLine.startsWith("{") &&
        !trimmedLine.startsWith("default") &&
        !trimmedLine.match(/^#\s*pragma/)
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
    while (this.cursor < this.input.length && !isNewline(char)) {
      char = this.readChar();
    }
  };

  /**
   * Advances the cursor past a multiline comment.
   */
  skipMultiLineComment = () => {
    let char = "";
    let nextChar = "";
    const multiLineCommentTerminator = "*/";
    while (this.cursor < this.input.length && `${char}${nextChar}` !== multiLineCommentTerminator) {
      char = this.readChar();
      nextChar = this.peek() || "";
    }
    if (this.cursor < this.input.length) {
      this.readChar();
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
   * Reds a keyword or identifier.
   * If the character sequence matches a keyword, returns the corresponding token.
   * Otherwise, treats the sequence as an identifier.
   * @param char - The first character of the keyword or identifier.
   * @return The corresponding token or identifier.
   */
  readKeywordOrIdentifier = (char: string): [Token, string] => {
    const identifier = char + this.readIdentifier();
    return [lookup(identifier), identifier];
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
    while (this.cursor < this.input.length && " \t\n\r\v".indexOf(this.peek()) > -1) {
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
      case "π":
        result = [Token.Pi];
        break;
      case "ℇ":
        result = [Token.Euler];
        break;
      case "τ":
        result = [Token.Tau];
        break;
      case "@":
        result = [Token.At];
        break;
      case "θ":
        result = this.readKeywordOrIdentifier(char);
        break;
      case "!":
        if (this.peekEq("=")) {
          this.readChar();
          result = [Token.BinaryOp, "!="];
        } else {
          result = [Token.UnaryOp, "!"];
        }
        break;
      case "~":
        result = [Token.UnaryOp, "~"];
        break;
      case "*":
        if (this.peekEq("*")) {
          this.readChar();
          if (this.peekEq("=")) {
            this.readChar();
            result = [Token.CompoundArithmeticOp, "**="];
          } else {
            result = [Token.ArithmeticOp, "**"];
          }
        } else if (this.peekEq("=")) {
          this.readChar();
          result = [Token.CompoundArithmeticOp, "*="];
        } else {
          result = [Token.ArithmeticOp, "*"];
        }
        break;
      case "/":
        if (this.peekEq("/")) {
          this.skipComment();
          return;
        } else if (this.peekEq("*")) {
          this.skipMultiLineComment();
          return;
        } else if (this.peekEq("=")) {
          this.readChar();
          result = [Token.CompoundArithmeticOp, "/="];
        } else {
          result = [Token.ArithmeticOp, "/"];
        }
        break;
      case "%":
        if (this.peekEq("=")) {
          this.readChar();
          result = [Token.CompoundArithmeticOp, "%="];
        } else {
          result = [Token.ArithmeticOp, "%"];
        }
        break;
      case "+":
        if (this.peekEq("=")) {
          this.readChar();
          result = [Token.CompoundArithmeticOp, "+="];
        } else if (this.peekEq("+")) {
          this.readChar();
          result = [Token.ArithmeticOp, "++"];
        } else {
          result = [Token.ArithmeticOp, "+"];
        }
        break;
      case "-": {
        if (this.peekEq(">")) {
          this.readChar();
          result = [Token.Arrow];
        } else if (this.peekEq("=")) {
          this.readChar();
          result = [Token.CompoundArithmeticOp, "-="];
        } else {
          result = [Token.UnaryOp, "-"];
        }
        break;
      }
      case "&":
        if (this.peekEq("&")) {
          this.readChar();
          result = [Token.BinaryOp, "&&"];
        } else {
          result = [Token.BinaryOp, "&"];
        }
        break;
      case "|":
        if (this.peekEq("|")) {
          this.readChar();
          result = [Token.BinaryOp, "||"];
        } else {
          result = [Token.BinaryOp, "|"];
        }
        break;
      case "^":
        if (this.peekEq("=")) {
          this.readChar();
          result = [Token.CompoundBinaryOp, "^="];
        } else {
          result = [Token.BinaryOp, "^"];
        }
        break;
      case "<":
        if (this.peekEq("=")) {
          this.readChar();
          result = [Token.BinaryOp, "<="];
        } else if (
          this.input[this.cursor] == "<" &&
          this.input[this.cursor + 1] == "="
        ) {
          this.readChar(2);
          result = [Token.CompoundBinaryOp, "<<="];
        } else if (this.peekEq("<")) {
          this.readChar();
          result = [Token.BinaryOp, "<<"];
        } else {
          result = [Token.BinaryOp, "<"];
        }
        break;
      case ">":
        if (this.peekEq("=")) {
          this.readChar();
          result = [Token.BinaryOp, ">="];
        } else if (
          this.input[this.cursor] == ">" &&
          this.input[this.cursor + 1] == "="
        ) {
          this.readChar(2);
          result = [Token.CompoundBinaryOp, ">>="];
        } else if (this.peekEq(">")) {
          this.readChar();
          result = [Token.BinaryOp, ">>"];
        } else {
          result = [Token.BinaryOp, ">"];
        }
        break;
      case "=":
        if (this.peekEq("=")) {
          this.readChar();
          result = [Token.BinaryOp, "=="];
        } else {
          result = [Token.EqualsAssmt];
        }
        break;
      case ";":
        result = [Token.Semicolon];
        break;
      case ",":
        result = [Token.Comma];
        break;
      case ":":
        result = [Token.Colon];
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
      case "$":
        if (/\d/.test(this.peek())) {
          let num = "";
          while (this.cursor < this.input.length && /\d/.test(this.peek())) {
            num += this.readChar();
          }
          result = [Token.HardwareQubit, parseInt(num)];
        } else {
          result = [Token.Dollar];
        }
        break;
      case "#": {
         let tempCursor = this.cursor;
         while (tempCursor < this.input.length && (this.input[tempCursor] === " " || this.input[tempCursor] === "\t")) {
           tempCursor++;
         }
         if (
           this.input[tempCursor] == "p" &&
           this.input[tempCursor + 1] == "r" &&
           this.input[tempCursor + 2] == "a" &&
           this.input[tempCursor + 3] == "g" &&
           this.input[tempCursor + 4] == "m" &&
           this.input[tempCursor + 5] == "a"
         ) {
           this.cursor = tempCursor + 6;
           while (this.cursor < this.input.length && (this.peek() === " " || this.peek() === "\t")) {
             this.cursor++;
           }
           let pragmaText = "";
           while (this.cursor < this.input.length && !isNewline(this.peek())) {
             pragmaText += this.readChar();
           }
           pragmaText = pragmaText.trimEnd();
           if (pragmaText.endsWith(";")) {
             pragmaText = pragmaText.slice(0, -1).trimEnd();
           }
           result = [Token.Pragma, pragmaText];
         } else if (
           this.input[this.cursor] == "d" &&
           this.input[this.cursor + 1] == "i" &&
           this.input[this.cursor + 2] == "m"
         ) {
           this.readChar(3);
           result = [Token.Dim];
         } else {
           result = [Token.Hash];
         }
         break;
      }
      case "c":
        if (
          this.input[this.cursor] == "t" &&
          this.input[this.cursor + 1] == "r" &&
          this.input[this.cursor + 2] == "l"
        ) {
          this.readChar(3);
          result = this.lexGateModifier("ctrl");
        } else {
          result = this.readKeywordOrIdentifier(char);
        }
        break;
      case "n":
        if (
          this.input[this.cursor] == "e" &&
          this.input[this.cursor + 1] == "g" &&
          this.input[this.cursor + 2] == "c" &&
          this.input[this.cursor + 3] == "t" &&
          this.input[this.cursor + 4] == "r" &&
          this.input[this.cursor + 5] == "l"
        ) {
          this.readChar(6);
          result = this.lexGateModifier("negctrl");
        } else {
          result = this.readKeywordOrIdentifier(char);
        }
        break;
      case "i":
        if (
          this.input[this.cursor] == "n" &&
          this.input[this.cursor + 1] == "v"
        ) {
          this.readChar(2);
          result = this.lexGateModifier("inv");
        } else {
          result = this.readKeywordOrIdentifier(char);
        }
        break;
      case "p":
        if (
          this.input[this.cursor] == "o" &&
          this.input[this.cursor + 1] == "w" &&
          !isLetter(this.input[this.cursor + 2])
        ) {
          this.readChar(2);
          result = this.lexGateModifier("pow");
        } else {
          result = this.readKeywordOrIdentifier(char);
        }
        break;
      case "0":
        if (this.peekEq("b") || this.peekEq("B")) {
          const char = this.readChar(1);
          const binaryLit = this.readIdentifier();
          result = [Token.BinaryLiteral, `0${char}${binaryLit}`];
        } else if (this.peekEq("o") || this.peekEq("O")) {
          const char = this.readChar(1);
          const octalLit = this.readIdentifier();
          result = [Token.OctalLiteral, `0${char}${octalLit}`];
        } else if (this.peekEq("x") || this.peekEq("X")) {
          const char = this.readChar(1);
          const hexLit = this.readIdentifier();
          result = [Token.HexLiteral, `0${char}${hexLit}`];
        } else {
          const num = char + this.readNumeric();
          if (num.indexOf(".") != -1) {
            result = [Token.Real, parseFloat(num)];
          } else if (num.indexOf("_") != -1) {
            result = [Token.Integer, num];
          } else {
            result = [Token.NNInteger, parseInt(num)];
          }
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

          if (major !== 3) {
            throw new UnsupportedOpenQASMVersionError(
              `Unsupported OpenQASM version detected: ${majorVersion}.${minor ?? 0}`,
              this.getLineNumber(this.cursor),
              this.getColumnNumber(this.cursor),
              this.getCurrentLine(this.cursor),
            );
          }

          result = [Token.OpenQASM];
        } else {
          result = this.readKeywordOrIdentifier(char);
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
          result = this.readKeywordOrIdentifier(char);
        } else if (isNumeric(char)) {
          const num = char + this.readNumeric();
          if (num.indexOf("e") != -1) {
            result = [Token.ScientificNotation, num];
          } else if (num.indexOf(".") != -1) {
            result = [Token.Real, parseFloat(num)];
          } else if (num.indexOf("_") != -1) {
            result = [Token.Integer, num];
          } else {
            result = [Token.NNInteger, parseInt(num)];
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

  /**
   * Retruns an identifier or gate modifier.
   */
  lexGateModifier = (keyword: string): [Token, (number | string)?] => {
    let offset = 1;
    let currChar = "";
    while (
      this.cursor + offset < this.input.length &&
      this.input[this.cursor + offset] !== ";"
    ) {
      currChar = this.input[this.cursor + offset];
      if (currChar === "@") {
        break;
      }
      offset++;
    }
    if (currChar === "@") {
      switch (keyword) {
        case "ctrl":
          return [Token.Ctrl];
        case "negctrl":
          return [Token.NegCtrl];
        case "inv":
          return [Token.Inv];
        case "pow":
          return [Token.PowM];
      }
    }
    return this.readKeywordOrIdentifier(keyword);
  };
}
export default Lexer;
