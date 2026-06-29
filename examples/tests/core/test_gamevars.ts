import '../../../include/TCSet100/types';

// Top-level gameVar declarations — emitted as EDuke32 `gamevar` instructions
// rather than flat[] slots; visible to all CON code in the same session
const SCORE: gameVar = 0;
const LIVES: gameVar = 3;
const FLAGS: gameVar = 0;

class TestGameVars extends CEvent {
    constructor() { super('InitComplete'); }

    // debug-test
    public Append(): void {
        // Default initialisation value persists
        checkEq("LIVES init", 3, LIVES);

        // Simple assignment
        SCORE = 100;
        checkEq("SCORE=100", 100, SCORE);

        // Arithmetic through a gamevar
        SCORE = SCORE + 50;
        checkEq("SCORE+50", 150, SCORE);

        LIVES = LIVES - 1;
        checkEq("LIVES-1", 2, LIVES);

        // Conditional read
        FLAGS = 1;
        if (FLAGS) {
            SCORE = SCORE + 1;
        }
        checkEq("SCORE after flag", 151, SCORE);

        // Cross-gamevar expression
        LIVES = LIVES + FLAGS;
        checkEq("LIVES+FLAGS", 3, LIVES);
    }
}
