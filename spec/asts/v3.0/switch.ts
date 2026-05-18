import {
  Version,
  Identifier,
  QuantumDeclaration,
  ClassicalDeclaration,
  BitType,
  SwitchStatement,
  CaseStatement,
  DefaultStatement,
  ProgramBlock,
  IntegerLiteral,
  QuantumGateCall
} from "../../../src/qasm3/ast";
import { OpenQASMVersion, OpenQASMMajorVersion } from "../../../src/version";

export const switchAst = [
  new Version(new OpenQASMVersion(OpenQASMMajorVersion.Version3, 0)),
  new QuantumDeclaration(new Identifier("q"), null),
  new ClassicalDeclaration(new BitType(null), new Identifier("c"), null, false),
  new SwitchStatement(
    new Identifier("c"),
    [
      new CaseStatement(
        [new IntegerLiteral(0)],
        new ProgramBlock([
          new QuantumGateCall(new Identifier("x"), [new Identifier("q")], null, [])
        ])
      ),
      new CaseStatement(
        [new IntegerLiteral(1)],
        new ProgramBlock([
          new QuantumGateCall(new Identifier("y"), [new Identifier("q")], null, [])
        ])
      )
    ],
    new DefaultStatement(
      new ProgramBlock([
        new QuantumGateCall(new Identifier("z"), [new Identifier("q")], null, [])
      ])
    )
  )
];