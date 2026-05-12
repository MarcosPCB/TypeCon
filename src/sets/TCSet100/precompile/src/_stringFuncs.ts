import '../../types';

// _convertFP2String: r0 = FP16 value → rb = heap string pointer
// Format: [-]IIIII.DDDD  (sign optional, always 4 decimal places)
function _convertFP2String(fp16: number): string {
    let v: number = fp16;
    let isNeg: number = 0;

    if (v < 0) {
        isNeg = 1;
        v = 0 - v;
    }

    let intPart: number = v / 65536;
    let fracBits: number = v - intPart * 65536;

    let d1: number = fracBits * 10 / 65536;
    fracBits = fracBits * 10 - d1 * 65536;
    let d2: number = fracBits * 10 / 65536;
    fracBits = fracBits * 10 - d2 * 65536;
    let d3: number = fracBits * 10 / 65536;
    fracBits = fracBits * 10 - d3 * 65536;
    let d4: number = fracBits * 10 / 65536;

    let result: string = "" + intPart + "." + d1 + d2 + d3 + d4;

    if (isNeg == 1) {
        result = "-" + result;
    }

    return result;
}

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
    PrintString(msg);
}

// _checkFpEq: r0=label(string), r1=expected(FP16), r2=actual(FP16)
function _checkFpEq(label: string, expected: FP16, actual: FP16): void {
    let msg: string = label + ": exp=" + fp16ToString(expected) + " got=" + fp16ToString(actual);
    if (actual == expected) {
        msg = msg + " [PASS]";
    } else {
        msg = msg + " [FAIL]";
    }
    PrintString(msg);
}
