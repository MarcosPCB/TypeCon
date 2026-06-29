import '../../../include/TCSet100/types';

// Class with stateful methods — tests that method calls mutate instance state
class Counter {
    public count: number = 0;

    constructor() {}

    public increment(): void {
        this.count = this.count + 1;
    }

    public add(n: number): void {
        this.count = this.count + n;
    }

    public reset(): void {
        this.count = 0;
    }
}

// Class with an array property and methods that operate on it
class Ring {
    public data: number[];
    public size: number = 3;

    constructor() {
        this.data = [0, 0, 0];
    }

    public set(i: number, v: number): void {
        this.data[i] = v;
    }

    public get(i: number): number {
        return this.data[i];
    }

    public sum(): number {
        let s = 0;
        for (const v of this.data) {
            s = s + v;
        }
        return s;
    }
}

class TestClasses extends CEvent {
    constructor() { super('InitComplete'); }

    // debug-test
    public Append(): void {
        // Counter: method calls accumulate state
        let c = new Counter();
        c.increment();
        c.increment();
        c.add(8);
        checkEq("counter 2+8", 10, c.count);
        c.reset();
        checkEq("counter reset", 0, c.count);

        // Ring: array-backed get/set and aggregate method
        let r = new Ring();
        r.set(0, 10);
        r.set(1, 20);
        r.set(2, 30);
        checkEq("ring.get(0)", 10, r.get(0));
        checkEq("ring.get(2)", 30, r.get(2));
        checkEq("ring.sum()", 60, r.sum());
    }
}
