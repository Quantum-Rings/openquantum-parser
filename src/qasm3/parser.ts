/* eslint-disable  @typescript-eslint/no-explicit-any */

/**
 * OpenQASM 3.0 Parser Implementation
 *
 * This module implements a recursive descent parser for OpenQASM 3.0 that transforms
 * a stream of tokens into an Abstract Syntax Tree (AST). The parser handles the full
 * OpenQASM 3.0 language specification including classical programming constructs,
 * control flow, quantum operations, and advanced features.
 *
 * Key parsing capabilities:
 * - **Classical types**: int, uint, float, bool, bit, complex, angle
 * - **Control flow**: if/else, for/while loops, switch/case statements
 * - **Functions**: def, return, extern declarations, subroutine calls
 * - **Quantum operations**: gate definitions/calls, measurements, barriers, delays
 * - **Advanced features**: arrays, timing constructs, calibration grammar
 * - **Expressions**: Arithmetic, logical, function calls with proper precedence
 *
 * The parser maintains context about:
 * - Defined gates (built-in, standard library, custom)
 * - Declared subroutines and external functions
 * - Array declarations and aliases
 * - Type information for validation
 *
 * @module
 *
 * @example Basic parsing workflow
 * ```typescript
 * const tokens = lexer.lex();
 * const parser = new Parser(tokens);
 * const ast = parser.parse();
 * ```
 */

import { Token } from "./token";
import { OpenQASMVersion } from "../version";
import {
  BadQregError,
  BadMeasurementError,
  BadGateError,
  BadParameterError,
  UnsupportedOpenQASMVersionError,
  BadStringLiteralError,
  BadClassicalTypeError,
  BadExpressionError,
  ReturnErrorConstructor,
  MissingSemicolonError,
  MissingBraceError,
  BadLoopError,
  BadQuantumInstructionError,
  BadSubroutineError,
} from "../errors";
import {
  AstNode,
  Statement,
  Expression,
  Parameters,
  ArrayReferenceModifier,
  ArrayReference,
  CalibrationGrammarDeclaration,
  Include,
  Version,
  FloatType,
  ComplexType,
  BoolType,
  IntType,
  UIntType,
  BitType,
  AngleType,
  DurationType,
  Range,
  Identifier,
  SubscriptedIdentifier,
  Pi,
  Euler,
  Tau,
  MathFunctionTypes,
  MathFunction,
  TrigFunctionTypes,
  TrigFunction,
  IntegerLiteral,
  NumericLiteral,
  FloatLiteral,
  BooleanLiteral,
  BitstringLiteral,
  DurationUnit,
  DurationLiteral,
  DurationOf,
  UnaryOp,
  Unary,
  BinaryOp,
  Binary,
  Cast,
  IndexSet,
  ArrayDeclaration,
  ArrayInitializer,
  ArrayAccess,
  QuantumMeasurement,
  QuantumMeasurementAssignment,
  ClassicalDeclaration,
  AssignmentStatement,
  QuantumDeclaration,
  AliasStatement,
  QuantumGateModifierName,
  QuantumGateModifier,
  QuantumGateCall,
  QuantumBarrier,
  QuantumReset,
  QuantumDelay,
  ReturnStatement,
  ProgramBlock,
  QuantumBlock,
  SubroutineBlock,
  QuantumGateDefinition,
  BoxDefinition,
  ExternSignature,
  SubroutineDefinition,
  SubroutineCall,
  BranchingStatement,
  ForLoopStatement,
  WhileLoopStatement,
  BreakStatement,
  ContinueStatement,
  IOModifier,
  IODeclaration,
  SwitchStatement,
  CaseStatement,
  DefaultStatement,
  PragmaStatement,
  ClassicalType,
  ArithmeticOp,
  Arithmetic,
  ImaginaryLiteral,
  HardwareQubit,
  StretchType,
  SizeOf,
} from "./ast";

/**
 * Handles throwing parser errors with basic stack trace.
 * @param error - The error to throw.
 * @param token - The source token for the error.
 * @param index - The token index.
 * @param message - Optional additional error context.
 */
function throwParserError(
  error: ReturnErrorConstructor,
  token: Token | [Token, (string | number) | undefined, number, number, string],
  index: number,
  message?: string,
) {
  if (Array.isArray(token)) {
    throw new error(message, token[2], token[3], token[4]);
  } else {
    throw new error(message);
  }
}

/**
 * OpenQASM 3.0 Recursive Descent Parser
 *
 * Implements a comprehensive parser for the OpenQASM 3.0 language specification.
 * The parser uses recursive descent parsing with appropriate error recovery and
 * maintains symbol tables for gates, subroutines, and variables.
 *
 * Parser state includes:
 * - Token stream and current position
 * - Symbol tables for gates, subroutines, arrays, aliases
 * - Machine-specific defaults (float width, int size)
 *
 * @example Creating and using the parser
 * ```typescript
 * const parser = new Parser(tokens);
 *
 * // Parse the entire program
 * const ast = parser.parse();
 *
 * // AST contains array of top-level statements and declarations
 * console.log(ast); // [VersionNode, IncludeNode, DeclarationNode, ...]
 * ```
 */
class Parser {
  /** The tokens to parse. */
  tokens: Array<[Token, (number | string) | undefined, number, number, string]>;

  /** The built in gates. */
  gates: Set<string>;

  /** Custom defined gates. */
  customGates: Set<string>;

  /** Standard library gates. */
  standardGates: Set<string>;

  /** Custom defined subroutines. */
  subroutines: Set<string>;

  /** User defined arrays. */
  customArrays: Set<string>;

  /** User defined aliases. */
  aliases: Map<string, string>;

  /** Index of the current token. */
  index: number;

  /** The default machine precision float width. */
  machineFloatWidth: number;

  /** The default machine int size. */
  machineIntSize: number;

  /**
   * Creates a parser.
   * @param tokens - Tokens to parse.
   * @param defaultFloatWidth - Optional default float width override.
   * @param machineIntSize - Optional default int size override.
   */
  constructor(
    tokens: Array<[Token, (number | string) | undefined, number, number, string]>,
    defaultFloatWidth?: number,
    machineIntSize?: number,
  ) {
    this.tokens = tokens;
    this.gates = new Set(["U", "gphase", "cnot"]);
    this.standardGates = new Set();
    this.customGates = new Set();
    this.subroutines = new Set();
    this.customArrays = new Set();
    this.aliases = new Map();
    this.index = 0;
    this.machineFloatWidth = defaultFloatWidth ? defaultFloatWidth : 64;
    this.machineIntSize = machineIntSize ? machineIntSize : 32;

    this.stdGates();
  }

  /**
   * Loads the standard library gates.
   */
  stdGates() {
    const gates = [
      "p",
      "x",
      "y",
      "z",
      "h",
      "s",
      "sdg",
      "t",
      "tdg",
      "sx",
      "rx",
      "ry",
      "rz",
      "cx",
      "cy",
      "cz",
      "cp",
      "crx",
      "cry",
      "crz",
      "ch",
      "swap",
      "ccx",
      "cswap",
      "cu",
      // OpenQASM 2 backwards compatibility gates
      "CX",
      "phase",
      "cphase",
      "id",
      "u1",
      "u2",
      "u3",
    ];
    gates.forEach(this.standardGates.add, this.standardGates);
  }

  /**
   * Parses the token stream and generates an abstract syntax tree.
   * @return The abstract syntax tree.
   */
  parse(): Array<AstNode> {
    let ast: Array<AstNode> = [];
    while (this.index < this.tokens.length) {
      const [nodes, consumed] = this.parseNode(this.index);
      ast = ast.concat(nodes ? nodes : []);
      this.index += consumed;
    }
    return ast;
    // let i = 0;
    // while (i < this.tokens.length - 1) {
    //   this.index = i;
    //   const nodes = this.parseNode(this.tokens.slice(i))[0];
    //   ast = ast.concat(nodes ? nodes : []);
    //   while (!this.matchNext(this.tokens.slice(i), [Token.Semicolon])) {
    //     if (this.matchNext(this.tokens.slice(i), [Token.LCParen])) {
    //       while (!this.matchNext(this.tokens.slice(i), [Token.RCParen])) {
    //         i++;
    //       }
    //       break;
    //     } else if (this.matchNext(this.tokens.slice(i), [Token.RCParen])) {
    //       break;
    //     }
    //     i++;
    //   }
    //   i++;
    // }
    // return ast;
  }

  /**
  * Parses a single statement or declaration by delegating the parsing of the next set of tokens to the appropriate method.
  * @param tokens - Remaining tokens to parse.
  * @param allowVariables - Whether encountered identifiers should be consider
      variable initializations or references.
  * @return A set of AST nodes and the number of consumed tokens.
  */
  parseNode(
    offset: number,
    allowVariables = true,
  ): [Array<AstNode>, number] {
    const token = this.tokens[offset];
    switch (token[0]) {
      case Token.DefcalGrammar: {
        const [defcalGrammarNode, consumed] =
          this.defcalGrammarDeclaration(offset);
        return [[defcalGrammarNode], consumed];
      }
      case Token.Include: {
        const [includeNode, consumed] = this.include(offset);
        if (includeNode.filename === '"stdgates.inc"') {
          this.stdGates();
        }
        return [[includeNode], consumed];
      }
      case Token.OpenQASM: {
        const [qasmNode, consumed] = this.versionHeader(offset);
        return [[qasmNode], consumed];
      }
      case Token.Const: {
        const [constNode, consumed] = this.classicalDeclaration(
          offset + 1,
          true,
        );
        return [[constNode], consumed + 1];
      }
      case Token.Input:
      case Token.Output: {
        const [ioType, consumed] = this.ioType(offset);
        return [[ioType], consumed];
      }
      case Token.Float:
      case Token.Int:
      case Token.UInt:
      case Token.Bool:
      case Token.Angle:
      case Token.Stretch:
      case Token.Complex:
      case Token.Duration: {
        const [classicalNode, consumed] = this.classicalDeclaration(
          offset,
          false,
        );
        return [[classicalNode], consumed];
      }
      case Token.Qubit:
      case Token.QReg: {
        const [qregNode, qregConsumed] = this.quantumDeclaration(offset);
        return [[qregNode], qregConsumed];
      }
      case Token.Break:
        return [[new BreakStatement(token[2], token[3])], 1];
      case Token.Reset: {
        const [resetNode, resetConsumed] = this.resetStatement(offset);
        return [[resetNode], resetConsumed];
      }
      case Token.Continue:
        return [[new ContinueStatement(token[2], token[3])], 1];
      case Token.Let: {
        const [letNode, letConsumed] = this.aliasStatement(offset);
        return [[letNode], letConsumed];
      }
      case Token.Bit:
        if (this.isMeasurement(offset + 1)) {
          const [measureNode, measureConsumed] = this.measureStatement(offset);
          return [[measureNode], measureConsumed];
        } else {
          const [classicalNode, consumed] = this.classicalDeclaration(
            offset,
            false,
          );
          return [[classicalNode], consumed];
        }
      case Token.CReg: {
        const [classicalNode, consumed] = this.classicalDeclaration(
          offset,
          false,
        );
        return [[classicalNode], consumed];
      }
      case Token.Measure: {
        const [measureNode, measureConsumed] = this.measureStatement(offset);
        return [[measureNode], measureConsumed];
      }
      case Token.Gate: {
        const [gateNode, gateConsumed] = this.quantumGateDefinition(offset);
        this.customGates.add(gateNode.name.name);
        return [[gateNode], gateConsumed];
      }
      case Token.Return: {
        const [returnNode, returnConsumed] = this.returnStatement(offset);
        return [[returnNode], returnConsumed];
      }
      case Token.Def: {
        const [subroutineNode, subroutineConsumed] =
          this.subroutineDefinition(offset);
        this.subroutines.add(subroutineNode.name.name);
        return [[subroutineNode], subroutineConsumed];
      }
      case Token.Extern: {
        const [externNode, consumed] = this.externSignature(offset);
        this.subroutines.add(externNode.name.name);
        return [[externNode], consumed];
      }
      case Token.Ctrl:
      case Token.NegCtrl:
      case Token.Inv:
      case Token.PowM: {
        const [gateCallNode, gateCallConsumed] = this.quantumGateCall(offset);
        return [[gateCallNode], gateCallConsumed];
      }
      case Token.Ceiling:
      case Token.Exp:
      case Token.Floor:
      case Token.Log:
      case Token.Mod:
      case Token.Popcount:
      case Token.Pow:
      case Token.Sqrt:
      case Token.Rotr:
      case Token.Rotl: {
        const [expr, exprConsumed] = this.binaryExpression(offset + 1);
        let consumed = exprConsumed + 1;
        const [mathNode, mathConsumed] = this.createMathOrTrigFunction(
          token[0],
          expr,
          token[2],
          token[3],
        );
        return [[mathNode], consumed];
      }
      case Token.Opaque: {
        let consumed = 1;
        while (
          offset + consumed < this.tokens.length &&
          !this.matchNext(offset + consumed, [Token.Semicolon])
        ) {
          consumed++;
        }
        return [[], consumed];
      }
      case Token.DurationOf: {
        const [durationOfNOde, consumed] = this.durationOf(offset, token[2], token[3]);
        return [[durationOfNOde], consumed];
      }
      case Token.Dollar:
      case Token.HardwareQubit: {
        const [node, consumed] = this.parseHardwareQubit(offset);
        if (this.matchNext(offset + consumed, [Token.Semicolon])) {
          return [[node], consumed + 1];
        }
        throwParserError(
          MissingSemicolonError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected semicolon",
        );
        break;
      }
      case Token.SizeOf: {
        const [sizeOfNode, consumed] = this.sizeOf(offset);
        return [[sizeOfNode], consumed];
      }
      case Token.Delay: {
        const [delayNode, delayConsumed] = this.delay(offset);
        return [[delayNode], delayConsumed];
      }
      case Token.If: {
        const [ifNode, ifConsumed] = this.ifStatement(offset);
        return [[ifNode], ifConsumed];
      }
      case Token.For: {
        const [forNode, forConsumed] = this.forLoopStatement(offset);
        return [[forNode], forConsumed];
      }
      case Token.While: {
        const [whileNode, whileConsumed] = this.whileLoopStatement(offset);
        return [[whileNode], whileConsumed];
      }
      case Token.Switch: {
        const [switchNode, switchConsumed] = this.switchStatement(offset);
        return [[switchNode], switchConsumed];
      }
      case Token.Array: {
        const [arrayNode, arrayConsumed] = this.arrayDeclaration(offset);
        this.customArrays.add(arrayNode.identifier.name);
        return [[arrayNode], arrayConsumed];
      }
      case Token.Box: {
        const [boxNode, boxConsumed] = this.box(offset);
        return [[boxNode], boxConsumed];
      }
      case Token.Barrier: {
        const [barrierNode, barrierConsumed] = this.barrier(offset);
        return [[barrierNode], barrierConsumed];
      }
      case Token.Id:
        if (this.isQuantumGateCall(offset)) {
          const [gateCallNode, gateCallConsumed] = this.quantumGateCall(offset);
          return [[gateCallNode], gateCallConsumed];
        } else if (this.isSubroutineCall(offset)) {
          const [subroutineCallNode, subroutineCallConsumed] =
            this.subroutineCall(offset);
          return [[subroutineCallNode], subroutineCallConsumed];
        } else if (this.isMeasurement(offset)) {
          const [measureNode, measureConsumed] = this.measureStatement(offset);
          return [[measureNode], measureConsumed];
        } else if (
          this.matchNext(offset + 1, [Token.EqualsAssmt]) ||
          this.matchNext(offset + 1, [Token.CompoundArithmeticOp]) ||
          this.matchNext(offset + 1, [Token.CompoundBinaryOp]) ||
          this.isAssignment(offset)
        ) {
          const [assignmentNode, consumed] = this.assignment(offset);
          return [[assignmentNode], consumed];
        } else if (allowVariables) {
          const [expr, consumed] = this.binaryExpression(offset);
          if (this.matchNext(offset + consumed, [Token.Semicolon])) {
            return [[expr], consumed + 1];
          } else {
            throwParserError(
              MissingSemicolonError,
              this.tokens[offset + consumed],
              this.index + consumed,
              "expected semicolon",
            );
          }
        }
        break;
      case Token.Pragma: {
        let consumed = 1;
        const line = this.tokens[offset][2];
        const col = this.tokens[offset][3];

        const pragmaText = this.tokens[offset][1] as string;
        let name = "";
        let command = "";
        
        if (pragmaText) {
          const match = pragmaText.match(/^(\S+)(?:\s+(.*))?$/);
          if (match) {
            name = match[1];
            command = match[2] || "";
          }
        }

        if (!name) {
          throwParserError(
            BadExpressionError,
            this.tokens[offset],
            this.index,
            "expected pragma name",
          );
        }

        if (
          offset + consumed < this.tokens.length &&
          this.tokens[offset + consumed][0] === Token.Semicolon &&
          this.tokens[offset + consumed][2] === line
        ) {
          consumed++;
        }

        return [[new PragmaStatement(name, command, line, col)], consumed];
      }
      default:
        return [[], 1];
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
      if (!this.tokens[offset + i] || this.tokens[offset + i][0] != expectedTokens[i]) {
        matches = false;
        break;
      }
      i++;
    }
    return matches;
  }

  /**
   * Parses a `defcalgrammar` declaration.
   *
   * calibrationGrammarStatement:
   *   DEFCALGRAMMAR StringLiteral SEMICOLON
   *
   * @param offset - The current token index.
   * @return The parsed CalibrationGrammarDeclaration AstNode node and the number of consumed tokens.
   */
  defcalGrammarDeclaration(
    offset: number,
  ): [CalibrationGrammarDeclaration, number] {
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    const consumed = 1;
    if (
      this.matchNext(offset + consumed, [Token.String, Token.Semicolon])
    ) {
      return [
        new CalibrationGrammarDeclaration(this.tokens[offset + consumed][1].toString(), line, column),
        consumed + 2,
      ];
    }
    throwParserError(
      BadStringLiteralError,
      this.tokens[offset + consumed],
      this.index + consumed,
      "expected string literal following `defcalgrammar` keyword",
    );
  }

  /**
   * Parses a classical type declaration.
   * @param offset - The current token index.
   * @param isConst - Whether the declaration is for a constant, defaults to False.
   * @return The parsed ClassicalDeclaration AstNode and the number of consumed tokens.
   */
  classicalDeclaration(
    offset: number,
    isConst?: boolean,
  ): [ClassicalDeclaration, number] {
    const isConstParam = isConst ? isConst : false;
    let id: Identifier | null = null;
    let initialValue: Expression | undefined;
    let consumed = 0;

    const [classicalType, classicalTypeConsumed] =
      this.parseClassicalType(offset);
    consumed += classicalTypeConsumed;

    if (
      !this.matchNext(offset + consumed, [Token.RParen]) &&
      !this.matchNext(offset + consumed, [Token.Comma])
    ) {
      const [identifier, idConsumed] = this.unaryExpression(
        offset + consumed,
      );
      id = identifier as Identifier;
      consumed += idConsumed;

      if (this.matchNext(offset + consumed, [Token.EqualsAssmt])) {
        consumed++;
        const [value, valueConsumed] = this.binaryExpression(
          offset + consumed,
        );
        initialValue = value;
        consumed += valueConsumed;
      }

      if (this.matchNext(offset + consumed, [Token.Semicolon])) {
        consumed++;
      }
    }

    return [
      new ClassicalDeclaration(classicalType, id, initialValue, isConstParam, classicalType.line, classicalType.column),
      consumed,
    ];
  }

  /**
   * Parses an IO declaration statement.
   * @param offset - The current token index.
   * @return A tuple containing the parsed IODeclaration and the number of tokens consumed.
   */
  ioType(offset: number): [IODeclaration, number] {
    let consumed = 0;
    let modifier: IOModifier;
    switch (this.tokens[offset + consumed][0]) {
      case Token.Input:
        modifier = IOModifier.INPUT;
        break;
      case Token.Output:
        modifier = IOModifier.OUTPUT;
        break;
      default:
        throwParserError(
          BadExpressionError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "unsupported IO modifier",
        );
    }
    consumed++;
    const [classicalDeclaration, typeConsumed] = this.classicalDeclaration(
      offset + consumed,
    );
    consumed += typeConsumed;
    return [new IODeclaration(modifier, classicalDeclaration, this.tokens[offset][2], this.tokens[offset][3]), consumed];
  }

  /**
   * Parses a unary expression.
   * @param offset - The current token index.
   * @return A tuple containing the parsed Expression and the number of tokens consumed.
   */
  unaryExpression(
    offset: number,
  ): [Expression, number] {
    const token = this.tokens[offset];
    const locLine = token[2];
    const locCol = token[3];
    let consumed = 1;

    switch (token[0]) {
      case Token.NNInteger: {
        if (this.isImaginary(offset + consumed)) {
          return [
            new ImaginaryLiteral(`${token[1].toString()}im`, locLine, locCol),
            consumed + 1,
          ];
        } else if (this.isDuration(offset + consumed)) {
          return [
            new DurationLiteral(
              Number(token[1]),
              this.tokens[offset + consumed][1].toString() as DurationUnit,
              locLine,
              locCol,
            ),
            consumed + 1,
          ];
        }
        return [new IntegerLiteral(Number(token[1]), locLine, locCol), consumed];
      }
      case Token.Integer: {
        if (this.isImaginary(offset + consumed)) {
          return [
            new ImaginaryLiteral(`${token[1].toString()}im`, locLine, locCol),
            consumed + 1,
          ];
        }
        return [new IntegerLiteral(token[1].toString(), locLine, locCol), consumed];
      }
      case Token.BinaryLiteral:
      case Token.OctalLiteral:
      case Token.HexLiteral:
      case Token.ScientificNotation:
        return [new NumericLiteral(token[1].toString(), locLine, locCol), consumed];
      case Token.Real:
        if (this.isImaginary(offset + consumed)) {
          return [
            new ImaginaryLiteral(`${token[1].toString()}im`, locLine, locCol),
            consumed + 1,
          ];
        }
        return [new FloatLiteral(Number(token[1]), locLine, locCol), consumed];
      case Token.BoolLiteral:
        return [new BooleanLiteral(token[1] === "true", locLine, locCol), consumed];
      case Token.Arccos:
      case Token.Arcsin:
      case Token.Arctan:
      case Token.Cos:
      case Token.Sin:
      case Token.Tan:
      case Token.Ceiling:
      case Token.Exp:
      case Token.Floor:
      case Token.Log:
      case Token.Mod:
      case Token.Popcount:
      case Token.Pow:
      case Token.Sqrt:
      case Token.Rotr:
      case Token.Rotl: {
        const [funcExpr, funcConsumed] = this.unaryExpression(offset + 1);
        consumed += funcConsumed;
        const [mathNode, mathConsumed] = this.createMathOrTrigFunction(token[0], funcExpr, locLine, locCol);
        return [mathNode, consumed];
      }
      case Token.Id:
        // Handle array identifiers, identifiers, and subscripted identifiers
        if (this.matchNext(offset + 1, [Token.LSParen])) {
          if (this.isArray(offset)) {
            const [arrayAccess, arrayAccessConsumed] =
              this.parseArrayAccess(offset, locLine, locCol);
            return [arrayAccess, arrayAccessConsumed];
          } else {
            const identifier = new Identifier(token[1].toString(), locLine, locCol);
            const [subscript, subscriptConsumed] = this.parseSubscript(
              offset + 1,
            );
            consumed += subscriptConsumed;
            return [
              new SubscriptedIdentifier(identifier.name, subscript, locLine, locCol),
              consumed,
            ];
          }
        }
        return [new Identifier(token[1].toString(), locLine, locCol), consumed];
      case Token.Pi:
        return [new Pi(locLine, locCol), consumed];
      case Token.Euler:
        return [new Euler(locLine, locCol), consumed];
      case Token.Tau:
        return [new Tau(locLine, locCol), consumed];
      case Token.String:
        return [new BitstringLiteral(token[1].toString(), locLine, locCol), consumed];
      case Token.DurationOf:
        return this.durationOf(offset, locLine, locCol);
      case Token.Dollar:
      case Token.HardwareQubit:
        return this.parseHardwareQubit(offset);
      case Token.SizeOf:
        return this.sizeOf(offset);
      case Token.UnaryOp: {
        const [expr, exprConsumed] = this.unaryExpression(offset + 1);
        return [new Unary(token[1] as UnaryOp, expr, locLine, locCol), consumed + exprConsumed];
      }
      case Token.LParen: {
        let i = 1;
        let parenCount = 1;
        while (parenCount > 0 && offset + i < this.tokens.length) {
          if (this.tokens[offset + i][0] === Token.LParen) {
            parenCount++;
          } else if (this.tokens[offset + i][0] === Token.RParen) {
            parenCount--;
          } else if (parenCount === 1 && this.tokens[offset + i][0] === Token.Comma) {
            return this.parseParameters(offset);
          }
          i++;
        }
        const [expr, exprConsumed] = this.binaryExpression(offset + 1);
        consumed += exprConsumed;

        if (!this.matchNext(offset + consumed, [Token.RParen])) {
          throwParserError(
            MissingBraceError,
            this.tokens[offset + consumed],
            this.index + consumed,
            "expected closing parenthesis",
          );
        }
        consumed++;
        return [expr, consumed];
      }
      default:
        if (isTypeToken(token[0])) {
          return this.parseTypeCast(offset);
        }
        throwParserError(
          BadExpressionError,
          token,
          this.index,
          "invalid expression",
        );
    }
  }

  /**
   * Parses a binary expression.
   * @param offset - The current token index.
   * @return A tuple containing the parsed Expression and the number of tokens consumed.
   */
  binaryExpression(
    offset: number,
  ): [Expression, number] {
    const unaryExpr = this.unaryExpression(offset);
    let leftExpr = unaryExpr[0];
    const leftConsumed = unaryExpr[1];
    let consumed = leftConsumed;

    while (offset + consumed < this.tokens.length) {
      const token = this.tokens[offset + consumed];
      if (
        token[0] === Token.BinaryOp ||
        token[0] === Token.ArithmeticOp ||
        (token[0] === Token.UnaryOp && token[1] === "-")
      ) {
        consumed++;
        const [rightExpr, rightConsumed] = this.unaryExpression(
          offset + consumed,
        );

        if (token[0] === Token.BinaryOp) {
          leftExpr = new Binary(token[1] as BinaryOp, leftExpr, rightExpr, token[2], token[3]);
        } else if (token[0] === Token.UnaryOp && token[1] === "-") {
          leftExpr = new Arithmetic(ArithmeticOp.MINUS, leftExpr, rightExpr, token[2], token[3]);
        } else {
          leftExpr = new Arithmetic(
            token[1] as ArithmeticOp,
            leftExpr,
            rightExpr, token[2], token[3]
          );
        }
        consumed += rightConsumed;
      } else {
        break;
      }
    }

    return [leftExpr, consumed];
  }

  /**
   * Parses an assignment statement.
   * @param offset - The current token index.
   * @return The parsed AssignmentStatement AstNode and the number of consumed tokens.
   */
  assignment(
    offset: number,
  ): [AssignmentStatement, number] {
    let consumed = 0;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    const [lhs, lhsConsumed] = this.unaryExpression(offset);
    consumed += lhsConsumed;

    // Handle compound assignments
    const operatorToken = this.tokens[offset + consumed]?.[0];
    if (
      operatorToken === Token.CompoundArithmeticOp ||
      operatorToken === Token.CompoundBinaryOp
    ) {
      consumed++;
      const operator = this.tokens[offset + lhsConsumed][1].toString();
      const [rhs, rhsConsumed] = this.binaryExpression(offset + consumed);
      consumed += rhsConsumed;

      if (!this.matchNext(offset + consumed, [Token.Semicolon])) {
        throwParserError(
          MissingSemicolonError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected semicolon",
        );
      }
      consumed++;

      let op: ArithmeticOp | BinaryOp;
      let expression: Arithmetic | Binary;
      switch (operatorToken) {
        case Token.CompoundArithmeticOp:
          op = operator.slice(0, -1) as ArithmeticOp;
          expression = new Arithmetic(op, lhs, rhs, line, column);
          break;
        case Token.CompoundBinaryOp:
          op = operator.slice(0, -1) as BinaryOp;
          expression = new Binary(op, lhs, rhs, line, column);
          break;
        default:
          throwParserError(
            BadExpressionError,
            this.tokens[offset + consumed],
            this.index + consumed,
            "invalid compound operator",
          );
      }
      return [
        new AssignmentStatement(
          lhs as SubscriptedIdentifier | Identifier,
          expression,
          line, column
        ),
        consumed,
      ];
    }

    if (this.matchNext(offset + consumed, [Token.EqualsAssmt])) {
      consumed++;
    } else {
      throwParserError(
        BadExpressionError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected `=` in assignment statement",
      );
    }

    let rhs: Expression | SubroutineCall;
    if (this.isSubroutineCall(offset + consumed)) {
      const [subroutineCall, subroutineCallConsumed] = this.subroutineCall(
        offset + consumed,
      );
      rhs = subroutineCall;
      consumed += subroutineCallConsumed;
    } else {
      const [rhsExpression, rhsConsumed] = this.binaryExpression(
        offset + consumed,
      );
      rhs = rhsExpression;
      consumed += rhsConsumed;
    }

    // if (!this.matchNext(tokens.slice(consumed), [Token.Semicolon])) {
    //   throwParserError(
    //     MissingSemicolonError,
    //     tokens[consumed],
    //     this.index + consumed,
    //     "expected semicolon",
    //   );
    // }
    // consumed++;

    return [
      new AssignmentStatement(lhs as SubscriptedIdentifier, rhs, line, column),
      consumed,
    ];
  }

  /**
   * Parses a quantum declaration.
   * @param offset - The current token index.
   * @return A QuantumDeclaration node and the number of tokens consumed.
   */
  quantumDeclaration(
    offset: number,
  ): [QuantumDeclaration, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    const isQubit = this.tokens[offset][0] === Token.Qubit;

    let size: Expression | null = null;
    // Check for size before identifier (supports flexible order)
    if (this.matchNext(offset + consumed, [Token.LSParen])) {
      consumed++;
      const [sizeExpr, sizeConsumed] = this.binaryExpression(
        offset + consumed,
      );
      consumed += sizeConsumed;
      size = sizeExpr;

      if (!this.matchNext(offset + consumed, [Token.RSParen])) {
        throwParserError(
          MissingBraceError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected closing bracket ] for quantum declaration size",
        );
      }
      consumed++;
    }

    if (!this.matchNext(offset + consumed, [Token.Id])) {
      throwParserError(
        BadQregError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected identifier for quantum declaration",
      );
    }

    const identifier = new Identifier(this.tokens[offset + consumed][1] as string, line, column);
    consumed++;

    // Check for size after identifier if not already set (supports flexible order)
    if (size === null && this.matchNext(offset + consumed, [Token.LSParen])) {
      consumed++;
      const [sizeExpr, sizeConsumed] = this.binaryExpression(
        offset + consumed,
      );
      size = sizeExpr;
      consumed += sizeConsumed;

      if (!this.matchNext(offset + consumed, [Token.RSParen])) {
        throwParserError(
          MissingBraceError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected closing bracket ] for quantum declaration size",
        );
      }
      consumed++;
    }

    if (
      !(
        this.matchNext(offset + consumed, [Token.Semicolon]) ||
        this.matchNext(offset + consumed, [Token.Comma]) ||
        this.matchNext(offset + consumed, [Token.RParen])
      )
    ) {
      throwParserError(
        BadQregError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected semicolon, comma, or closing parenthesis after quantum register declaration",
      );
    }
    // Only consume semicolon, if paren or comma that token will be handled in calling function
    if (this.matchNext(offset + consumed, [Token.Semicolon])) {
      consumed++;
    }

    return [new QuantumDeclaration(identifier as Identifier, size, line, column), consumed];
  }

  /**
   * Parses a measure statement.
   * @param offset - The current token index.
   * @return A tuple containing the QuantumMeasurementAssignment or QuantumMeasurement and the number of tokens consumed.
   */
  measureStatement(
    offset: number,
  ): [QuantumMeasurementAssignment | QuantumMeasurement, number] {
    let consumed = 0;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];

    // Legacy syntax: measure qubit|qubit[] -> bit|bit[];
    if (this.matchNext(offset + consumed, [Token.Measure])) {
      consumed++;
      const qubitIdentifiers: (Identifier | SubscriptedIdentifier | HardwareQubit)[] = [];
      while (
        !(
          this.matchNext(offset + consumed, [Token.Arrow]) ||
          this.matchNext(offset + consumed, [Token.Semicolon])
        )
      ) {
        const [identifier, idConsumed] = this.unaryExpression(
          offset + consumed,
        );
        qubitIdentifiers.push(identifier as Identifier | SubscriptedIdentifier | HardwareQubit);
        consumed += idConsumed;

        if (this.matchNext(offset + consumed, [Token.Comma])) {
          consumed++;
        } else if (
          !(
            this.matchNext(offset + consumed, [Token.Arrow]) ||
            this.matchNext(offset + consumed, [Token.Semicolon])
          )
        ) {
          throwParserError(
            BadMeasurementError,
            this.tokens[offset + consumed],
            this.index + consumed,
            "expected comma or arrow in measurement statement",
          );
        }
      }
      const measurement = new QuantumMeasurement(qubitIdentifiers, line, column);

      // If there's an arrow, build a QuantumMeasurementAssignment
      if (this.matchNext(offset + consumed, [Token.Arrow])) {
        consumed++;
        const [identifier, idConsumed] = this.unaryExpression(
          offset + consumed,
        );
        const classicalBit = identifier as Identifier | SubscriptedIdentifier;
        consumed += idConsumed;

        if (!this.matchNext(offset + consumed, [Token.Semicolon])) {
          throwParserError(
            MissingSemicolonError,
            this.tokens[offset + consumed],
            this.index + consumed,
          );
        }
        consumed++;
        return [
          new QuantumMeasurementAssignment(
            classicalBit as Identifier,
            measurement,
            line, column
          ),
          consumed,
        ];
      } else {
        if (!this.matchNext(offset + consumed, [Token.Semicolon])) {
          throwParserError(
            MissingSemicolonError,
            this.tokens[offset + consumed],
            this.index + consumed,
          );
        }
        consumed++;

        return [measurement, consumed];
      }
    }
    // New syntax: bit|bit[] = measure qubit|qreg;
    else {
      const [leftIdentifier, leftIdConsumed] = this.unaryExpression(
        offset + consumed,
      );
      const classicalBit = leftIdentifier as Identifier | SubscriptedIdentifier;
      consumed += leftIdConsumed;

      if (!this.matchNext(offset + consumed, [Token.EqualsAssmt])) {
        throwParserError(
          BadMeasurementError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected `=` in measurement assignment",
        );
      }
      consumed++;

      if (!this.matchNext(offset + consumed, [Token.Measure])) {
        throwParserError(
          BadMeasurementError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected `measure` keyword in measurement assignment",
        );
      }
      consumed++;

      const [rightIdentifier, rightIdConsumed] = this.unaryExpression(
        offset + consumed,
      );
      const qubitIdentifier = rightIdentifier as
        | Identifier
        | SubscriptedIdentifier
        | HardwareQubit;
      consumed += rightIdConsumed;

      if (!this.matchNext(offset + consumed, [Token.Semicolon])) {
        throwParserError(
          MissingSemicolonError,
          this.tokens[offset + consumed],
          this.index + consumed,
        );
      }
      consumed++;

      const measurement = new QuantumMeasurement([
        qubitIdentifier as Identifier | HardwareQubit,
      ], line, column);
      return [
        new QuantumMeasurementAssignment(
          classicalBit as Identifier,
          measurement,
          line, column
        ),
        consumed,
      ];
    }
  }

  /**
   * Parses a subroutine return statement.
   * @param offset - The current token index.
   * @return A tuple containing the SubroutineDefinition and the number of tokens consumed.
   */
  returnStatement(
    offset: number,
  ): [ReturnStatement, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    let expression: Array<Expression | QuantumMeasurement> | undefined = undefined;

    if (!this.matchNext(offset + consumed, [Token.Semicolon])) {
      const [nodes, exprConsumed] = this.parseNode(offset + consumed);
      expression = [nodes[0] as Expression | QuantumMeasurement];
      consumed += exprConsumed;
    }

    return [new ReturnStatement(expression, line, column), consumed];
  }

  /**
   * Parses an extern signature.
   * @param offset - The current token index.
   * @return A tuple containing the ExternSignature and the number of tokens consumed.
   */
  externSignature(
    offset: number,
  ): [ExternSignature, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    if (!this.matchNext(offset + consumed, [Token.Id])) {
      throwParserError(
        BadSubroutineError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected identifier following extern keyword",
      );
    }
    const [identifier, identifierConsumed] = this.unaryExpression(
      offset + consumed,
    );
    consumed += identifierConsumed;

    let externParams: Parameters = null;
    if (this.matchNext(offset + consumed, [Token.LParen])) {
      const [params, paramsConsumed] = this.parseParameters(
        offset + consumed,
      );
      externParams = params;
      consumed += paramsConsumed;
    }

    let returnType: ClassicalType = null;
    if (this.matchNext(offset + consumed, [Token.Arrow])) {
      consumed++;
      const [type, typeConsumed] = this.parseClassicalType(
        offset + consumed,
      );
      returnType = type;
      consumed += typeConsumed;
    }

    if (!this.matchNext(offset + consumed, [Token.Semicolon])) {
      throwParserError(
        MissingSemicolonError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected semicolon",
      );
    }
    consumed++;

    return [
      new ExternSignature(identifier as Identifier, externParams, returnType, line, column),
      consumed,
    ];
  }

  /**
   * Parses a subroutine definition.
   * @param offset - The current token index.
   * @return A tuple containing the SubroutineDefinition and the number of tokens consumed.
   */
  subroutineDefinition(
    offset: number,
  ): [SubroutineDefinition, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];

    if (!this.matchNext(offset + consumed, [Token.Id])) {
      throwParserError(
        BadSubroutineError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected subroutine name",
      );
    }
    const [name, nameConsumed] = this.unaryExpression(offset + consumed);
    consumed += nameConsumed;

    if (!this.matchNext(offset + consumed, [Token.LParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected opening parenthesis for subroutine definition",
      );
    }
    const [params, paramsConsumed] = this.parseParameters(
      offset + consumed,
    );
    consumed += paramsConsumed;

    let returnType: ClassicalType | null = null;
    if (this.matchNext(offset + consumed, [Token.Arrow])) {
      consumed++;
      const [type, typeConsumed] = this.parseClassicalType(
        offset + consumed,
      );
      returnType = type;
      consumed += typeConsumed;
    }

    if (!this.matchNext(offset + consumed, [Token.LCParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected opening brace for subroutine body",
      );
    }
    const [body, bodyConsumed] = this.programBlock(offset + consumed);
    consumed += bodyConsumed;

    return [
      new SubroutineDefinition(
        name as Identifier,
        body as SubroutineBlock,
        params,
        returnType,
        line, column
      ),
      consumed,
    ];
  }

  /**
   * Parses a subroutine call.
   * @param offset - The current token index.
   * @return A tuple containing the SubroutineCall and the number of tokens consumed.
   */
  subroutineCall(
    offset: number,
  ): [SubroutineCall, number] {
    let consumed = 0;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    if (!this.matchNext(offset + consumed, [Token.Id])) {
      throwParserError(
        BadSubroutineError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected subroutine name",
      );
    }
    const [subroutineName, subroutineNameConsumed] = this.unaryExpression(
      offset + consumed,
    );
    consumed += subroutineNameConsumed;

    let callParams: Parameters | null = null;
    if (this.matchNext(offset + consumed, [Token.LParen])) {
      const [params, paramsConsumed] = this.parseParameters(
        offset + consumed,
      );
      callParams = params;
      consumed += paramsConsumed;
    }

    // if (!this.matchNext(tokens.slice(consumed), [Token.Semicolon])) {
    //   throwParserError(
    //     MissingSemicolonError,
    //     tokens[consumed],
    //     this.index + consumed,
    //     "expected semicolon after subroutine call",
    //   );
    // }
    if (this.matchNext(offset + consumed, [Token.Semicolon])) {
      consumed++;
    }

    return [
      new SubroutineCall(subroutineName as Identifier, callParams, line, column),
      consumed,
    ];
  }

  /**
   * Parses a quantum gate definition.
   * @param offset - The current token index.
   * @return A tuple containing the QuantumGateDefinition and the number of tokens consumed.
   */
  quantumGateDefinition(
    offset: number,
  ): [QuantumGateDefinition, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];

    if (!this.matchNext(offset + consumed, [Token.Id])) {
      throwParserError(
        BadGateError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected gate name",
      );
    }
    const [name, nameConsumed] = this.unaryExpression(offset + consumed);
    consumed += nameConsumed;

    // Parse optional parameters
    const [params, paramsConsumed] = this.parseParameters(
      offset + consumed,
    );
    consumed += paramsConsumed;

    // Parse qubits
    const qubits: Array<Identifier> = [];
    while (!this.matchNext(offset + consumed, [Token.LCParen])) {
      if (!this.matchNext(offset + consumed, [Token.Id])) {
        throwParserError(
          BadGateError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected qubit argument",
        );
      }
      const [qubit, qubitConsumed] = this.unaryExpression(
        offset + consumed,
      );
      qubits.push(qubit as Identifier | SubscriptedIdentifier);
      consumed += qubitConsumed;

      if (this.matchNext(offset + consumed, [Token.Comma])) {
        consumed++;
      } else if (!this.matchNext(offset + consumed, [Token.LCParen])) {
        throwParserError(
          BadGateError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected comma or opening brace for gate body",
        );
      }
    }

    const [body, bodyConsumed] = this.programBlock(offset + consumed);
    consumed += bodyConsumed;

    return [
      new QuantumGateDefinition(
        name as Identifier,
        params,
        qubits,
        body as QuantumBlock,
        line, column
      ),
      consumed,
    ];
  }

  /**
   * Parses a quantum gate call.
   * @param offset - The current token index.
   * @return A tuple containing the QuantumGateCall and the number of tokens consumed.
   */
  quantumGateCall(
    offset: number,
  ): [QuantumGateCall, number] {
    let consumed = 0;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    const modifiers: Array<QuantumGateModifier> = [];

    // Parse modifier(s)
    while (
      this.matchNext(offset + consumed, [Token.Ctrl]) ||
      this.matchNext(offset + consumed, [Token.NegCtrl]) ||
      this.matchNext(offset + consumed, [Token.Inv]) ||
      this.matchNext(offset + consumed, [Token.PowM])
    ) {
      const [modifier, modifierConsumed] = this.parseQuantumGateModifier(
        offset + consumed,
      );
      modifiers.push(modifier);
      consumed += modifierConsumed;
    }

    // Parse gate name
    if (!this.matchNext(offset + consumed, [Token.Id])) {
      throwParserError(
        BadGateError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected gate name",
      );
    }
    const [gateName, gateNameConsumed] = this.unaryExpression(
      offset + consumed,
    );
    consumed += gateNameConsumed;

    let callParams: Parameters = null;
    // Parse optional parameters
    if (this.matchNext(offset + consumed, [Token.LParen])) {
      const [params, paramsConsumed] = this.parseParameters(
        offset + consumed,
      );
      callParams = params;
      consumed += paramsConsumed;
    }

    // Parse qubit arguments
    const [qubits, qubitsConsumed] = this.parseQubitList(
      offset + consumed,
    );
    consumed += qubitsConsumed;

    if (!this.matchNext(offset + consumed, [Token.Semicolon])) {
      throwParserError(
        MissingSemicolonError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected semicolon",
      );
    }
    consumed++;

    return [
      new QuantumGateCall(
        gateName as Identifier,
        qubits,
        callParams,
        modifiers,
        line, column
      ),
      consumed,
    ];
  }

  /**
   * Parses a list of qubits.
   * @param offset - The current token index.
   * @return A tuple containing the list of qubits and the number of tokens consumed.
   */
  parseQubitList(
    offset: number,
  ): [Array<Identifier | SubscriptedIdentifier | HardwareQubit>, number] {
    let consumed = 0;
    const qubits: Array<Identifier | SubscriptedIdentifier | HardwareQubit> =
      [];

    while (!this.matchNext(offset + consumed, [Token.Semicolon])) {
      if (
        this.matchNext(offset + consumed, [Token.HardwareQubit]) ||
        this.matchNext(offset + consumed, [Token.Dollar, Token.NNInteger])
      ) {
        const [hardwareQubit, hardwareQubitConsumed] = this.parseHardwareQubit(
          offset + consumed,
        );
        qubits.push(hardwareQubit);
        consumed += hardwareQubitConsumed;
        if (this.matchNext(offset + consumed, [Token.Comma])) {
          consumed++;
        }
        continue;
      } else if (!this.matchNext(offset + consumed, [Token.Id])) {
        throwParserError(
          BadExpressionError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected qubit argument",
        );
      }
      const [qubit, qubitConsumed] = this.unaryExpression(
        offset + consumed,
      );
      qubits.push(qubit as Identifier);
      consumed += qubitConsumed;

      if (this.matchNext(offset + consumed, [Token.Comma])) {
        consumed++;
        if (this.matchNext(offset + consumed, [Token.Semicolon])) {
          throwParserError(
            BadExpressionError,
            this.tokens[offset + consumed],
            this.index + consumed,
            "trailing comma not allowed in qubit list",
          );
        }
      } else if (!this.matchNext(offset + consumed, [Token.Semicolon])) {
        break;
      }
    }

    return [qubits, consumed];
  }

  /**
   * Parses a hardware qubit.
   * @param offset - The current token index.
   * @return A tuple containing the HardwareQubit and the number of tokens consumed.
   */
  parseHardwareQubit(
    offset: number,
  ): [HardwareQubit, number] {
    let consumed = 0;

    if (this.matchNext(offset + consumed, [Token.HardwareQubit])) {
      const num = Number(this.tokens[offset + consumed][1]);
      const line = this.tokens[offset + consumed][2];
      const column = this.tokens[offset + consumed][3];
      return [new HardwareQubit(num, line, column), 1];
    }

    if (!this.matchNext(offset + consumed, [Token.Dollar])) {
      throwParserError(
        BadGateError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected dollar sign for hardware qubit",
      );
    }
    consumed++;
    if (!this.matchNext(offset + consumed, [Token.NNInteger])) {
      throwParserError(
        BadGateError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected non-negative integer for hardware qubit",
      );
    }
    return [new HardwareQubit(Number(this.tokens[offset + consumed][1]), this.tokens[offset][2], this.tokens[offset][3]), consumed + 1];
  }

  /**
   * Parses a gate modifier.
   * @param offset - The current token index.
   * @return A tuple containing the gate modifier and the number of tokens consumed.
   */
  parseQuantumGateModifier(
    offset: number,
  ): [QuantumGateModifier, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    const modifierToken = this.tokens[offset][0];
    let modifier: QuantumGateModifierName;
    let argument: Expression | null = null;

    switch (modifierToken) {
      case Token.Ctrl:
        modifier = QuantumGateModifierName.CTRL;
        break;
      case Token.NegCtrl:
        modifier = QuantumGateModifierName.NRGCTRL;
        break;
      case Token.Inv:
        modifier = QuantumGateModifierName.INV;
        break;
      case Token.PowM:
        modifier = QuantumGateModifierName.POW;
        break;
      default:
        throwParserError(
          BadGateError,
          this.tokens[offset],
          this.index,
          "invalid gate modifier",
        );
    }

    if (this.matchNext(offset + consumed, [Token.LParen])) {
      consumed++;
      const [arg, argConsumed] = this.binaryExpression(offset + consumed);
      argument = arg;
      consumed += argConsumed;

      if (!this.matchNext(offset + consumed, [Token.RParen])) {
        throwParserError(
          BadGateError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected closing parenthesis after gate modifier argument",
        );
      }
      consumed++;
    }

    if (!this.matchNext(offset + consumed, [Token.At])) {
      throwParserError(
        BadGateError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected `@` symbol after gate modifier",
      );
    }
    consumed++;

    return [new QuantumGateModifier(modifier, argument, line, column), consumed];
  }

  /**
   * Parses a set of parameters.
   * @param offset - The current token index.
   * @return A tuple containing the Parameters and the number of tokens consumed.
   */
  parseParameters(
    offset: number,
  ): [Parameters, number] {
    let consumed = 0;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    const args: Array<any> = [];

    if (this.matchNext(offset, [Token.LParen])) {
      consumed++;
      while (!this.matchNext(offset + consumed, [Token.RParen])) {
        if (this.matchNext(offset + consumed, [Token.Qubit])) {
          const [qubitParam, qubitConsumed] = this.parseNode(
            offset + consumed,
          );
          args.push(qubitParam[0]);
          consumed += qubitConsumed;
        } else if (
          this.matchNext(offset + consumed, [Token.Bit]) ||
          this.matchNext(offset + consumed, [Token.CReg])
        ) {
          const [bitParam, bitConsumed] = this.parseNode(
            offset + consumed,
          );
          args.push(bitParam[0]);
          consumed += bitConsumed;
        } else if (isTypeToken(this.tokens[offset + consumed][0])) {
          const [param, paramConsumed] = this.classicalDeclaration(
            offset + consumed,
          );
          args.push(param);
          consumed += paramConsumed;
        } else if (
          this.matchNext(offset + consumed, [Token.ReadOnly]) ||
          this.matchNext(offset + consumed, [Token.Mutable])
        ) {
          const [arrayRef, arrayRefConsumed] = this.parseArrayReference(
            offset + consumed,
          );
          args.push(arrayRef);
          consumed += arrayRefConsumed;
        } else {
          const [param, paramConsumed] = this.binaryExpression(
            offset + consumed,
          );
          args.push(param);
          consumed += paramConsumed;
        }

        if (this.matchNext(offset + consumed, [Token.Comma])) {
          consumed++;
        } else if (!this.matchNext(offset + consumed, [Token.RParen])) {
          throwParserError(
            BadParameterError,
            this.tokens[offset + consumed],
            this.index + consumed,
            "expected comma or closing parenthesis in parameter list",
          );
        }
      }
      consumed++;
    }

    return [new Parameters(args, line, column), consumed];
  }

  /**
   * Parses an array reference.
   * @param offset - The current token index.
   * @return A tuple containing the ArrayReference and the number of tokens consumed.
   */
  parseArrayReference(
    offset: number,
  ): [ArrayReference, number] {
    let consumed = 0;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    let modifier: ArrayReferenceModifier;
    switch (this.tokens[offset + consumed][0]) {
      case Token.Mutable:
        modifier = ArrayReferenceModifier.MUTABLE;
        break;
      case Token.ReadOnly:
        modifier = ArrayReferenceModifier.READONLY;
        break;
      default:
        throwParserError(
          BadExpressionError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "unsupported array reference modifier",
        );
    }
    consumed++;

    const [arrayNode, arrayConsumed] = this.arrayDeclaration(
      offset + consumed,
    );
    consumed += arrayConsumed;

    return [new ArrayReference(arrayNode, modifier, line, column), consumed];
  }

  /**
   * Parses an alias statement.
   * @param offset - The current token index.
   * @return A tuple containing the AliasStatement and the number of tokens consumed.
   */
  aliasStatement(
    offset: number,
  ): [AliasStatement, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];

    if (!this.matchNext(offset + consumed, [Token.Id])) {
      throwParserError(
        BadExpressionError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected identifier for alias statement",
      );
    }
    const [identifier, identifierConsumed] = this.unaryExpression(
      offset + consumed,
    );
    consumed += identifierConsumed;

    if (!this.matchNext(offset + consumed, [Token.EqualsAssmt])) {
      throwParserError(
        BadExpressionError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected `=` symbol following identifier for alias statement",
      );
    }
    consumed++;

    const [aliasExpression, aliasExpressionConsumed] = this.binaryExpression(
      offset + consumed,
    );
    consumed += aliasExpressionConsumed;

    if (!this.matchNext(offset + consumed, [Token.Semicolon])) {
      throwParserError(
        MissingSemicolonError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected semicolon",
      );
    }
    consumed++;

    return [
      new AliasStatement(identifier as Identifier, aliasExpression, line, column),
      consumed,
    ];
  }

  /**
   * Parses a quantum reset.
   * @param offset - The current token index.
   * @return A tuple containing the QuantumReset and the number of tokens consumed.
   */
  resetStatement(
    offset: number,
  ): [QuantumReset, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];

    if (
      !this.matchNext(offset + consumed, [Token.Id]) &&
      !this.matchNext(offset + consumed, [Token.Dollar]) &&
      !this.matchNext(offset + consumed, [Token.HardwareQubit])
    ) {
      throwParserError(
        BadQuantumInstructionError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected identifier or hardware qubit after reset keyword",
      );
    }
    const [idNode, idConsumed] = this.unaryExpression(offset + consumed);
    consumed += idConsumed;

    let id: Identifier | SubscriptedIdentifier | HardwareQubit | undefined = undefined;
    if (idNode instanceof SubscriptedIdentifier) {
      id = idNode as SubscriptedIdentifier;
    } else if (idNode instanceof HardwareQubit) {
      id = idNode as HardwareQubit;
    } else {
      id = idNode as Identifier;
    }
    consumed++;

    return [new QuantumReset(id, line, column), consumed];
  }

  /**
   * Parses a subscript expression as a Range.
   * @param offset - The current token index.
   * @return A tuple containing the parsed Expression or Range and the number of tokens consumed.
   */
  parseSubscript(
    offset: number,
  ): [Expression | Range | IndexSet, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    let start: Expression;
    let step: Expression = new IntegerLiteral(1, line, column);
    let stop: Expression | undefined = undefined;

    if (this.matchNext(offset + consumed, [Token.LCParen])) {
      const [indexSet, indexSetConsumed] = this.parseIndexSet(
        offset + consumed,
      );
      consumed += indexSetConsumed;
      if (!this.matchNext(offset + consumed, [Token.RSParen])) {
        throwParserError(
          MissingBraceError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected closing curly bracket } for index set",
        );
      }
      consumed++;
      return [indexSet, consumed];
    }

    if (!this.matchNext(offset + consumed, [Token.Colon])) {
      // Parse start
      const [startExpr, startConsumed] = this.binaryExpression(
        offset + consumed,
      );
      start = startExpr;
      consumed += startConsumed;
    }

    if (this.matchNext(offset + consumed, [Token.RSParen])) {
      return [start!, consumed + 1];
    }

    // Check for colon after start
    if (!this.matchNext(offset + consumed, [Token.Colon])) {
      throwParserError(
        BadExpressionError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected colon in range expression",
      );
    }
    consumed++;

    if (!this.matchNext(offset + consumed, [Token.RSParen])) {
      const [expr, exprConsumed] = this.binaryExpression(
        offset + consumed,
      );
      consumed += exprConsumed;

      // Check if its a step or stop
      if (this.matchNext(offset + consumed, [Token.Colon])) {
        step = expr;
        consumed++;

        // Parse stop
        if (this.matchNext(offset + consumed, [Token.RSParen])) {
          throwParserError(
            BadExpressionError,
            this.tokens[offset + consumed],
            this.index + consumed,
            "expected stop value in range expression",
          );
        }
        const [stopExpr, stopConsumed] = this.binaryExpression(
          offset + consumed,
        );
        stop = stopExpr;
        consumed += stopConsumed;
      } else {
        stop = expr;
      }
    }

    // Check for closing square bracket
    if (!this.matchNext(offset + consumed, [Token.RSParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected closing bracket ] for range expression",
      );
    }
    consumed++;

    // Validate that both start and stop are provided
    if (stop === undefined) {
      throwParserError(
        BadExpressionError,
        this.tokens[offset],
        this.index,
        "both start and stop must be provided in range expression",
      );
    }

    return [new Range(start, stop, step, line, column), consumed];
  }

  /**
   * Parses a type cast expression.
   * @param offset - The current token index.
   * @return A tuple containing the parsed Cast Expression and the number of tokens consumed.
   */
  parseTypeCast(
    offset: number,
  ): [Expression, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    let widthExpr: Expression | null = null;
    if (this.matchNext(offset + consumed, [Token.LSParen])) {
      consumed++;
      const [width, widthConsumed] = this.binaryExpression(
        offset + consumed,
      );
      consumed += widthConsumed;
      widthExpr = width;
      if (!this.matchNext(offset + consumed, [Token.RSParen])) {
        throwParserError(
          MissingBraceError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "missing closing bracket ] for type designator",
        );
      }
      consumed++;
    }

    if (!this.matchNext(offset + consumed, [Token.LParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset],
        this.index,
        "expected opening parenthesis ( for type cast",
      );
    }
    consumed++;
    const [castExpr, castConsumed] = this.binaryExpression(
      offset + consumed,
    );
    consumed += castConsumed;
    if (!this.matchNext(offset + consumed, [Token.RParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset],
        this.index,
        "expected closing parenthesis ) for type cast",
      );
    }
    consumed++;
    const castType = this.createClassicalType(this.tokens[offset][0], line, column, widthExpr);
    return [new Cast(castType, castExpr, line, column), consumed];
  }

  /**
   * Parses a branching condition (if) statement.
   * @param offset - The current token index.
   * @return A BranchingStatement node representing the if statement and the number of tokens consumed.
   */
  ifStatement(
    offset: number,
  ): [BranchingStatement, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    if (!this.matchNext(offset + consumed, [Token.LParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected opening parenthesis after if",
      );
    }
    consumed++;

    const [condition, conditionConsumed] = this.binaryExpression(
      offset + consumed,
    );
    consumed += conditionConsumed;

    if (!this.matchNext(offset + consumed, [Token.RParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected closing parenthesis after if statement condition",
      );
    }
    consumed++;

    const [trueBody, trueBodyConsumed] = this.programBlock(
      offset + consumed,
    );
    consumed += trueBodyConsumed;

    let falseBody: ProgramBlock | null = null;
    if (this.matchNext(offset + consumed, [Token.Else])) {
      consumed++;
      const [elseBody, elseBodyConsumed] = this.programBlock(
        offset + consumed,
      );
      falseBody = elseBody;
      consumed += elseBodyConsumed;
    }

    return [new BranchingStatement(condition, trueBody, falseBody, line, column), consumed];
  }

  /**
   * Parses a for loop.
   * @param offset - The current token index.
   * @return A ForLoopStatement node and the number of tokens consumed.
   */
  forLoopStatement(
    offset: number,
  ): [ForLoopStatement, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];

    // Parse the type of the loop variable
    const [loopVarType, loopVarTypeConsumed] = this.parseClassicalType(
      offset + consumed,
    );
    consumed += loopVarTypeConsumed;

    // Expect an identifier (loop variable)
    if (!this.matchNext(offset + consumed, [Token.Id])) {
      throwParserError(
        BadLoopError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected identifier for loop variable",
      );
    }
    const [loopVar, loopVarConsumed] = this.unaryExpression(
      offset + consumed,
    );
    if (!(loopVar instanceof Identifier)) {
      throwParserError(
        BadLoopError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected identifier for loop variable",
      );
    }
    consumed += loopVarConsumed;

    // Expect `in` keyword
    if (!this.matchNext(offset + consumed, [Token.In])) {
      throwParserError(
        BadLoopError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected `in` keyword in for loop",
      );
    }
    consumed++;

    const [indexSet, indexSetConsumed] = this.parseSetDeclaration(
      offset + consumed,
    );
    consumed += indexSetConsumed;

    const [body, bodyConsumed] = this.programBlock(offset + consumed);
    consumed += bodyConsumed;

    return [
      new ForLoopStatement(indexSet, loopVarType, loopVar as Identifier, body, line, column),
      consumed,
    ];
  }

  /**
   * Parses a while loop.
   * @param offset - The current token index.
   * @return A ForLoopStatement node and the number of tokens consumed.
   */
  whileLoopStatement(
    offset: number,
  ): [WhileLoopStatement, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];

    if (!this.matchNext(offset + consumed, [Token.LParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected opening parenthesis after while keyword",
      );
    }
    consumed++;

    const [condition, conditionConsumed] = this.binaryExpression(
      offset + consumed,
    );
    consumed += conditionConsumed;

    if (!this.matchNext(offset + consumed, [Token.RParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected closing parenthesis after while loop condition",
      );
    }
    consumed++;

    const [body, bodyConsumed] = this.programBlock(offset + consumed);
    consumed += bodyConsumed;

    return [new WhileLoopStatement(condition, body, line, column), consumed];
  }

  /**
   * Parses a barrier statement.
   * @param offset - The current token index.
   * @return An QuantumBarrier node and the number of tokens consumed.
   */
  barrier(
    offset: number,
  ): [QuantumBarrier, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    const [qubits, qubitsConsumed] = this.parseQubitList(
      offset + consumed,
    );
    consumed += qubitsConsumed;
    return [new QuantumBarrier(qubits, line, column), consumed];
  }

  /**
   * Parses a box statement.
   * @param offset - The current token index.
   * @return An BoxDefinition node and the number of tokens consumed.
   */
  box(offset: number): [BoxDefinition, number] {
    let consumed = 1;
    let designator: Expression | null = null;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];

    if (this.matchNext(offset + consumed, [Token.LSParen])) {
      consumed++;
      const [desginatorNode, designatorConsumed] = this.binaryExpression(
        offset + consumed,
      );
      consumed += designatorConsumed;
      designator = desginatorNode;
      if (!this.matchNext(offset + consumed, [Token.RSParen])) {
        throwParserError(
          MissingBraceError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected closing ] bracket following box designator",
        );
      }
      consumed++;
    }

    const [scope, scopeConsumed] = this.programBlock(offset + consumed);
    consumed += scopeConsumed;

    return [new BoxDefinition(scope, designator, line, column), consumed];
  }

  /**
   * Parses an array statement.
   * @param offset - The current token index.
   * @return An ArrayDeclaration node and the number of tokens consumed.
   */
  arrayDeclaration(
    offset: number,
  ): [ArrayDeclaration, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    if (!this.matchNext(offset + consumed, [Token.LSParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected [ after array keyword",
      );
    }
    consumed++;

    const [baseType, baseTypeConsumed] = this.parseClassicalType(
      offset + consumed,
    );
    consumed += baseTypeConsumed;

    let dimensions: Array<Expression> | number = [];
    while (this.matchNext(offset + consumed, [Token.Comma])) {
      consumed++;
      if (
        this.matchNext(offset + consumed, [
          Token.Dim,
          Token.EqualsAssmt,
          Token.NNInteger,
        ])
      ) {
        consumed += 2;
        dimensions = Number(this.tokens[offset + consumed][1]);
        consumed++;
        break;
      }
      const [dimension, dimensionConsumed] = this.binaryExpression(
        offset + consumed,
      );
      dimensions.push(dimension);
      consumed += dimensionConsumed;
    }
    if (!this.matchNext(offset + consumed, [Token.RSParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected ] after array type declaration",
      );
    }
    consumed++;

    if (!this.matchNext(offset + consumed, [Token.Id])) {
      throwParserError(
        BadExpressionError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected identifier for array declaration",
      );
    }
    const [identifier, identifierConsumed] = this.unaryExpression(
      offset + consumed,
    );
    consumed += identifierConsumed;

    let initializer: ArrayInitializer | Expression | null = null;
    if (this.matchNext(offset + consumed, [Token.EqualsAssmt])) {
      consumed++;
      const [parsedInitializer, initializerConsumed] =
        this.parseArrayInitializer(offset + consumed);
      initializer = parsedInitializer;
      consumed += initializerConsumed;
    }

    if (this.matchNext(offset + consumed, [Token.Semicolon])) {
      consumed++;
    }

    return [
      new ArrayDeclaration(
        baseType,
        dimensions,
        identifier as Identifier,
        initializer,
        line, column
      ),
      consumed,
    ];
  }

  /**
   * Parses an array initializer.
   * @param offset - The current token index.
   * @return An ArrayInitializer node and the number of tokens consumed.
   */
  parseArrayInitializer(
    offset: number,
  ): [ArrayInitializer | Expression, number] {
    let consumed = 0;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    if (!this.matchNext(offset, [Token.LCParen])) {
      const [expr, exprConsumed] = this.binaryExpression(
        offset + consumed,
      );
      consumed += exprConsumed;
      return [expr, consumed];
    }
    consumed++;

    const values: Array<Expression | ArrayInitializer> = [];
    while (!this.matchNext(offset + consumed, [Token.RCParen])) {
      if (this.matchNext(offset + consumed, [Token.LCParen])) {
        const [subInitializer, subConsumed] = this.parseArrayInitializer(
          offset + consumed,
        );
        values.push(subInitializer);
        consumed += subConsumed;
      } else {
        const [expr, exprConsumed] = this.binaryExpression(
          offset + consumed,
        );
        values.push(expr);
        consumed += exprConsumed;
      }

      if (this.matchNext(offset + consumed, [Token.Comma])) {
        consumed++;
      } else if (!this.matchNext(offset + consumed, [Token.RCParen])) {
        throwParserError(
          BadExpressionError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected comma or } in array initializer",
        );
      }
    }
    consumed++;

    return [new ArrayInitializer(values, line, column), consumed];
  }

  /**
   * Parses an array access.
   * @param offset - The current token index.
   * @return An ArrayAccess  node and the number of tokens consumed.
   */
  parseArrayAccess(
    offset: number,
    line: number,
    column: number
  ): [ArrayAccess, number] {
    let consumed = 0;
    if (!this.matchNext(offset + consumed, [Token.Id])) {
      throwParserError(
        BadExpressionError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected identifier for array access",
      );
    }
    const identifier = new Identifier(this.tokens[offset][1].toString(), line, column);
    consumed++;

    let indices: Array<Expression> | Range = [];
    if (this.matchNext(offset + consumed, [Token.LSParen])) {
      consumed++;
      while (!this.matchNext(offset + consumed, [Token.RSParen])) {
        const [index1, index1Consumed] = this.binaryExpression(
          offset + consumed,
        );
        indices.push(index1);
        consumed += index1Consumed;

        if (this.matchNext(offset + consumed, [Token.Comma])) {
          consumed++;
        } else if (this.matchNext(offset + consumed, [Token.Colon])) {
          consumed++;
          let step: Expression = new IntegerLiteral(1);
          let stop: Expression;
          const [index2, index2Consumed] = this.binaryExpression(
            offset + consumed,
          );
          consumed += index2Consumed;
          if (this.matchNext(offset + consumed, [Token.Colon])) {
            consumed++;
            const [index3, index3Consumed] = this.binaryExpression(
              offset + consumed,
            );
            consumed += index3Consumed;
            stop = index3;
            step = index2;
          } else {
            stop = index2;
          }
          indices = new Range(index1, stop, step, line, column);
          break;
        } else if (!this.matchNext(offset + consumed, [Token.RSParen])) {
          throwParserError(
            BadExpressionError,
            this.tokens[offset + consumed],
            this.index + consumed,
            "expected comma or closing bracket for array access",
          );
        }
      }

      if (!this.matchNext(offset + consumed, [Token.RSParen])) {
        throwParserError(
          MissingBraceError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected closing bracket ] for array access",
        );
      }
      consumed++;
    }

    return [new ArrayAccess(identifier, indices, line, column), consumed];
  }

  /**
   * Parses a switch statement.
   * @param offset - The current token index.
   * @return A SwitchStatement node and the number of tokens consumed.
   */
  switchStatement(
    offset: number,
  ): [SwitchStatement, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];

    if (!this.matchNext(offset + consumed, [Token.LParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected opening parenthesis after switch keywork",
      );
    }
    consumed++;

    const [controlExpr, controlExprConsumed] = this.binaryExpression(
      offset + consumed,
    );
    consumed += controlExprConsumed;

    if (!this.matchNext(offset + consumed, [Token.RParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected closing parenthesis after switch control expression",
      );
    }
    consumed++;

    if (!this.matchNext(offset + consumed, [Token.LCParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected opening curly brace for switch body",
      );
    }
    consumed++;

    const cases: Array<CaseStatement> = [];
    let defaultCase: DefaultStatement | null = null;

    while (!this.matchNext(offset + consumed, [Token.RCParen])) {
      if (this.matchNext(offset + consumed, [Token.Case])) {
        const [caseStmt, caseConsumed] = this.parseCaseStatement(
          offset + consumed,
        );
        cases.push(caseStmt);
        consumed += caseConsumed;
      } else if (this.matchNext(offset + consumed, [Token.Default])) {
        if (defaultCase !== null) {
          throwParserError(
            BadExpressionError,
            this.tokens[offset + consumed],
            this.index + consumed,
            "multiple default statements not allowed in a swtich statement",
          );
        }
        const [defaultStmt, defaultConsumed] = this.parseDefaultStatement(
          offset + consumed,
        );
        defaultCase = defaultStmt;
        consumed += defaultConsumed;
      } else {
        throwParserError(
          BadExpressionError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected case or default statement in switch body",
        );
      }
    }

    if (cases.length === 0) {
      throwParserError(
        BadExpressionError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "swtich statement must contain at least one case statement",
      );
    }
    consumed++;

    return [new SwitchStatement(controlExpr, cases, defaultCase, line, column), consumed];
  }

  /**
   * Parses a case statement.
   * @param offset - The current token index.
   * @return A CaseStatement node and the number of tokens consumed.
   */
  parseCaseStatement(
    offset: number,
  ): [CaseStatement, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    const labels: Array<Expression> = [];

    while (!this.matchNext(offset + consumed, [Token.LCParen])) {
      const [label, labelConsumed] = this.binaryExpression(
        offset + consumed,
      );
      labels.push(label);
      consumed += labelConsumed;

      if (this.matchNext(offset + consumed, [Token.Comma])) {
        consumed++;
      } else if (!this.matchNext(offset + consumed, [Token.LCParen])) {
        throwParserError(
          BadExpressionError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected comma or opening brace in case statement",
        );
      }
    }

    const [body, bodyConsumed] = this.programBlock(offset + consumed);
    consumed += bodyConsumed;

    return [new CaseStatement(labels, body, line, column), consumed];
  }

  /**
   * Parses a default statement.
   * @param offset - The current token index.
   * @return A DefaultStatement node and the number of tokens consumed.
   */
  parseDefaultStatement(
    offset: number,
  ): [DefaultStatement, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];

    if (!this.matchNext(offset + consumed, [Token.LCParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expecting opening brace for default statement",
      );
    }

    const [body, bodyConsumed] = this.programBlock(offset + consumed);
    consumed += bodyConsumed;

    return [new DefaultStatement(body, line, column), consumed];
  }

  /**
   * Parses a delay statement.
   * @param offset - The current token index.
   * @return A QuantumDelay node and the number of tokens consumed.
   */
  delay(offset: number): [QuantumDelay, number] {
    let consumed = 1;

    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    if (!this.matchNext(offset + consumed, [Token.LSParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected opening bracket [ after delay keyword",
      );
    }
    consumed++;

    const [duration, durationConsumed] = this.binaryExpression(
      offset + consumed,
    );
    consumed += durationConsumed;
    if (!this.matchNext(offset + consumed, [Token.RSParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected closing bracket ] after delay designator",
      );
    }
    consumed++;

    const [qubits, qubitsConsumed] = this.parseQubitList(
      offset + consumed,
    );
    consumed += qubitsConsumed;

    if (!this.matchNext(offset + consumed, [Token.Semicolon])) {
      throwParserError(
        MissingSemicolonError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected semicolon",
      );
    }
    consumed++;

    return [new QuantumDelay(duration, qubits, line, column), consumed];
  }

  /**
   * Parses a durationof function call.
   * @param offset - The current token index.
   * @return A DurationOf node and the number of tokens consumed.
   */
  durationOf(offset: number, line: number, column: number): [DurationOf, number] {
    let consumed = 1;


    if (!this.matchNext(offset + consumed, [Token.LParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected opening parenthesis after durationof",
      );
    }
    consumed++;

    if (!this.matchNext(offset + consumed, [Token.LCParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected opening brace for durationof scope",
      );
    }
    const [scope, scopeConsumed] = this.programBlock(offset + consumed);
    consumed += scopeConsumed;

    if (!this.matchNext(offset + consumed, [Token.RParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected closing parenthesis after durationof scope",
      );
    }
    consumed++;

    if (this.matchNext(offset + consumed, [Token.Semicolon])) {
      consumed++;
    }

    return [new DurationOf(scope, line, column), consumed];
  }

  /**
   * Parses a sizeof function call.
   * @param offset - The current token index.
   * @return A SizeOf node and the number of tokens consumed.
   */
  sizeOf(offset: number): [SizeOf, number] {
    let consumed = 1;
    let dimensions: Expression | null = null;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    if (!this.matchNext(offset + consumed, [Token.LParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected opening parenthesis for sizeof function call",
      );
    }
    consumed++;

    const [arrayId, arrayIdConsumed] = this.unaryExpression(
      offset + consumed,
    );
    consumed += arrayIdConsumed;

    if (this.matchNext(offset + consumed, [Token.Comma])) {
      consumed++;
      const [dim, dimConsumed] = this.binaryExpression(offset + consumed);
      consumed += dimConsumed;
      dimensions = dim;
    }

    if (!this.matchNext(offset + consumed, [Token.RParen])) {
      throwParserError(
        MissingBraceError,
        this.tokens[offset + consumed],
        this.index + consumed,
        "expected closing parenthesis for sizeof function call",
      );
    }
    consumed++;

    return [new SizeOf(arrayId as Identifier, dimensions, line, column), consumed];
  }

  /**
   * Parses a program block.
   * @param offset - The current token index.
   * @return A ProgramBlock node and the number of tokens consumed.
   */
  programBlock(
    offset: number,
  ): [ProgramBlock, number] {
    const statements: (Statement | Expression)[] = [];
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    let consumed = 0;
    let braceCount = 0;

    if (this.matchNext(offset, [Token.LCParen])) {
      consumed++;
      braceCount++;
      while (braceCount > 0 && offset + consumed < this.tokens.length) {
        if (this.matchNext(offset + consumed, [Token.LCParen])) {
          braceCount++;
        } else if (this.matchNext(offset + consumed, [Token.RCParen])) {
          braceCount--;
        }

        if (braceCount === 0) {
          break;
        }

        const [node, nodeConsumed] = this.parseNode(offset + consumed);
        if (node && node.length > 0) {
          statements.push(node[0]);
        }
        consumed += nodeConsumed;

        if (this.matchNext(offset + consumed, [Token.Semicolon])) {
          consumed++;
        }
      }
      if (braceCount !== 0) {
        throwParserError(
          MissingBraceError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "mismatched curly braces in program block",
        );
      }
      consumed++;
    } else {
      const [node, nodeConsumed] = this.parseNode(offset + consumed);
      if (node && node.length > 0) {
        statements.push(node[0]);
      }
      consumed += nodeConsumed;
      if (this.matchNext(offset + consumed, [Token.Semicolon])) {
        consumed++;
      }
    }
    return [new ProgramBlock(statements, line, column), consumed];
  }

  /**
   * Parses an include statement.
   * @param offset - The current token index.
   * @return An Include node representing the include statement and the number of consumed tokens.
   */
  include(offset: number): [Include, number] {
    let filename: string;
    const consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    if (
      this.matchNext(offset + consumed, [Token.String, Token.Semicolon])
    ) {
      filename = this.tokens[offset + consumed][1].toString();
      return [new Include(filename, line, column), consumed + 2];
    }
    throwParserError(
      BadStringLiteralError,
      this.tokens[offset + consumed],
      this.index + consumed,
      "expected string literal following `include` keyword",
    );
  }

  /**
   * Parses the version header and sets the parser version.
   * @param offset - The current token index.
   * @return A Version node representing the version statement and the number of consumed tokens.
   */
  versionHeader(offset: number): [Version, number] {
    let version: OpenQASMVersion;
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    if (this.matchNext(offset + consumed, [Token.NNInteger, Token.Semicolon])) {
      version = new OpenQASMVersion(Number(this.tokens[offset + consumed][1]));
      if (!version.isVersion3()) {
        throwParserError(
          UnsupportedOpenQASMVersionError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected QASM version 3",
        );
      }
      consumed += 2;
      return [new Version(version, line, column), consumed];
    } else if (this.matchNext(offset + consumed, [Token.Real, Token.Semicolon])) {
      const versionSplits = this.tokens[offset + consumed][1].toString().split(".");
      version = new OpenQASMVersion(
        Number(versionSplits[0]),
        Number(versionSplits[1]),
      );
      if (!version.isVersion3()) {
        throwParserError(
          UnsupportedOpenQASMVersionError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected QASM version 3",
        );
      }
      consumed += 2;
      return [new Version(version, line, column), consumed];
    }
    throwParserError(
      UnsupportedOpenQASMVersionError,
      this.tokens[offset + consumed],
      this.index + consumed,
      "expected QASM version 3",
    );
  }

  /**
   * Parses a classical type.
   * @param offset - The current token index.
   * @return The ClassicalType and the number of consumed tokens.
   */
  parseClassicalType(
    offset: number,
  ): [ClassicalType, number] {
    let typeToken = this.tokens[offset][0];
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    let width: Expression | undefined;
    let isComplex = false;

    if (typeToken === Token.Complex) {
      if (
        !this.matchNext(offset + consumed, [Token.LSParen, Token.Float])
      ) {
        throwParserError(
          BadClassicalTypeError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected float type for complex number",
        );
      }
      isComplex = true;
      consumed += 2;
      typeToken = this.tokens[offset + 2][0];
    }

    // Check if there's a width or size specification
    if (this.matchNext(offset + consumed, [Token.LSParen])) {
      consumed++;
      const [widthExpr, widthConsumed] = this.binaryExpression(
        offset + consumed,
      );
      width = widthExpr;
      consumed += widthConsumed;
      if (!this.matchNext(offset + consumed, [Token.RSParen])) {
        throwParserError(
          MissingBraceError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected closing bracket ] for type width",
        );
      }
      if (isComplex) {
        consumed++;
      }
      consumed++;
    }

    const classicalType = this.createClassicalType(typeToken, line, column, width);

    if (isComplex) {
      return [new ComplexType(classicalType as FloatType, line, column), consumed];
    } else {
      return [classicalType, consumed];
    }
  }

  /**
   * Parses a set declaration.
   * @param offset - The current token index.
   * @return The resulting Identifier, IndexSet, or Range node and the number of consumed tokens.
   */
  parseSetDeclaration(
    offset: number,
  ): [Expression | IndexSet | Range, number] {
    if (this.matchNext(offset, [Token.Id])) {
      const [identifier, identifierConsumed] = this.unaryExpression(offset);
      return [identifier as Identifier, identifierConsumed];
    } else if (this.matchNext(offset, [Token.LCParen])) {
      return this.parseIndexSet(offset);
    } else if (this.matchNext(offset, [Token.LSParen])) {
      return this.parseSubscript(offset);
    } else {
      return this.binaryExpression(offset);
    }
  }

  /**
   * Parses an index set.
   * @param offset - The current token index.
   * @return The resulting Identifier, IndexSet, or Range node and the number of consumed tokens.
   */
  parseIndexSet(
    offset: number,
  ): [IndexSet, number] {
    let consumed = 1;
    const line = this.tokens[offset][2];
    const column = this.tokens[offset][3];
    const values: Expression[] = [];

    while (!this.matchNext(offset + consumed, [Token.RCParen])) {
      const [expr, exprConsumed] = this.binaryExpression(
        offset + consumed,
      );
      values.push(expr);
      consumed += exprConsumed;

      if (this.matchNext(offset + consumed, [Token.Comma])) {
        consumed++;
      } else if (!this.matchNext(offset + consumed, [Token.RCParen])) {
        throwParserError(
          BadExpressionError,
          this.tokens[offset + consumed],
          this.index + consumed,
          "expected comma or closing curly brace in index set",
        );
      }
    }
    consumed++;

    return [new IndexSet(values, line, column), consumed];
  }

  /**
   * Creates a classical type.
   * @param token - The token that represents the type.
   * @param width - The type's width or size, if applicable.
   * @return The created ClassicalType.
   */
  createClassicalType(
    token: Token,
    line: number, column: number,
    width?: Expression | number | undefined,
  ): ClassicalType {
    switch (token) {
      case Token.Int:
        return new IntType(width || this.machineIntSize, line, column);
      case Token.UInt:
        return new UIntType(width || this.machineIntSize, line, column);
      case Token.Float:
        return new FloatType(width || this.machineFloatWidth, line, column);
      case Token.Bool:
        return new BoolType(line, column);
      case Token.Bit:
        return new BitType(width, line, column);
      case Token.CReg:
        return new BitType(width, line, column);
      case Token.Stretch:
        return new StretchType(line, column);
      case Token.Duration:
        return new DurationType(line, column);
      case Token.Angle:
        return new AngleType(width, line, column);
      default:
        throwParserError(
          BadClassicalTypeError,
          token,
          this.index,
          "unsupported classical type",
        );
    }
  }

  /**
   * Creates a math or trigonometric function node.
   * @param token - The token representing the function.
   * @param expr - The expression to which the function is applied.
   * @return The created MathFunction or TrigFunction node and the number of consumed tokens.
   */
  createMathOrTrigFunction(
    token: Token,
    expr: Expression,
    line: number,
    column: number,
  ): [MathFunction | TrigFunction, number] {
    switch (token) {
      case Token.Arccos:
        return [new TrigFunction(TrigFunctionTypes.ARCCOS, expr, line, column), 1];
      case Token.Arcsin:
        return [new TrigFunction(TrigFunctionTypes.ARCSIN, expr, line, column), 1];
      case Token.Arctan:
        return [new TrigFunction(TrigFunctionTypes.ARCTAN, expr, line, column), 1];
      case Token.Cos:
        return [new TrigFunction(TrigFunctionTypes.COS, expr, line, column), 1];
      case Token.Sin:
        return [new TrigFunction(TrigFunctionTypes.SIN, expr, line, column), 1];
      case Token.Tan:
        return [new TrigFunction(TrigFunctionTypes.TAN, expr, line, column), 1];
      case Token.Ceiling:
        return [new MathFunction(MathFunctionTypes.CEILING, expr, line, column), 1];
      case Token.Exp:
        return [new MathFunction(MathFunctionTypes.EXP, expr, line, column), 1];
      case Token.Floor:
        return [new MathFunction(MathFunctionTypes.FLOOR, expr, line, column), 1];
      case Token.Log:
        return [new MathFunction(MathFunctionTypes.LOG, expr, line, column), 1];
      case Token.Mod:
        return [new MathFunction(MathFunctionTypes.MOD, expr, line, column), 1];
      case Token.Popcount:
        return [new MathFunction(MathFunctionTypes.POPCOUNT, expr, line, column), 1];
      case Token.Pow:
        return [new MathFunction(MathFunctionTypes.POW, expr, line, column), 1];
      case Token.Rotl:
        return [new MathFunction(MathFunctionTypes.ROTL, expr, line, column), 1];
      case Token.Rotr:
        return [new MathFunction(MathFunctionTypes.ROTR, expr, line, column), 1];
      case Token.Sqrt:
        return [new MathFunction(MathFunctionTypes.SQRT, expr, line, column), 1];
      default:
        throwParserError(
          BadExpressionError,
          token,
          this.index,
          "unsupported math or trig function",
        );
    }
  }

  /** Checks whether a Bit token precedes a measurement statement. */
  private isMeasurement(offset: number): boolean {
    let i = 0;
    while (
      offset + i < this.tokens.length - 1 &&
      this.tokens[offset + i][0] !== Token.LCParen &&
      this.tokens[offset + i][0] !== Token.Semicolon &&
      this.tokens[offset + i][0] !== Token.EqualsAssmt
    ) {
      i++;
    }
    return (
      this.tokens[offset + i]?.[0] === Token.EqualsAssmt && this.tokens[offset + i + 1]?.[0] === Token.Measure
    );
  }

  /** Checks whether the statement is part of an assignment. */
  private isAssignment(offset: number): boolean {
    let i = 0;
    while (
      offset + i < this.tokens.length - 1 &&
      this.tokens[offset + i][0] !== Token.LCParen &&
      this.tokens[offset + i][0] !== Token.Semicolon &&
      this.tokens[offset + i][0] !== Token.EqualsAssmt
    ) {
      i++;
    }
    return this.tokens[offset + i]?.[0] === Token.EqualsAssmt;
  }

  /** Checks whether an identifier is a quantum gate call. */
  private isQuantumGateCall(
    offset: number,
  ): boolean {
    const gateName = this.tokens[offset][1] as string;
    return (
      this.gates.has(gateName) ||
      this.standardGates.has(gateName) ||
      this.customGates.has(gateName)
    );
  }

  /** Checks whether an identifier is a subroutine call. */
  private isSubroutineCall(
    offset: number,
  ): boolean {
    const subroutineName = this.tokens[offset][1] as string;
    return this.subroutines.has(subroutineName);
  }

  /** Checks whether a number is imaginary. */
  private isImaginary(offset: number): boolean {
    const token = this.tokens[offset];
    if (!token || token[1] === undefined || token[1] === null) {
      return false;
    }
    return token[1].toString() === "im";
  }

  /** Checks whether an identifier is an array. */
  private isArray(offset: number): boolean {
    if (this.tokens[offset][0] !== Token.Id) {
      return false;
    }
    const identifierName = this.tokens[offset][1].toString();
    return this.customArrays.has(identifierName);
  }

  /** Checks whether an identifier represents a duration literal unit. */
  private isDuration(offset: number): boolean {
    const checkToken = this.tokens[offset];
    if (!checkToken || checkToken[1] === undefined || checkToken[1] === null || checkToken[0] !== Token.Id) {
      return false;
    }
    if (
      Object.values(DurationUnit).includes(
        checkToken[1].toString() as DurationUnit,
      )
    ) {
      return true;
    }
    return false;
  }

  /** TODO : update this
   * Validates whether a register or gate identifier.
   * @param identifier - The identifier to validate.
   * @return Boolean indicating successful validation or not.
   */
  private validateIdentifier(identifier: string): boolean {
    const firstChar = identifier[0];
    return /^[a-z]$/.test(firstChar);
  }
}

/**
 * Checks if a token represents a type.
 */
function isTypeToken(token: Token): boolean {
  return (
    token === Token.Float ||
    token === Token.Int ||
    token === Token.UInt ||
    token === Token.Bool ||
    token === Token.Duration ||
    token === Token.Angle ||
    token === Token.Stretch ||
    token === Token.Bit
  );
}

export default Parser;
