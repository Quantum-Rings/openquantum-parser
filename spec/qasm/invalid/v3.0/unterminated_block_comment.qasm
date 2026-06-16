/*
 * name: unterminated block comment in OpenQASM 3.0
 */
OPENQASM 3.0;
include "stdgates.inc";

qubit[1] q;

/* this comment is never closed
h q[0];
x q[0];
