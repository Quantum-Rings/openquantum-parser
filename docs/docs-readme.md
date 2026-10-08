# openquantum-parser

OpenQASM 2.0 and 3.x parser in TypeScript, maintained by Quantum Rings.

This package lexes and parses OpenQASM into an abstract syntax tree. Version 1.0.0 is a fork of [qasm-ts](https://github.com/comp-phys-marc/qasm-ts) at commit `a96b8e2` (23 September 2025). Copyright 2019 Marcus Edwards. Quantum Rings' changes are Copyright 2026 Open Quantum / Quantum Rings. See `NOTICE` in the repository.

Language documentation is at [openqasm.com](https://openqasm.com).

## Quick Start

### Installation

```bash
npm install @quantum-rings/openquantum-parser
```

### Basic Usage

Parse from an OpenQASM string snippet:

```typescript
import { parseString } from "@quantum-rings/openquantum-parser";

const qasmCode = `
OPENQASM 3.0;
include "stdgates.inc";
qubit[2] q;
h q[0];
cx q[0], q[1];
`;

const result = parseString(qasmCode);
console.log(result.version); // 3
console.log(result.ast);
```

Parse from an OpenQASM file:

```typescript
import { parseFile } from "@quantum-rings/openquantum-parser";

const result = parseFile("./my-circuit.qasm");

// Specify OpenQASM version explicitly
const legacy = parseFile("./legacy-circuit.qasm", 2); // OpenQASM 2.0
const modern = parseFile("./modern-circuit.qasm", 3); // OpenQASM 3.0
```

`parseString` and `parseFile` return `{ ast, version }`. `ast` is an array of nodes, or a string when `stringify` is true. When `version` is omitted, the parser reads the `OPENQASM` header and defaults to 3.

### Working with the AST

```typescript
// Get verbose output with class names
const verbose = parseString(qasmCode, 3, true);

// Get stringified JSON output
const json = parseString(qasmCode, 3, false, true);

// Both verbose and stringified
const verboseJson = parseString(qasmCode, 3, true, true);
```

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

## API Documentation Navigation

### Core Functions

Start here for the main parsing functions:

- **[parseString](functions/main.parseString.html)** - Parse OpenQASM code from a string
- **[parseFile](functions/main.parseFile.html)** - Parse OpenQASM code from a file

### Tokenization

Understand the tokenization process and available token types:

- **[OpenQASM 3.0 Tokens](modules/qasm3_token.html)** - Modern OpenQASM token set
- **[OpenQASM 2.0 Tokens](modules/qasm2_token.html)** - Legacy OpenQASM token set

### Lexing

Understand the Lexer:

- **[OpenQASM 3.0 Lexer](modules/qasm3_lexer.html)** - Modern OpenQASM lexer
- **[OpenQASM 2.0 Lexer](modules/qasm2_lexer.html)** - Legacy OpenQASM lexer

### AST Structure

Understand the abstract syntax tree nodes:

- **[OpenQASM 3.0 AST Nodes](modules/qasm3_ast.html)** - Modern OpenQASM syntax tree
- **[OpenQASM 2.0 AST Nodes](modules/qasm2_ast.html)** - Legacy OpenQASM syntax tree

### Parsing

Understand the Parser:

- **[OpenQASM 3.0 Parser](modules/qasm3_parser.html)** - Modern OpenQASM parser
- **[OpenQASM 2.0 Parser](modules/qasm2_parser.html)** - Legacy OpenQASM parser

### Utilities and Internals

- **[Error Handling](modules/errors.html)** - All error types and their usage
- **[Version Management](modules/Version_Management.html)** - Version detection and handling

Navigate using the sidebar or search functionality to find specific functions and classes.

## Version 1.0.0

OpenQASM 2.0 and 3.x parsing comes from qasm-ts. Since the fork, this package returns `{ ast, version }`, accepts OpenQASM 3.1 on the version 3 parser, and parses hardware qubits, `pragma`, annotations, and calibration grammar. AST nodes carry line and column.

## Source Code

Source and issues: [Quantum-Rings/openquantum-parser](https://github.com/Quantum-Rings/openquantum-parser). The original project is [comp-phys-marc/qasm-ts](https://github.com/comp-phys-marc/qasm-ts).

## References

The original OpenQASM authors:

- Andrew W. Cross, Lev S. Bishop, John A. Smolin, Jay M. Gambetta "Open Quantum Assembly Language" [arXiv:1707.03429](https://web.archive.org/web/20210121114036/https://arxiv.org/abs/1707.03429)
- Andrew W. Cross, Ali Javadi-Abhari, Thomas Alexander, Niel de Beaudrap, Lev S. Bishop, Steven Heidel, Colm A. Ryan, Prasahnt Sivarajah, John Smolin, Jay M. Gambetta, Blake R. Johnson "OpenQASM 3: A broader and deeper quantum assembly language" [arXiv:2104.14722](https://arxiv.org/abs/2104.14722)

Another strongly typed implementation from which this project took some inspiration:

- [Adam Kelly's Rust QASM Parser](https://github.com/libtangle/qasm-rust)

## License

Copyright 2026 Open Quantum / Quantum Rings

Copyright 2019 Marcus Edwards

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at:

```http://www.apache.org/licenses/LICENSE-2.0```

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

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
