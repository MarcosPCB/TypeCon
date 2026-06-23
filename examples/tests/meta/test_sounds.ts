import '../../../include/TCSet100/types';

// ── Sound definitions ────────────────────────────────────────────────────────

// Auto-assigned from default base slot 400 → define BARREL_EXPLODE 400
const BARREL_EXPLODE: Sound = {
    file: 'barrel_explode.wav',
    dist: 800,
    vol: 200,
};

// Auto-assigned next slot → define AMBIENT_HUM 401
const AMBIENT_HUM: Sound = {
    file: 'ambient_hum.wav',
    pitchMin: -200,
    pitchMax:  200,
    flags: SoundFlags.Loop,
    dist: 1200,
    vol: 128,
};

const SPECIAL_EVENT: Sound = {
    id: 42,
    file: 'special_event.wav',
    vol: 255,
};

const MUSIC_STING: Sound = {
    file: 'sting.wav',
    flags: SoundFlags.Global,
    vol: 255,
};

// ── Sound() in a per-actor event ─────────────────────────────────────────────
// 'Spawn' fires for every sprite when it spawns — Sound() is valid in PAE context.
class TestSoundsOnSpawn extends CEvent<'Spawn'> {
    public Append(): void {
        this.Sound(BARREL_EXPLODE);
        this.Sound(AMBIENT_HUM);
        this.Sound(SPECIAL_EVENT);
        this.Sound(MUSIC_STING);
    }
}

// ── ScreenSound() in a display event ─────────────────────────────────────────
// 'DisplayEnd' fires during screen rendering — ScreenSound() is the correct call here.
class TestScreenSoundDisplay extends CEvent<'DisplayEnd'> {
    constructor() { super('DisplayEnd'); }

    public Append(): void {
        this.ScreenSound(MUSIC_STING);
    }
}
