import {
  Include,
  QuantumDeclaration,
  Identifier,
  IntegerLiteral,
  Version,
} from "../../../src/qasm3/ast";
import { OpenQASMVersion } from "../../../src/version";

export const flexibleDeclarationsAst = [
  new Version(new OpenQASMVersion(3, 0)),
  new Include("\"stdgates.inc\""),
  new QuantumDeclaration(new Identifier("q1"), new IntegerLiteral(2)),
  new QuantumDeclaration(new Identifier("q2"), new IntegerLiteral(2)),
  new QuantumDeclaration(new Identifier("r1"), new IntegerLiteral(2)),
  new QuantumDeclaration(new Identifier("r2"), new IntegerLiteral(2)),
];
