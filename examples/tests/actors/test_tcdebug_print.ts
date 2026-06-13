import '../../../include/TCSet100/TCDebug';

// ── TCDebug.PrintReport integration test ─────────────────────────────────────
//
// Tests that:
//   1. TCPRINT starts at 0 (default).
//   2. When TCPRINT is set to 1 (via --set-gamevar or the test runner's setup.gameVars),
//      TCDebug._TCDebugHUD.Append() (EVENT_DISPLAYEND) calls PrintReport() and resets
//      TCPRINT to 0.
//   3. The compiled CON contains the two gamevars (TCDEBUG_MODE + TCPRINT).
//
// Run with the JSON test suite:
//   tcc test examples/tests/actors/test_tcdebug_print.test.json
//
// Or run manually via the simulator:
//   tcc -c -il examples/tests/actors/test_tcdebug_print.ts
//   tcc -L -di -o test_tcdebug_print.con
//   tcc -S -nv --set-gamevar TCPRINT=1 --event EVENT_DISPLAYEND \
//       -i compiled/test_tcdebug_print.con
//   # tc_report.json should now exist in the working directory.
//
// Note: full file I/O (writing tc_report.json) requires EDuke32 or the TypeCON VM.
// In the VM, writearraytofile is executed against the real filesystem.

// No extra code needed — importing TCDebug self-hooks EVENT_DISPLAYEND.
