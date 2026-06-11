import '../../../include/TCSet100/types';

// ── Test: Actor custom properties via _pCptr ─────────────────────────────────
//
// Every CustomPropsActor instance gets a 6-word heap block in flat[] pointed to
// by the GAMEVAR_PERACTOR variable _pCptr.  Block layout:
//
//   offset 0  state.phase    (ActorState inline object, slot 0)
//   offset 1  state.timer    (ActorState inline object, slot 1)
//   offset 2  waypoints      (number[] heap pointer — 0 until explicitly allocated)
//   offset 3  label          (string  heap pointer — 0 until explicitly assigned)
//   offset 4  health         (number, default 100)
//   offset 5  rage           (number, default 0)
//
// Compile and validate:
//   node dist/main.js -c -il examples/tests/actors/test_actor_custom_props.ts
//   node dist/main.js -L -di -o test_actor_custom_props.con
//   node dist/main.js -V -i compiled/test_actor_custom_props.con
//
// Full runtime testing requires EDuke32; the TypeCON VM does not emulate
// getactorvar/setactorvar or the allsprites GC scan.

// ── Inline object type ────────────────────────────────────────────────────────
type ActorState = {
    phase: number;  // AI phase: 0=idle, 1=chase, 2=attack
    timer: number;  // countdown in game ticks
}

// ── Actor with all supported custom property kinds ────────────────────────────
class CustomPropsActor extends CActor {
    // Object: stored INLINE in the _pCptr block (2 contiguous slots)
    public state: ActorState;

    // Array: 1 slot in the _pCptr block holding a flat[] heap pointer
    // The array itself is allocated separately by the user (e.g. via alloc).
    public waypoints: number[];

    // String: 1 slot in the _pCptr block holding a flat[] string pointer
    public label: string;

    // Two plain number variables
    public hp: number = 100;
    public rage: number = 0;

    constructor() {
        super(9999, true, 100);
        // Initialise all custom properties in the constructor body.
        // This code is compiled into EVENT_SPAWN after the _pCptr block is allocated.
        this.state = { phase: 0, timer: 0 }
        this.waypoints = [0, 0, 0];  // 3-element array (indices 0, 1, 2)
        this.label = 'Testing';
        this.hp = 100;
        this.rage = 0;
    }

    // debug-test
    Main() {
        // ── Number properties ─────────────────────────────────────────────────
        this.rage = 1;

        this.state.phase = 3;
        this.state.timer = 1;

        this.waypoints[0] = 1;
        this.waypoints[1] = 2;
        this.waypoints[2] = 3;

        console.log("Label: " + this.label);

        checkEq('state.phase', 3, this.state.phase);
        checkEq('state.timer', 1, this.state.timer);
        checkEq('waypoints', 3, this.waypoints.length);
        checkEq('waypoint[0]', 1, this.waypoints[0])
        checkEq('waypoint[1]', 2, this.waypoints[1]);
        checkEq('waypoint[2]', 3, this.waypoints[2]);
        checkEq('hp', 100, this.hp);
        checkEq('rage', 1, this.rage);
    }
}
