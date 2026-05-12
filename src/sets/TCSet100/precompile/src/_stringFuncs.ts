import '../../types';

// _stringToFP16: r0 = heap string pointer → rb = FP16 value
// Parses format: [-]IIIII[.DDDD]
function _stringToFP16(s: string): FP16 {
    let i: number = 0;
    let len: number = strLen(s);
    let neg: number = 0;

    if (charCodeAt(s, 0) == 45) {
        neg = 1;
        i = 1;
    }

    let intPart: number = 0;
    let c: number = 0;
    while (i < len) {
        c = charCodeAt(s, i);
        if (c == 46) {
            i = i + 1;
            break;
        }
        intPart = intPart * 10 + c - 48;
        i = i + 1;
    }

    let fracInt: number = 0;
    let fracCount: number = 0;
    while (i < len && fracCount < 4) {
        c = charCodeAt(s, i);
        fracInt = fracInt * 10 + c - 48;
        fracCount = fracCount + 1;
        i = i + 1;
    }

    while (fracCount < 4) {
        fracInt = fracInt * 10;
        fracCount = fracCount + 1;
    }

    let fp: FP16 = intToFP16(intPart) + fracInt * 65536 / 10000;
    if (neg == 1) {
        fp = 0 - fp;
    }
    return fp;
}

// _checkEq: r0=label(string), r1=expected(int), r2=actual(int)
function _checkEq(label: string, expected: number, actual: number): void {
    let msg: string = label + ": exp=" + expected + " got=" + actual;
    if (actual == expected) {
        msg = msg + " [PASS]";
    } else {
        msg = msg + " [FAIL]";
    }
    console.debug(msg);
}

// _checkFpEq: r0=label(string), r1=expected(FP16), r2=actual(FP16)
function _checkFpEq(label: string, expected: FP16, actual: FP16): void {
    let msg: string = label + ": exp=" + fp16ToString(expected) + " got=" + fp16ToString(actual);
    if (actual == expected) {
        msg = msg + " [PASS]";
    } else {
        msg = msg + " [FAIL]";
    }
    console.debug(msg);
}
