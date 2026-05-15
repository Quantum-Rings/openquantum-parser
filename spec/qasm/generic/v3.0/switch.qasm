OPENQASM 3.0;

qubit q;
bit c;

switch (c) {
  case 0: x q;
  case 1: y q;
  default: z q;
}