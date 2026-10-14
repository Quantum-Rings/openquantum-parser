# openquantum-parser

OpenQASM 2.0 and 3.x parser in TypeScript, maintained by Quantum Rings.

openquantum-parser is a compiler frontend. It lexes and parses OpenQASM into an abstract syntax tree that captures program structure, including control flow and data flow. Version 1.0.0 is for people building checkers, compilers, and hardware submission tools.

Language documentation is at [openqasm.com](https://openqasm.com).

## Provenance

This project is a fork of [qasm-ts](https://github.com/comp-phys-marc/qasm-ts) at commit [`a96b8e2`](https://github.com/comp-phys-marc/qasm-ts/commit/a96b8e2d5c215852ae111c627646e39391a4ccb3) (23 September 2025, package version 2.1.2).

Copyright 2019 Marcus Edwards. Sean Kim wrote most of the OpenQASM 3 parser in that project. Quantum Rings' changes are on top of that tree and are Copyright 2026 Open Quantum / Quantum Rings. Both bodies of work are Apache-2.0. See `NOTICE`.

Changes since that commit:

- The OpenQASM 2 and 3 parsers keep one token array and pass an integer offset. They no longer copy the remaining token list with `slice` on every production.
- Parse errors carry a source line, a column, and a readable message.
- `parseFile` and `parseString` return `{ ast, version }`. When `version` is omitted, it is read from the `OPENQASM` header.
- An `OPENQASM 3.1` header selects the version 3 parser. Anonymous statement blocks (`{ ... }`), which that version added, are parsed.
- Hardware qubits, `pragma` (including a bare `pragma`), annotations, and calibration grammar (`defcal`).
- AST nodes record line and column.
- The test corpus was expanded against the OpenQASM 3.0 examples, and OpenQASM 2 parsing bugs were fixed.

## Usage

```ts
import { parseFile, parseString } from '@quantum-rings/openquantum-parser';
```

`parseFile` takes a path to a `.qasm` file. `parseString` takes OpenQASM source. Both return a `ParseResult`:

- `ast`: an array of AST nodes, or a string when `stringify` is true
- `version`: the major version, `2` or `3`

Optional arguments:

1. `version`: A `number`, `OpenQASMVersion`, or `OpenQASMMajorVersion`. Chooses the QASM 2 or 3 lexer and parser. When omitted, the `OPENQASM` header is used. The default is version 3.
2. `verbose`: When `true`, each node includes its class name. Default `false`.
3. `stringify`: When `true`, `ast` is formatted JSON. Default `false`.

```ts
const result = parseString('OPENQASM 3.0;\nqubit[1] q;');
console.log(result.version); // 3
console.log(result.ast);

const fromFile = parseFile('<file-path>');
```

Syntax errors are the classes exported from `errors.ts`. This is a parse, not a semantic analysis.

API docs are generated into `docs/` with `npm run docs`.

## Example I/O

### Input: `alignment.qasm` ([source](https://github.com/openqasm/openqasm/blob/main/examples/alignment.qasm))

```
include "stdgates.inc";

stretch g;

qubit[3] q;
barrier q;
cx q[0], q[1];
delay[g] q[2];
U(pi/4, 0, pi/2) q[2];
delay[2*g] q[2];
barrier q;

```

### Output: `result.ast`

```
[
  Include { filename: '"stdgates.inc"' },
  ClassicalDeclaration {
    classicalType: StretchType {},
    identifier: Identifier { name: 'g' },
    initializer: null,
    isConst: false
  },
  QuantumDeclaration {
    identifier: Identifier { name: 'q' },
    size: IntegerLiteral { value: 3 }
  },
  QuantumBarrier { qubits: [ [Identifier] ] },
  QuantumGateCall {
    quantumGateName: Identifier { name: 'cx' },
    qubits: [ [SubscriptedIdentifier], [SubscriptedIdentifier] ],
    parameters: null,
    modifiers: []
  },
  QuantumDelay {
    duration: Identifier { name: 'g' },
    qubits: [ [SubscriptedIdentifier] ]
  },
  QuantumGateCall {
    quantumGateName: Identifier { name: 'U' },
    qubits: [ [SubscriptedIdentifier] ],
    parameters: Parameters { args: [Array] },
    modifiers: []
  },
  QuantumDelay {
    duration: Arithmetic { op: '*', left: [IntegerLiteral], right: [Identifier] },
    qubits: [ [SubscriptedIdentifier] ]
  },
  QuantumBarrier { qubits: [ [Identifier] ] }
]
```

To reproduce this output, run the following script in the directory where `alignment.qasm` is located.

```
import { parseFile } from '@quantum-rings/openquantum-parser';

const result = parseFile("./alignment.qasm", 3);

console.log(result.version);
console.log(result.ast);
```

`ts-node script.ts` runs that file. See the [ts-node docs](https://www.npmjs.com/package/ts-node).

## Develop

```
npm install
npm test
npm run build
```

`npm run build` writes `dist/` with `tsc`. The programs under `spec/qasm/generic` are the upstream qasm-ts conformance corpus. Several of them, including `alignment.qasm`, come from the [OpenQASM project](https://github.com/openqasm/openqasm) (Apache-2.0).

## Performance

Parse time for the 11 OpenQASM 3 programs from the [qasm-ts benchmark](https://github.com/seankim658/qasm-parser-testing). Milliseconds, in process, on an Apple M4, October 2026.

| File | Bytes | ANTLR | openqasm3_parser | qasm-ts 2.1.2 | openquantum-parser |
| --- | ---: | ---: | ---: | ---: | ---: |
| alignment.qasm | 314 | 0.759 | 0.011 | 0.017 | 0.022 |
| qft.qasm | 320 | 1.534 | 0.023 | 0.028 | 0.022 |
| inverseqft2.qasm | 431 | 1.999 | 0.026 | 0.039 | 0.035 |
| qec.qasm | 447 | 1.832 | 0.024 | 0.036 | 0.029 |
| dd.qasm | 554 | 1.449 | 0.017 | 0.038 | 0.040 |
| inverseqft1.qasm | 674 | 3.632 | 0.045 | 0.084 | 0.064 |
| varteleport.qasm | 707 | 2.354 | 0.028 | 0.045 | 0.038 |
| adder.qasm | 803 | 2.845 | 0.038 | 0.083 | 0.072 |
| ipe.qasm | 941 | 1.619 | 0.018 | 0.034 | 0.038 |
| scqec.qasm | 2822 | 7.092 | 0.072 | 0.189 | 0.119 |
| msd.qasm | 4660 | 13.363 | 0.126 | 0.705 | 0.208 |
| All 11, one pass |  | 38.5 | 0.43 | 1.30 | 0.69 |

*__Note:__ [Qiskit/openqasm3_parser](https://github.com/Qiskit/openqasm3_parser) (`e168656` 0.7.0) does not support all documented syntax such as measure `->` therefore tests had to be modified to pass.*

## Features

| | ANTLR | openqasm3_parser | qasm-ts 2.1.2 | openquantum-parser |
| --- | --- | --- | --- | --- |
| JavaScript | no | no | yes | yes |
| OpenQASM 2.0 | partial | no | partial | yes |
| OpenQASM 3 | yes | partial | yes | yes |
| Line and column on each node | yes | yes | no | yes |
| Error gives line and column | no | yes | line only | yes |
| Hardware qubits (`$0`) | yes | yes | delay only | yes |
| Anonymous `{ ... }` block | yes | yes | no | yes |
| `pragma` | yes | `#pragma` only | no | yes |
| Annotations | yes | yes | no | yes |
| `defcal` | yes | name only | no | yes |
| Version read from the header | yes | no | no | yes |
| Semantic analysis | no | yes | no | no |

*__Note:__ ANTLR and qasm-ts 2.1.2 parse some OpenQASM 2, including `qreg` and `if`, and both reject `opaque`. qasm-ts needs the version passed in.*

## References

OpenQASM:

- Andrew W. Cross, Lev S. Bishop, John A. Smolin, Jay M. Gambetta "Open Quantum Assembly Language" [arXiv:1707.03429](https://web.archive.org/web/20210121114036/https://arxiv.org/abs/1707.03429).
- Andrew W. Cross, Ali Javadi-Abhari, Thomas Alexander, Niel de Beaudrap, Lev S. Bishop, Steven Heidel, Colm A. Ryan, Prasahnt Sivarajah, John Smolin, Jay M. Gambetta, Blake R. Johnson "OpenQASM 3: A broader and deeper quantum assembly language" [arXiv:2104.14722](https://arxiv.org/abs/2104.14722)

qasm-ts took some inspiration from [Adam Kelly's Rust QASM parser](https://github.com/libtangle/qasm-rust).

## Prior work

Kim and Edwards described the original qasm-ts package in the Journal of Open Source Software. That article does not review this fork.

```
@article{Kim_2025,
  doi = {10.21105/joss.08696},
  url = {https://doi.org/10.21105/joss.08696},
  year = {2025},
  publisher = {The Open Journal},
  volume = {10},
  number = {113},
  pages = {8696},
  author = {Kim, Sean and Edwards, Marcus},
  title = {Enabling the Verification and Formalization of Hybrid Quantum-Classical Computing with OpenQASM 3.0 compatible QASM-TS 2.0},
  journal = {Journal of Open Source Software}
}
```

The source of that paper is in `paper/`, unchanged, with a note in `paper/README.md`.

## License

Copyright 2026 Open Quantum / Quantum Rings
Copyright 2019 Marcus Edwards

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at:

```
http://www.apache.org/licenses/LICENSE-2.0
```

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
