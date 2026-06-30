import '../../../include/TCSet100/types';

class TestStringMethods extends CEvent {
    constructor() { super('InitComplete'); }
    // debug-test
    public Append(): void {
        let s = "Hello, World!";

        // charCodeAt (as method)
        checkEq("charCodeAt(0)", 72, s.charCodeAt(0));
        checkEq("charCodeAt(7)", 87, s.charCodeAt(7));

        // at
        let a0 = s.at(0);
        let an = s.at(-1);
        checkEq("at(0) len", 1, a0.length);
        checkEq("at(0) char", 72, charCodeAt(a0, 0));
        checkEq("at(-1) char", 33, charCodeAt(an, 0));

        // indexOf
        checkEq("indexOf hit", 7, s.indexOf("World"));
        checkEq("indexOf miss", -1, s.indexOf("xyz"));
        checkEq("indexOf from", 8, s.indexOf("o", 5));

        // startsWith / endsWith
        checkEq("startsWith hit", 1, s.startsWith("Hello"));
        checkEq("startsWith miss", 0, s.startsWith("World"));
        checkEq("endsWith hit", 1, s.endsWith("World!"));
        checkEq("endsWith miss", 0, s.endsWith("Hello"));

        // toUpperCase / toLowerCase
        let upper = s.toUpperCase();
        let lower = s.toLowerCase();
        checkEq("upper len", 13, upper.length);
        checkEq("upper[0]", 72, charCodeAt(upper, 0));
        checkEq("upper[7]", 87, charCodeAt(upper, 7));
        checkEq("lower[0]", 104, charCodeAt(lower, 0));
        checkEq("lower[7]", 119, charCodeAt(lower, 7));

        // trim / trimStart / trimEnd
        let padded = "  hello  ";
        let trimmed = padded.trim();
        let trimS = padded.trimStart();
        let trimE = padded.trimEnd();
        checkEq("trim len", 5, trimmed.length);
        checkEq("trimStart len", 7, trimS.length);
        checkEq("trimEnd len", 7, trimE.length);
        checkEq("trim[0]", 104, charCodeAt(trimmed, 0));

        // repeat
        let ab = "ab";
        let rep = ab.repeat(3);
        checkEq("repeat len", 6, rep.length);
        checkEq("repeat[0]", 97, charCodeAt(rep, 0));
        checkEq("repeat[2]", 97, charCodeAt(rep, 2));
        checkEq("repeat[5]", 98, charCodeAt(rep, 5));

        // padStart / padEnd
        let s42 = "42";
        let ps = s42.padStart(4, 48);
        let pe = s42.padEnd(5, 48);
        checkEq("padStart len", 4, ps.length);
        checkEq("padStart[0]", 48, charCodeAt(ps, 0));
        checkEq("padStart[2]", 52, charCodeAt(ps, 2));
        checkEq("padEnd len", 5, pe.length);
        checkEq("padEnd[0]", 52, charCodeAt(pe, 0));
        checkEq("padEnd[2]", 48, charCodeAt(pe, 2));
    }
}
