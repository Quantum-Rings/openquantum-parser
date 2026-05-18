import {
  Version,
  CalibrationGrammarDeclaration,
  CalibrationBlock,
  CalibrationDefinition,
  Identifier,
  HardwareQubit,
  BitType,
} from "../../../src/qasm3/ast";
import { OpenQASMVersion, OpenQASMMajorVersion } from "../../../src/version";

export const calibrationAst = [
  new Version(new OpenQASMVersion(OpenQASMMajorVersion.Version3, 0)),
  new CalibrationGrammarDeclaration('"openpulse"'),
  new CalibrationBlock("extern port d0 ; extern frame q0_frame ;"),
  new CalibrationDefinition(
    new Identifier("x"),
    [new HardwareQubit(0)],
    "play ( d0 , wave ) ;",
    null,
    null
  ),
  new CalibrationDefinition(
    new Identifier("measure"),
    [new HardwareQubit(0), new HardwareQubit(1)],
    'play ( d0 , measure_wave ) ; return "01" ;',
    null,
    new BitType(null)
  ),
];