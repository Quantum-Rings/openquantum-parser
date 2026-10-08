/**
 * Modified by Quantum Rings, 2026.
 * Derived from qasm-ts (https://github.com/comp-phys-marc/qasm-ts), Apache-2.0.
 */

/**
 * Error classes for QASM parsing and validation
 *
 * This module provides specific error types for different parsing failures,
 * enabling precise error handling and debugging. Each error includes contextual
 * information about where the error occurred in the source code.
 *
 * @module Error Handling
 */

/** Base class for QASM errors with location tracking. */
class QasmError extends Error {
  constructor(
    message?: string,
    public line?: number,
    public column?: number,
    public sourceLine?: string,
  ) {
    super(QasmError.formatMessage(message || "Error", line, column, sourceLine));
    this.name = "QasmError";
  }

  static formatMessage(
    msg: string,
    line?: number,
    col?: number,
    source?: string,
  ): string {
    if (line && col && source) {
      const pointer = " ".repeat(Math.max(0, col - 1)) + "^";
      return `${msg} at line ${line}, column ${col}:\n   ${source}\n   ${pointer}`;
    }
    if (line && source) {
      return `${msg} at line ${line}:\n   ${source}`;
    }
    return msg;
  }
}

/** Class representing a bad argument exception. */
class BadArgumentError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadArgumentError.name;
  }
}

/** Class representing a bad include statement */
class BadIncludeError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadIncludeError.name;
  }
}

/** Class representing a bad quantum register exception. */
class BadQregError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadQregError.name;
  }
}

/** Class representing a bad equality exception. */
class BadEqualsError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadEqualsError.name;
  }
}

/** Class representing a bad classical register exception. */
class BadCregError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadCregError.name;
  }
}

/** Class representing a bad conditional exception. */
class BadConditionalError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadConditionalError.name;
  }
}

/** Class representing a bad barrier exception. */
class BadBarrierError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadBarrierError.name;
  }
}

/** Class representing a bad measurement exception. */
class BadMeasurementError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadMeasurementError.name;
  }
}

/** Class representing a bad gate exception. */
class BadGateError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadGateError.name;
  }
}

/** Class representing a bad parameter exception. */
class BadParameterError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadParameterError.name;
  }
}

/** Class representing a missing semicolon exception. */
class MissingSemicolonError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = MissingSemicolonError.name;
  }
}

/** Class representing a missing opening or closing parenthesis, bracket, or curly brakcet. */
class MissingBraceError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = MissingBraceError.name;
  }
}

/** Class representing an unsupported OpenQASM version exception. */
class UnsupportedOpenQASMVersionError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = UnsupportedOpenQASMVersionError.name;
  }
}

/** Class representing an error parsing an expected string literal. */
class BadStringLiteralError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadStringLiteralError.name;
  }
}

/** Class representing an error parsing scalar types. */
class BadClassicalTypeError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadClassicalTypeError.name;
  }
}

/** Class representing an error parsing an expression. */
class BadExpressionError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadExpressionError.name;
  }
}

/** Class representing an error in defining or calling a custom subroutine. */
class BadSubroutineError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadSubroutineError.name;
  }
}

/** Class representing a bad loop statement declaration. */
class BadLoopError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadLoopError.name;
  }
}

/** Class representing a bad quantum instruction. */
class BadQuantumInstructionError extends QasmError {
  constructor(
    message?: string,
    line?: number,
    column?: number,
    sourceLine?: string,
  ) {
    super(message, line, column, sourceLine);
    this.name = BadQuantumInstructionError.name;
  }
}

/** Type for returning an error constructor. */
type ReturnErrorConstructor = new (
  message?: string,
  line?: number,
  column?: number,
  sourceLine?: string,
) => Error;

export {
  QasmError,
  BadArgumentError,
  BadIncludeError,
  BadCregError,
  BadQregError,
  BadConditionalError,
  BadBarrierError,
  BadMeasurementError,
  BadGateError,
  BadEqualsError,
  BadParameterError,
  MissingSemicolonError,
  MissingBraceError,
  UnsupportedOpenQASMVersionError,
  BadStringLiteralError,
  BadClassicalTypeError,
  BadExpressionError,
  BadSubroutineError,
  BadLoopError,
  BadQuantumInstructionError,
  ReturnErrorConstructor,
};
