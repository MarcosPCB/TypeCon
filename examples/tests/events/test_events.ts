import '../../../include/TCSet100/types';

// PAE — Per-Actor: fires when a sprite spawns (actor loop context)
class TestPAE extends CEvent {
    constructor() { super('Spawn'); }
    public Append(): void {}
}

// DE — Display: fires every frame for the status bar (rendering context)
class TestDE extends CEvent {
    constructor() { super('DisplaySBar'); }
    public Append(): void {}
}

// IE — Input: fires when the player presses forward (input processing context)
class TestIE extends CEvent {
    constructor() { super('MoveForward'); }
    public Append(): void {}
}

// WE — Weapon: fires before a projectile is spawned (weapon system context)
class TestWE extends CEvent {
    constructor() { super('PreWeaponShoot'); }
    public Append(): void {}
}

// PIE — Player Inventory: fires when the jetpack is activated (inventory context)
class TestPIE extends CEvent {
    constructor() { super('UseJetpack'); }
    public Append(): void {}
}

// ME — Misc: fires once when a level finishes loading (game lifecycle)
class TestME extends CEvent {
    constructor() { super('EnterLevel'); }
    public Append(): void {
        console.log("test_events: EnterLevel OK");
    }
}

// ME — verify cheat events compile
class TestCheat extends CEvent {
    constructor() { super('CheatGetSteroids'); }
    public Append(): void {}
}

// ME — verify cutscene events compile
class TestCutscene extends CEvent {
    constructor() { super('CutScene'); }
    public Append(): void {}
}
