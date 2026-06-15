import '../../../include/TCSet100/types';

class TestForLoops extends CEvent {
    constructor() { super('InitComplete'); }

    // debug-test
    public Append(): void {
        // ── Traditional for loop: sum 0..4 = 10 ──────────────────────────────
        let sum = 0;
        for (let i = 0; i < 5; i++) {
            sum = sum + i;
        }
        checkEq("for sum 0..4", 10, sum);

        // ── Count-down for loop ───────────────────────────────────────────────
        let countdown = 0;
        for (let j = 5; j > 0; j--) {
            countdown = countdown + 1;
        }
        checkEq("for countdown", 5, countdown);

        // ── Nested for loops (3x3 = 9 iterations) ────────────────────────────
        let nested = 0;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                nested = nested + 1;
            }
        }
        checkEq("nested for 3x3", 9, nested);

        // ── Infinite for loop with break ──────────────────────────────────────
        let breaking = 0;
        for (;;) {
            breaking = breaking + 1;
            if (breaking >= 3) break;
        }
        checkEq("for;; break at 3", 3, breaking);

        // ── for...of over array ───────────────────────────────────────────────
        const arr = [10, 20, 30];
        let total = 0;
        for (const v of arr) {
            total = total + v;
        }
        checkEq("for..of sum", 60, total);

        // ── for...of element count ────────────────────────────────────────────
        const items = [1, 2, 3, 4, 5];
        let count = 0;
        for (const x of items) {
            count = count + 1;
        }
        checkEq("for..of count", 5, count);
    }
}
