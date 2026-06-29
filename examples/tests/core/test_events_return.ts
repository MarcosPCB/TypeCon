import '../../../include/TCSet100/types';

// Events that communicate with the engine via this.argument (the CON RETURN gamevar).
// The engine writes a value before firing the event; the handler reads and/or overwrites it.

// Conditional replace: tile 0 → 100, all others pass through
class TestReturnReplace extends CEvent<'GetMenuTile'> {
    // debug-test
    public Append(): void {
        const inTile: number = this.argument;
        if (inTile == 0) {
            this.argument = 100;
        }
    }
}

// Increment: read argument, add 1, write back
class TestReturnPassThrough extends CEvent<'GetMenuTile'> {
    public Append(): void {
        this.argument = this.argument + 1;
    }
}

// Read-only: verify this.argument is accessible in any event context
class TestArgumentRead extends CEvent {
    constructor() { super('InitComplete'); }
    public Append(): void {
        const val: number = this.argument;
        checkEq("argument readable", 0, val);
    }
}
