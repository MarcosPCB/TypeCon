class TestRecord extends CEvent {
    constructor() { super('NewGame'); }
    // debug-test
    public Append(): void {
        const r: Record<string, number> = {};

        r["health"] = 100;
        r["speed"] = 5;
        r["score"] = 9999;

        checkEq("health", 100, r["health"]);
        checkEq("speed", 5, r["speed"]);
        checkEq("score", 9999, r["score"]);

        console.log("health=" + r["health"]);
        console.log("speed=" + r["speed"]);
        console.log("score=" + r["score"]);
    }
}
