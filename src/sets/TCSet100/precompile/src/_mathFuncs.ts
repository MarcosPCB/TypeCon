import '../../types';

// _Math_pow: rb = base^exp (integer)
function _Math_pow(base: number, exp: number): number {
    let result: number = 1;
    let i: number = 0;
    while (i < exp) {
        result = result * base;
        i = i + 1;
    }
    return result;
}

// _Math_powFP: rb = base^exp in FP16 (base FP16, exp integer)
function _Math_powFP(base: FP16, exp: number): FP16 {
    let result: FP16 = 1.0;
    let i: number = 0;
    while (i < exp) {
        result = result * base;   // mulscale — both FP16
        i = i + 1;
    }
    return result;
}

// _Math_log: ln(x) in FP16 — floor(log2(x)) * ln(2);  ln(2) FP16 = 45426
function _Math_log(x: number): number {
    let bits: number = 0;
    let v: number = x;
    while (v > 1) {
        v = v >> 1;
        bits = bits + 1;
    }
    return bits * 45426;
}

// _Math_logFP: ln(fp_value) in FP16 — (floor(log2(x_raw)) - 16) * ln(2)
// x is the raw FP16 integer (e.g. 131072 for 2.0)
function _Math_logFP(x: number): number {
    let bits: number = 0;
    let v: number = x;
    while (v > 1) {
        v = v >> 1;
        bits = bits + 1;
    }
    return (bits - 16) * 45426;
}

// _Math_log2: log2(x) in FP16
function _Math_log2(x: number): number {
    let bits: number = 0;
    let v: number = x;
    while (v > 1) {
        v = v >> 1;
        bits = bits + 1;
    }
    return bits * 65536;
}

// _Math_log10: log10(x) in FP16;  log10(2) FP16 = 19729
function _Math_log10(x: number): number {
    let bits: number = 0;
    let v: number = x;
    while (v > 1) {
        v = v >> 1;
        bits = bits + 1;
    }
    return bits * 19729;
}

// _Math_exp: e^x Taylor 5-term, x in FP16, result FP16
function _Math_exp(x: FP16): FP16 {
    let ONE: FP16 = 1.0;
    let term: FP16 = x;
    let result: FP16 = ONE + term;
    term = (term * x) / 2;    // mulscale — both FP16
    result = result + term;
    term = (term * x) / 3;
    result = result + term;
    term = (term * x) / 4;
    result = result + term;
    term = (term * x) / 5;
    result = result + term;
    return result;
}

// _Math_tan: tan(bam) in FP16
function _Math_tan(bam: number): FP16 {
    let s: FP16 = Math.sin(bam);
    let c: FP16 = Math.cos(bam);
    return s / c;
}

// _Math_tanFP: tan(degrees FP16) in FP16
function _Math_tanFP(degrees: FP16): FP16 {
    let deg: number = fp16ToInt(degrees);
    let bam: number = deg * 2048;
    bam = bam / 360;
    let s: FP16 = Math.sin(bam);
    let c: FP16 = Math.cos(bam);
    return s / c;
}
