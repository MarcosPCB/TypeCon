import '../../types';

// _checkEq: r0=label(string), r1=expected(int), r2=actual(int)
// Prints "label: exp=X got=Y [PASS/FAIL]" to the OSD.
function _checkEq(label: string, expected: number, actual: number): void {
    let msg: string = label + ": exp=" + expected + " got=" + actual;
    if (actual == expected) {
        msg = msg + " [PASS]";
    } else {
        msg = msg + " [FAIL]";
    }
    PrintString(msg);
}

// _checkFpEq: r0=label(string), r1=expected(FP16), r2=actual(FP16)
// Prints "label: exp=X.XXXX got=Y.YYYY [PASS/FAIL]" to the OSD.
function _checkFpEq(label: string, expected: FP16, actual: FP16): void {
    let msg: string = label + ": exp=" + fp16ToString(expected) + " got=" + fp16ToString(actual);
    if (actual == expected) {
        msg = msg + " [PASS]";
    } else {
        msg = msg + " [FAIL]";
    }
    PrintString(msg);
}
