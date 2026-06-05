import '../../types';

function _Math_pow(base: number, exp: number): number {
    let result: number = 1;
    let i: number = 0;
    while (i < exp) {
        result = result * base;
        i = i + 1;
    }
    return result;
}

function _Math_powFP(base: FP16, exp: number): FP16 {
    let result: FP16 = 1.0;
    let i: number = 0;
    while (i < exp) {
        result = result * base;   // mulscale — both FP16
        i = i + 1;
    }
    return result;
}

function _Math_log(x: number): number {
    let bits: number = 0;
    let v: number = x;
    while (v > 1) {
        v = v >> 1;
        bits = bits + 1;
    }
    return bits * 45426;
}

function _Math_logFP(x: number): number {
    let bits: number = 0;
    let v: number = x;
    while (v > 1) {
        v = v >> 1;
        bits = bits + 1;
    }
    return (bits - 16) * 45426;
}

function _Math_log2(x: number): number {
    let bits: number = 0;
    let v: number = x;
    while (v > 1) {
        v = v >> 1;
        bits = bits + 1;
    }
    return bits * 65536;
}

function _Math_log10(x: number): number {
    let bits: number = 0;
    let v: number = x;
    while (v > 1) {
        v = v >> 1;
        bits = bits + 1;
    }
    return bits * 19729;
}

function _Math_exp(x: number): FP16 {
    let result: FP16 = 1.0;
    let i: number = 0;
    while (i < x) {
        result = mulscale(result, 178145, 16); // 178145 = round(e * 65536) in FP16
        i = i + 1;
    }
    return result;
}
