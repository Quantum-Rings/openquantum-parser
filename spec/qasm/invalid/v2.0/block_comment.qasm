// name: block comment (/* */) not supported in OpenQASM 2.0
OPENQASM 2.0;
include "qelib1.inc";
qreg q[1];
h q[0]; /* this should be rejected in 2.0 */
measure q -> c;
