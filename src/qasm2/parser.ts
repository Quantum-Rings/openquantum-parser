/**
 * OpenQASM 2.0 Parser Implementation
 *
 * This module implements a parser for OpenQASM 2.0 that focuses on the core
 * quantum circuit description language without the advanced features of version 3.0.
 * The parser handles quantum and classical register declarations, gate definitions
 * and applications, measurements, and basic control structures.
 *
 * OpenQASM 2.0 parsing capabilities:
 * - **Register declarations**: qreg and creg with size specifications
 * - **Gate definitions**: Custom gate definitions with parameters and bodies
 * - **Gate applications**: Built-in and custom gate applications
 * - **Measurements**: Quantum measurements with classical result storage
 * - **Basic conditionals**: Simple if statements based on classical register values
 * - **Arithmetic expressions**: Parameter expressions for gate operations
 * - **Opaque gates**: External gate declarations
 *
 * The parser maintains a list of known gates and validates gate applications
 * against declared gates and built-in operations.
 *
 * @module
 *
 * @example Parsing OpenQASM 2.0 code
 * ```typescript
 * const tokens = lexer.lex();
 * const parser = new Parser(tokens);
 * const ast = parser.parse();
 *
 * // AST contains simplified node structure for OpenQASM 2.0
 * ```
 */

import { Token, notParam } from "./token";
import { OpenQASMVersion } from "../version";
import {
  BadArgumentError,
  BadCregError,
  BadQregError,
  BadConditionalError,
  BadBarrierError,
  BadMeasurementError,
  BadGateError,
  BadParameterError,
  BadIncludeError,
  UnsupportedOpenQASMVersionError,
  MissingBraceError,
} from "../errors";
import {
  AstNode,
  Version,
  Include,
  QReg,
  CReg,
  Barrier,
  Measure,
  Gate,
  Opaque,
  If,
  ApplyGate,
  Divide,
  Power,
  Times,
  Plus,
  Minus,
  Sin,
  Cos,
  Tan,
  Exp,
  Ln,
  Sqrt,
  Pi,
  NNInteger,
  Real,
  Variable,
} from "./ast";

/**
 * OpenQASM 2.0 Parser
 *
 * A straightforward recursive descent parser for OpenQASM 2.0 that produces
 * a simplified AST structure appropriate for the more limited feature set
 * of the 2.0 language specification.
 *
 * @example Basic parsing workflow
 * ```typescript
 * const parser = new Parser(tokens);
 * const ast = parser.parse();
 *
 * // Process the resulting AST nodes
 * ast.forEach(node => {
 *   if (node instanceof QReg) {
 *     console.log(`Quantum register: ${node.id}[${node.size}]`);
 *   }
 * });
 * ```
 */
class Parser {
  /** The tokens to parse. */
  tokens: Array<[Token, (number | string) | undefined, number, number, string]>;

  /** The allowed gates. */
  gates: Array<string>;

  /**
   * Creates a parser.
   * @param tokens - Tokens to parse.
   */
  constructor(tokens: Array<[Token, (number | string) | undefined, number, number, string]>) {
    this.tokens = tokens;
    this.gates = [
      "x",
      "y",
      "z",
      "u1",
      "u2",
      "u3",
      "s",
      "sdg",
      "h",
      "tdg",
      "cx",
      "cy",
      "cz",
      "t",
      "ccx",
      "reset",
      "cu1",
      "ccy",
      "ccz",
    ];
  }

  /**
   * Calling this method parses the code represented by the provided tokens.
   * @return The abstract syntax tree.
   */
  parse(): Array<AstNode> {
    let ast: Array<AstNode> = [];
    let i = 0;
    while (i < this.tokens.length - 1) {
      const nodes = this.parseNode(i);
      ast = ast.concat(nodes ? nodes : []);
      while (i < this.tokens.length && !this.matchNext(i, [Token.Semicolon])) {
        if (this.matchNext(i, [Token.LCParen])) {
          while (i < this.tokens.length && !this.matchNext(i, [Token.RCParen])) {
            i++;
          }
          if (i >= this.tokens.length) {
            throw new MissingBraceError("Missing closing brace", this.tokens[this.tokens.length - 1][2], this.tokens[this.tokens.length - 1][3], this.tokens[this.tokens.length - 1][4]);
          }
          break;
        }
        i++;
      }
      i++;
    }
    return ast;
  }

  /**
  * Delegates the parsing of the next set of tokens to the appropriate method.
  * @param offset - The current token index.
  * @param allowVariables - Whether encountered identifiers should be consider
      variable initializations or references.
  * @return A set of AST nodes.
  */
  parseNode(
    offset: number,
    allowVariables = false,
  ): Array<AstNode> {
    const token = this.tokens[offset];
    if (!token) return [];
    switch (token[0]) {
      case Token.Include:
        return [this.include(offset + 1)];
      case Token.OpenQASM:
        return [this.versionHeader(offset + 1)];
      case Token.QReg:
        return [this.qreg(offset + 1)];
      case Token.CReg:
        return [this.creg(offset + 1)];
      case Token.Barrier:
        return [this.barrier(offset + 1)];
      case Token.Measure:
        return [this.measure(offset + 1)];
      case Token.Id:
        if (
          !(token[1].toString().indexOf("QASM") != -1) &&
          !(token[1].toString().indexOf("include") != -1)
        ) {
          if (this.gates.includes(token[1].toString())) {
            return [this.application(offset, token[1].toString())];
          } else if (allowVariables) {
            return [new Variable(token[1].toString())];
          } else {
            throw new BadGateError("Bad gate", token[2], token[3], token[4]);
          }
        } else {
          return [];
        }
      case Token.Gate:
        return [this.gate(offset + 1)];
      case Token.Opaque:
        return [this.opaque(offset + 1)];
      case Token.If:
        return [this.conditional(offset + 1)];
      case Token.Power:
        return [new Power()];
      case Token.Divide:
        return [new Divide()];
      case Token.Times:
        return [new Times()];
      case Token.Plus:
        return [new Plus()];
      case Token.Minus:
        return [new Minus()];
      case Token.Pi:
        return [new Pi()];
      case Token.Sin:
        return [new Sin()];
      case Token.Cos:
        return [new Cos()];
      case Token.Exp:
        return [new Exp()];
      case Token.Ln:
        return [new Ln()];
      case Token.Sqrt:
        return [new Sqrt()];
      case Token.Tan:
        return [new Tan()];
      case Token.NNInteger:
        return [new NNInteger(Number(token[1]))];
      case Token.Real:
        return [new Real(Number(token[1]))];
    }
  }

  /**
   * Checks if the next tokens match those expected.
   * @param offset - The current token index.
   * @param expectedTokens - Expected tokens.
   * @return Whether these is a match.
   */
  matchNext(
    offset: number,
    expectedTokens: Array<Token>,
  ): boolean {
    let matches = true;
    let i = 0;
    if (offset >= this.tokens.length) {
      return false;
    }
    while (i < expectedTokens.length) {
      if (this.tokens[offset + i][0] != expectedTokens[i]) {
        matches = false;
        break;
      }
      i++;
    }
    return matches;
  }

  /**
   * Parses a quantum register.
   * @param offset - The current token index.
   * @return An AST node representing the quantum register.
   */
  qreg(offset: number): AstNode {
    if (
      this.matchNext(offset, [
        Token.Id,
        Token.LSParen,
        Token.NNInteger,
        Token.RSParen,
        Token.Semicolon,
      ])
    ) {
      const id = this.tokens[offset][1].toString();
      if (!this.validateIdentifier(id)) {
        throw new BadQregError("Bad qreg", this.tokens[offset][2], this.tokens[offset][3], this.tokens[offset][4]);
      }
      const size = this.tokens[offset + 2][1];
      return new QReg(id.toString(), Number(size));
    } else {
      throw new BadQregError("Bad qreg", this.tokens[offset][2], this.tokens[offset][3], this.tokens[offset][4]);
    }
  }

  /**
   * Parses a classical register.
   * @param offset - The current token index.
   * @return An AST node representing the classical register.
   */
  creg(offset: number): AstNode {
    if (
      this.matchNext(offset, [
        Token.Id,
        Token.LSParen,
        Token.NNInteger,
        Token.RSParen,
        Token.Semicolon,
      ])
    ) {
      const id = this.tokens[offset][1].toString();
      if (!this.validateIdentifier(id)) {
        throw new BadCregError("Bad creg", this.tokens[offset][2], this.tokens[offset][3], this.tokens[offset][4]);
      }
      const size = this.tokens[offset + 2][1];
      return new CReg(id.toString(), Number(size));
    } else {
      throw new BadCregError("Bad creg", this.tokens[offset][2], this.tokens[offset][3], this.tokens[offset][4]);
    }
  }

  /**
   * Parses a conditional.
   * @param offset - The current token index.
   * @return An AST node representing the conditional.
   */
  conditional(offset: number): AstNode {
    if (
      this.matchNext(offset, [
        Token.LParen,
        Token.Id,
        Token.Equals,
        Token.NNInteger,
        Token.RParen,
      ])
    ) {
      const id = this.tokens[offset + 1][1];
      const val = this.tokens[offset + 3][1];
      // Recursively call parseNode with updated offset
      const node = this.parseNode(offset + 5);
      return new If(id.toString(), Number(val), node);
    } else {
      throw new BadConditionalError("Bad conditional", this.tokens[offset][2], this.tokens[offset][3], this.tokens[offset][4]);
    }
  }

  /**
   * Parses a barrier.
   * @param offset - The current token index.
   * @return An AST node representing the barrier.
   */
  barrier(offset: number): AstNode {
    try {
      const [args, consumed] = this.matchArgList(offset);
      if (args.length > 0 && this.matchNext(offset + consumed, [Token.Semicolon])) {
        return new Barrier(args);
      }
    } catch (e) {
      if (e instanceof BadArgumentError) {
        throw e;
      }
    }
    throw new BadBarrierError("Bad barrier", this.tokens[offset][2], this.tokens[offset][3], this.tokens[offset][4]);
  }

  /**
   * Parses a measurement.
   * @param offset - The current token index.
   * @return An AST node representing the measurement.
   */
  measure(offset: number): AstNode {
    let first_id: string;
    let second_id: string;
    let first_index: number;
    let second_index: number;
    let current = offset;

    if (this.matchNext(current, [Token.Id, Token.Arrow])) {
      first_id = this.tokens[current][1].toString();
      current += 2;
    } else if (
      this.matchNext(current, [
        Token.Id,
        Token.LSParen,
        Token.NNInteger,
        Token.RSParen,
        Token.Arrow,
      ])
    ) {
      first_id = this.tokens[current][1].toString();
      first_index = Number(this.tokens[current + 2][1]);
      current += 5;
    } else {
      throw new BadMeasurementError("Bad measurement", this.tokens[current][2], this.tokens[current][3], this.tokens[current][4]);
    }
    if (this.matchNext(current, [Token.Id, Token.Semicolon])) {
      second_id = this.tokens[current][1].toString();
      current += 2;
    } else if (
      this.matchNext(current, [
        Token.Id,
        Token.LSParen,
        Token.NNInteger,
        Token.RSParen,
        Token.Semicolon,
      ])
    ) {
      second_id = this.tokens[current][1].toString();
      second_index = Number(this.tokens[current + 2][1]);
      current += 5;
    } else {
      throw new BadMeasurementError("Bad measurement", this.tokens[current][2], this.tokens[current][3], this.tokens[current][4]);
    }
    if (first_index != undefined && second_index != undefined) {
      return new Measure(first_id, second_id, first_index, second_index);
    } else if (first_index != undefined) {
      return new Measure(first_id, second_id, first_index, null);
    } else if (second_index != undefined) {
      return new Measure(first_id, second_id, null, second_index);
    }
    return new Measure(first_id, second_id);
  }

  /**
   * Parses an application of one of the allowed gates.
   * @param offset - The current token index.
   * @return An AST node representing the gate application.
   */
  application(
    offset: number,
    op: string,
  ): Array<AstNode> {
    let params: Array<any> = [];
    const list: Array<[string, number?]> = [];
    const applications: Array<AstNode> = [];
    let current = offset;

    if (this.tokens[current][1] == op) {
      current++;
    }
    if (this.matchNext(current, [Token.LParen])) {
      if (this.matchNext(current + 1, [Token.RParen])) {
        params = [];
        current += 2;
      } else {
        const [parsedParams, consumed] = this.matchParamList(current + 1);
        params = parsedParams;
        current += consumed + 1; // +1 for LParen
      }
    }
    const [args, consumedArgs] = this.matchArgList(current);
    for (const arg in args) {
      list.push(args[arg]);
    }
    applications.push(new ApplyGate(op, list, params));
    return applications;
  }

  /**
   * Parses a subroutine used in a custom gate definition.
   * @param offset - The current token index.
   * @return A parsed subroutine.
   */
  sub(offset: number): Array<AstNode> {
    let ast: Array<AstNode> = [];
    let i = offset;
    if (this.matchNext(i, [Token.LCParen])) {
      i++;
    }
    while (i < this.tokens.length - 1 && this.tokens[i][0] != Token.RCParen) {
      const nodes = this.parseNode(i);
      ast = ast.concat(nodes ? nodes : []);
      while (
        !this.matchNext(i, [Token.Semicolon]) &&
        !this.matchNext(i, [Token.RCParen])
      ) {
        i++;
      }
      if (this.matchNext(i, [Token.RCParen])) {
        break;
      }
      i++;
    }
    return ast;
  }

  /**
   * Parses a parameter value.
   * @param offset - The current token index.
   * @return An AST node representing the parameter value.
   */
  matchParam(offset: number): any {
    let param: any;
    if (!notParam(this.tokens[offset][0])) {
      // parseNode returns an array, and we return the array to maintain structure
      param = this.parseNode(offset, true);
    } else {
      throw new BadParameterError("Bad parameter", this.tokens[offset][2], this.tokens[offset][3], this.tokens[offset][4]);
    }
    return param;
  }

  /**
   * Parses a list of parameter values.
   * @param offset - The current token index.
   * @return A tuple containing the array of AST nodes and the number of tokens consumed.
   */
  matchParamList(
    offset: number,
  ): [Array<Array<any>>, number] {
    const args: Array<Array<any>> = [];
    let i: number = 0;
    let current = offset;
    args[0] = [];
    while (!this.matchNext(current, [Token.RParen])) {
      while (
        !this.matchNext(current, [Token.Comma]) &&
        !this.matchNext(current, [Token.RParen])
      ) {
        if (notParam(this.tokens[current][0])) {
          throw new BadParameterError("Bad parameter", this.tokens[current][2], this.tokens[current][3], this.tokens[current][4]);
        }
        const next = this.matchParam(current);
        args[i].push(next);
        current++;
      }
      if (this.matchNext(current, [Token.RParen])) {
        break;
      }
      i++;
      current++;
      args[i] = [];
    }
    // +1 to include the closing RParen in consumed count if needed, 
    // but the caller usually handles the closing token. 
    // Based on application() logic: tokens = tokens.slice(count + (commas - 1) + 2);
    // It seems application expects to skip the whole list including parens.
    // Here we return consumed count relative to start of params (after LParen).
    return [args, current - offset + 1]; 
  }

  /**
   * Parses an argument value.
   * @param offset - The current token index.
   * @return An AST node representing the argument value.
   */
  matchArg(offset: number): number {
    let index: number;
    if (this.matchNext(offset, [Token.LSParen])) {
      if (this.matchNext(offset + 1, [Token.NNInteger])) {
        index = Number(this.tokens[offset + 1][1]);
      } else {
        throw new BadArgumentError("Bad argument", this.tokens[offset + 1][2], this.tokens[offset + 1][3], this.tokens[offset + 1][4]);
      }
      if (this.matchNext(offset + 2, [Token.RSParen])) {
        return index;
      } else {
        throw new BadArgumentError("Bad argument", this.tokens[offset + 2][2], this.tokens[offset + 2][3], this.tokens[offset + 2][4]);
      }
    }
  }

  /**
   * Parses a list of argument values.
   * @param offset - The current token index.
   * @return A tuple containing the array of arguments and the number of tokens consumed.
   */
  matchArgList(
    offset: number,
  ): [Array<[string, number?]>, number] {
    const args: Array<[string, number?]> = [];
    let next: [string, number?];
    let id: string;
    let j = offset;
    while (
      j < this.tokens.length &&
      !this.matchNext(j, [Token.Semicolon])
    ) {
      if (this.matchNext(j, [Token.Id])) {
        id = this.tokens[j][1].toString();
        const index = this.matchArg(j + 1);
        next = [id, index];
        args.push(next);
        if (index != undefined) {
          j += 4;
        } else {
          j++;
        }
        if (this.matchNext(j, [Token.Comma])) {
          j++;
          if (this.matchNext(j, [Token.Semicolon])) {
            throw new BadArgumentError("Trailing comma not allowed", this.tokens[j][2], this.tokens[j][3], this.tokens[j][4]);
          }
        }
      } else {
        throw new BadArgumentError("Bad argument", this.tokens[j][2], this.tokens[j][3], this.tokens[j][4]);
      }
    }
    return [args, j - offset];
  }

  /**
   * Parses an include statement.
   * @param offset - The current token index.
   * @return An Include node representing the include statement.
   */
  include(offset: number): Include {
    let filename: string;
    if (this.matchNext(offset, [Token.String, Token.Semicolon])) {
      filename = this.tokens[offset][1].toString();
      return new Include(filename);
    }
    throw new BadIncludeError("Bad include", this.tokens[offset][2], this.tokens[offset][3], this.tokens[offset][4]);
  }

  /**
   * Parses the version header and sets the parser version.
   * @param offset - The current token index.
   * @return A Version node representing the version statement.
   */
  versionHeader(offset: number): Version {
    let version: OpenQASMVersion;
    if (this.matchNext(offset, [Token.NNInteger, Token.Semicolon])) {
      version = new OpenQASMVersion(Number(this.tokens[offset][1]));
      if (!version.isVersion2()) {
        throw new UnsupportedOpenQASMVersionError("Unsupported version", this.tokens[offset][2], this.tokens[offset][3], this.tokens[offset][4]);
      }
      return new Version(version);
    } else if (this.matchNext(offset, [Token.Real, Token.Semicolon])) {
      const versionSplits = this.tokens[offset][1].toString().split(".");
      version = new OpenQASMVersion(
        Number(versionSplits[0]),
        Number(versionSplits[1]),
      );
      if (!version.isVersion2()) {
        throw new UnsupportedOpenQASMVersionError("Unsupported version", this.tokens[offset][2], this.tokens[offset][3], this.tokens[offset][4]);
      }
      return new Version(version);
    }
    throw new UnsupportedOpenQASMVersionError("Unsupported version", this.tokens[offset][2], this.tokens[offset][3], this.tokens[offset][4]);
  }

  /**
   * Parses a list of identifiers.
   * @param offset - The current token index.
   * @return A tuple containing the array of identifiers and the number of tokens consumed.
   */
  matchIdList(offset: number): [Array<string>, number] {
    let args: Array<string> = [];
    let head: string;
    let current = offset;
    if (this.matchNext(current, [Token.Id])) {
      head = this.tokens[current][1].toString();
    }
    current++;
    args.push(head);
    if (this.matchNext(current, [Token.Comma])) {
      current++;
      const [sub, consumed] = this.matchIdList(current);
      args = args.concat(sub);
      current += consumed;
    }
    return [args, current - offset];
  }

  /**
   * Parses a gate.
   * @param offset - The current token index.
   * @return An AST node representing the gate.
   */
  gate(offset: number): AstNode {
    let name: string;
    let params: Array<string>;
    let current = offset;
    if (this.matchNext(current, [Token.Id])) {
      name = this.tokens[current][1].toString();
      if (!this.validateIdentifier(name)) {
        throw new BadGateError("Bad gate", this.tokens[current][2], this.tokens[current][3], this.tokens[current][4]);
      }
    } else {
      throw new BadGateError("Bad gate", this.tokens[current][2], this.tokens[current][3], this.tokens[current][4]);
    }
    current++;
    if (this.matchNext(current, [Token.LParen])) {
      current++;
      if (this.matchNext(current, [Token.RParen])) {
        params = [];
        current++;
      } else {
        const [idList, consumed] = this.matchIdList(current);
        params = idList;
        current += consumed + 1; // +1 for RParen
      }
    }
    const [registers, consumedRegs] = this.matchIdList(current);
    current += consumedRegs;
    const applications: Array<AstNode> = this.sub(current);
    this.gates.push(name);
    return new Gate(name, registers, params, applications);
  }

  /**
   * Parses an opaque declaration if using OpenQASM 2. If using OpenQASM 3 it skips the line.
   * @param offset - The current token index.
   * @return An AST node representing the opaque declaration.
   */
  opaque(offset: number): AstNode {
    let name: string;
    let params: Array<string>;
    let qubits: Array<[string, number?]> = [];
    let current = offset;
    if (this.matchNext(current, [Token.Id])) {
      name = this.tokens[current][1].toString();
      current++;
    } else {
      throw new BadGateError("Bad gate", this.tokens[current][2], this.tokens[current][3], this.tokens[current][4]);
    }

    if (this.matchNext(current, [Token.LParen])) {
      current++;
      if (!this.matchNext(current, [Token.RParen])) {
        const [idList, consumed] = this.matchIdList(current);
        params = idList;
        current += consumed + 1;
      } else {
        current++;
      }
    }

    const [args, consumedArgs] = this.matchArgList(current);
    qubits = args;
    current += consumedArgs;

    if (!this.matchNext(current, [Token.Semicolon])) {
      throw new BadGateError("Bad gate", this.tokens[current][2], this.tokens[current][3], this.tokens[current][4]);
    }

    return new Opaque(name, qubits, params);
  }

  /**
   * Validates whether a register or gate identifier.
   * @param identifier - The identifier to validate.
   * @return Boolean indicating successful validation or not.
   */
  private validateIdentifier(identifier: string): boolean {
    const firstChar = identifier[0];
    return /^[a-z]$/.test(firstChar);
  }
}

export default Parser;
