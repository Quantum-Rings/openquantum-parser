OPENQASM 3.0;

@parallel
x $0;

@bind
@mutable
qubit q;

@layout exact
cx q, q;