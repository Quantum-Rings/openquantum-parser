/* eslint-disable  @typescript-eslint/no-explicit-any */

/**
 * Main parsing functions for qasm-ts - the primary entry points for parsing OpenQASM code
 * @module Main Functions
 */

import * as fs from "fs";
import { OpenQASMVersion, OpenQASMMajorVersion } from "./version";
import { lex } from "./lexer";
import { parse } from "./parser";
import { PragmaStatement } from "./qasm3/ast";
export { PragmaStatement };

/**
 * Result of parsing OpenQASM code, including the AST and detected version.
 */
export interface ParseResult {
  /** The abstract syntax tree as an array of nodes */
  ast: any;
  /** The detected or specified OpenQASM major version (2 or 3) */
  version: number;
}

/**
 * Parses OpenQASM code from a string and returns the abstract syntax tree.
 *
 * This is the primary entry point for parsing OpenQASM code. It handles both
 * OpenQASM 2.0 and 3.0 syntax, automatically selecting the appropriate lexer
 * and parser based on the version parameter.
 *
 * @group Main Functions
 * @param qasm - The OpenQASM code string to parse
 * @param version - The OpenQASM version to use (defaults to 3.0)
 * @param verbose - Whether to include class names in the output (defaults to false)
 * @param stringify - Whether to return stringified JSON (defaults to false)
 * @returns The parse result containing the AST and detected version
 *
 * @example Basic OpenQASM 3.0 parsing
 * ```typescript
 * import { parseString } from 'qasm-ts';
 *
 * const qasmCode = `
 * OPENQASM 3.0;
 * include "stdgates.inc";
 * qubit[2] q;
 * h q[0];
 * cx q[0], q[1];
 * `;
 *
 * const result = parseString(qasmCode);
 * console.log(result.version); // 3
 * console.log(result.ast);
 * ```
 *
 * @example OpenQASM 2.0 parsing
 * ```typescript
 * const qasm2Code = `
 * OPENQASM 2.0;
 * include "qelib1.inc";
 * qreg q[2];
 * creg c[2];
 * h q[0];
 * cx q[0],q[1];
 * measure q -> c;
 * `;
 *
 * const result = parseString(qasm2Code, 2);
 * console.log(result.version); // 2
 * ```
 *
 * @example Verbose output with class names
 * ```typescript
 * const result = parseString(qasmCode, 3, true);
 * // Output will include __className__ properties for each node
 * console.log(result.ast);
 * ```
 */
export function parseString(
  qasm: string,
  version?: number | OpenQASMVersion | OpenQASMMajorVersion,
  verbose?: boolean,
  stringify?: boolean,
): ParseResult {
  let ast: any;
  let normalizedVersion: number;
  if (version === undefined) {
    const versionMatch = qasm.match(/^\s*OPENQASM\s+(\d+)/m);
    if (versionMatch) {
      normalizedVersion = parseInt(versionMatch[1], 10);
    } else {
      normalizedVersion = 3;
    }
  } else if (typeof version === "number") {
    normalizedVersion = version;
  } else if (version instanceof OpenQASMVersion) {
    normalizedVersion = version.major;
  } else {
    normalizedVersion = version === OpenQASMMajorVersion.Version2 ? 2 : 3;
  }
  const tokens = lex(qasm, undefined, normalizedVersion);
  ast = parse(tokens, normalizedVersion);
  if (verbose === true) {
    if (stringify === true) {
      ast = JSON.stringify(getDetailedOutput(ast), null, 2);
    }
    ast = getDetailedOutput(ast);
  } else {
    if (stringify === true) {
      ast = JSON.stringify(ast, null, 2);
    }
  }
  return { ast, version: normalizedVersion };
}

/**
 * Parses OpenQASM code from a file and returns the parse result.
 *
 * @group Main Functions
 * @param file - The path to the .qasm file to parse
 * @param version - The OpenQASM version to use (defaults to 3.0)
 * @param verbose - Whether to include class names in the output (defaults to false)
 * @param stringify - Whether to return stringified JSON (defaults to false)
 * @returns The parse result containing the AST and detected version
 *
 * @example Parse a QASM file
 * ```typescript
 * import { parseFile } from 'qasm-ts';
 *
 * // Parse OpenQASM 3.0 file
 * const result = parseFile('./my-circuit.qasm');
 * console.log(result.version); // 3
 * console.log(result.ast);
 *
 * // Parse OpenQASM 2.0 file
 * const result2 = parseFile('./legacy-circuit.qasm', 2);
 * console.log(result2.version); // 2
 * ```
 *
 * @example Parse with verbose output
 * ```typescript
 * const result = parseFile('./circuit.qasm', 3, true);
 * // Includes detailed class information for each AST node
 * ```
 */
export function parseFile(
  file: string,
  version?: number | OpenQASMVersion | OpenQASMMajorVersion,
  verbose?: boolean,
  stringify?: boolean,
): ParseResult {
  return parseString(
    fs.readFileSync(file, "utf8"),
    version,
    verbose,
    stringify,
  );
}

/**
 * Adds class names to AST nodes for detailed inspection.
 * @internal
 */
function getDetailedOutput(object) {
  if (Array.isArray(object)) {
    return object.map(getDetailedOutput);
  } else if (object !== null && typeof object === "object") {
    const result = {};
    result["__className__"] = object.constructor.name;
    for (const [key, value] of Object.entries(object)) {
      result[key] = getDetailedOutput(value);
    }
    return result;
  } else {
    return object;
  }
}

/**
 * Recursively converts an AST node back to QASM source code.
 * @param node - The AST node to convert.
 * @param version - The OpenQASM version.
 * @returns The QASM source string.
 */
function toQasm(node: any, version: number): string {
  if (Array.isArray(node)) return node.map(n => toQasm(n, version)).join('\n');
  if (!node || typeof node !== 'object') return String(node);

  switch (node.constructor.name) {
    case 'PragmaStatement':
      return `#pragma ${node.name}${node.command ? ' ' + node.command : ''};`;
    case 'Version':
      return `OPENQASM ${node.version.major}.${node.version.minor};`;
    case 'Include':
      return `include ${node.filename};`;
    // Add more cases as needed for full unparse
    default:
      // Fallback: recurse on properties, skipping metadata
      return Object.entries(node).filter(([k]) => k !== 'line' && k !== 'column').map(([k,v]) => toQasm(v, version)).join(' ');
  }
}

/**
 * Unparses an AST back to QASM source code.
 *
 * @group Main Functions
 * @param ast - The AST array to unparse.
 * @param version - The OpenQASM version (defaults to 3.0).
 * @returns The QASM source string.
 *
 * @example Unparsing an AST
 * ```typescript
 * import { parseString, unparse } from 'qasm-ts';
 *
 * const qasm = 'OPENQASM 3.0;\n#pragma braket verbatim;';
 * const result = parseString(qasm);
 * const unparsed = unparse(result.ast, 3);
 * console.log(unparsed); // 'OPENQASM 3.0;\n#pragma braket verbatim;'
 * ```
 */
export function unparse(ast: any[], version?: number): string {
  return toQasm(ast, version || 3);
}

/**
 * Type guard to safely identify a PragmaStatement in the AST.
 * @param node - The AST node to check.
 * @returns True if the node is a PragmaStatement.
 */
export function isPragmaStatement(node: any): node is PragmaStatement {
  return node !== null && typeof node === 'object' && 
    (node.type === 'PragmaStatement' || node.__className__ === 'PragmaStatement' || node.constructor?.name === 'PragmaStatement');
}
