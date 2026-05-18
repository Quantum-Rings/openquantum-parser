OPENQASM 3.0;

defcalgrammar "openpulse";

cal {
  extern port d0;
  extern frame q0_frame;
}

defcal x $0 {
  play(d0, wave);
}

defcal measure $0, $1 -> bit {
  play(d0, measure_wave);
  return "01";
}