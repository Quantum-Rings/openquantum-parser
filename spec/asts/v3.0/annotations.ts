import {
  Version,
  Identifier,
  QuantumGateCall,
  HardwareQubit,
  QuantumDeclaration,
  IntegerLiteral,
  SubscriptedIdentifier,
  Annotation,
} from "../../../src/qasm3/ast";
import { OpenQASMVersion, OpenQASMMajorVersion } from "../../../src/version";

export const annotationsAst = [
  new Version(new OpenQASMVersion(OpenQASMMajorVersion.Version3, 0)),
  Object.assign(
    new QuantumGateCall(
      new Identifier("x"),
      [new HardwareQubit(0)],
      null,
      []
    ),
    { annotations: [new Annotation("parallel", "")] }
  ),
  Object.assign(
    new QuantumDeclaration(
      new Identifier("q"),
      null
    ),
    { annotations: [new Annotation("bind", ""), new Annotation("mutable", "")] }
  ),
  Object.assign(
    new QuantumGateCall(
      new Identifier("cx"),
      [
        new Identifier("q"),
        new Identifier("q")
      ],
      null,
      []
    ),
    { annotations: [new Annotation("layout", "exact")] }
  )
];