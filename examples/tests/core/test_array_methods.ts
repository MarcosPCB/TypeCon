import '../../../include/TCSet100/types';

class TestArrayMethods extends CEvent {
    constructor() { super('InitComplete'); }

    // debug-test
    public Append(): void {
        // ── indexOf / includes ────────────────────────────────────────────────
        let arr1 = [10, 20, 30, 40, 50];
        checkEq("indexOf hit", 2, arr1.indexOf(30));
        checkEq("indexOf miss", -1, arr1.indexOf(99));
        checkEq("includes hit", 1, arr1.includes(20));
        checkEq("includes miss", 0, arr1.includes(99));

        // ── at ───────────────────────────────────────────────────────────────
        let arr2 = [100, 200, 300];
        checkEq("at pos", 200, arr2.at(1));
        checkEq("at neg", 300, arr2.at(-1));
        checkEq("at neg2", 100, arr2.at(-3));

        // ── fill ─────────────────────────────────────────────────────────────
        let arr3 = [1, 2, 3, 4, 5];
        arr3.fill(7);
        checkEq("fill[0]", 7, arr3[0]);
        checkEq("fill[4]", 7, arr3[4]);

        // ── reverse ──────────────────────────────────────────────────────────
        let arr4 = [1, 2, 3, 4];
        arr4.reverse();
        let r0 = arr4[0]; let r1 = arr4[1]; let r2 = arr4[2]; let r3 = arr4[3];
        checkEq("reverse[0]", 4, r0);
        checkEq("reverse[1]", 3, r1);
        checkEq("reverse[2]", 2, r2);
        checkEq("reverse[3]", 1, r3);

        // ── concat ───────────────────────────────────────────────────────────
        let a5 = [1, 2, 3];
        let b5 = [4, 5, 6];
        let c5 = a5.concat(b5);
        checkEq("concat len", 6, c5.length);
        checkEq("concat[0]", 1, c5[0]);
        checkEq("concat[5]", 6, c5[5]);

        // ── map ───────────────────────────────────────────────────────────────
        let arr6 = [1, 2, 3, 4];
        let doubled = arr6.map((x: number, i: number) => { return x * 2; });
        checkEq("map len", 4, doubled.length);
        checkEq("map[0]", 2, doubled[0]);
        checkEq("map[3]", 8, doubled[3]);

        // ── filter ────────────────────────────────────────────────────────────
        let arr7 = [1, 2, 3, 4, 5, 6];
        let evens = arr7.filter((x: number, i: number) => {
            let r = 0;
            if (x % 2 == 0) { r = 1; }
            return r;
        });
        checkEq("filter len", 3, evens.length);
        checkEq("filter[0]", 2, evens[0]);
        checkEq("filter[2]", 6, evens[2]);

        // ── find ──────────────────────────────────────────────────────────────
        let arr8 = [10, 20, 30, 40];
        let found = arr8.find((x: number, i: number) => {
            let r = 0;
            if (x > 25) { r = 1; }
            return r;
        });
        checkEq("find hit", 30, found);
        let notFound = arr8.find((x: number, i: number) => {
            let r = 0;
            if (x > 100) { r = 1; }
            return r;
        });
        checkEq("find miss", -1, notFound);

        // ── findIndex ─────────────────────────────────────────────────────────
        let arr9 = [10, 20, 30, 40];
        let fi = arr9.findIndex((x: number, i: number) => {
            let r = 0;
            if (x > 25) { r = 1; }
            return r;
        });
        checkEq("findIndex hit", 2, fi);
        let fim = arr9.findIndex((x: number, i: number) => {
            let r = 0;
            if (x > 100) { r = 1; }
            return r;
        });
        checkEq("findIndex miss", -1, fim);

        // ── some / every ──────────────────────────────────────────────────────
        let arr10 = [2, 4, 6, 8];
        let someEven = arr10.some((x: number, i: number) => {
            let r = 0;
            if (x % 2 == 0) { r = 1; }
            return r;
        });
        checkEq("some all-even", 1, someEven);
        let someOdd = arr10.some((x: number, i: number) => {
            let r = 0;
            if (x % 2 != 0) { r = 1; }
            return r;
        });
        checkEq("some none-odd", 0, someOdd);
        let everyEven = arr10.every((x: number, i: number) => {
            let r = 0;
            if (x % 2 == 0) { r = 1; }
            return r;
        });
        checkEq("every all-even", 1, everyEven);
        let everyGt5 = arr10.every((x: number, i: number) => {
            let r = 0;
            if (x > 5) { r = 1; }
            return r;
        });
        checkEq("every not-all-gt5", 0, everyGt5);

        // ── reduce ────────────────────────────────────────────────────────────
        let arr11 = [1, 2, 3, 4, 5];
        let sum = arr11.reduce((acc: number, x: number, i: number) => { return acc + x; }, 0);
        checkEq("reduce sum", 15, sum);
        let product = arr11.reduce((acc: number, x: number, i: number) => { return acc * x; }, 1);
        checkEq("reduce product", 120, product);

        // ── splice ────────────────────────────────────────────────────────────
        let arr12 = [1, 2, 3, 4, 5];
        let removed = arr12.splice(1, 2);
        checkEq("splice removed len", 2, removed.length);
        checkEq("splice removed[0]", 2, removed[0]);
        checkEq("splice removed[1]", 3, removed[1]);
        checkEq("splice src len after", 3, arr12.length);
        checkEq("splice src[0]", 1, arr12[0]);
        checkEq("splice src[1]", 4, arr12[1]);
        checkEq("splice src[2]", 5, arr12[2]);

        // ── new Array() ───────────────────────────────────────────────────────
        let na0 = new Array();
        checkEq("new Array() len", 0, na0.length);

        let na1 = new Array(5);
        checkEq("new Array(n) len", 5, na1.length);

        let na2 = new Array(10, 20, 30);
        checkEq("new Array(a,b,c) len", 3, na2.length);
        checkEq("new Array(a,b,c)[0]", 10, na2[0]);
        checkEq("new Array(a,b,c)[2]", 30, na2[2]);
    }
}
