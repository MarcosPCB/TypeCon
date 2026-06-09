import { CFile, FileReadType } from '../../../include/TCSet100/CFile';
import { CJson } from '../../../include/TCSet100/CJson';

/**
 * Typed container for enemy config data loaded from JSON.
 *
 * NOTE: In TypeCON, class method parameters of object types cannot call
 * methods on those parameters (the compiler resolves them as state names).
 * To populate a typed object from a CJson node, access the CJson directly
 * in the caller scope where the type is declared. See Append() below.
 */
class EnemyStats {
    public health: number;
    public damage: number;

    constructor() {
        this.health = 0;
        this.damage = 0;
    }
}

class TestFileJson extends CEvent {
    constructor() { super('Init'); }

    // debug-test
    public Append(): void {
        // Read JSON from disk with CFile
        const f: CFile = new CFile("examples/tests/json/data/enemies.json");
        f.Read(FileReadType.text, 8);
        const root: CJson = new CJson(f.GetBuffer() as string);

        // ── Load trooper into typed object ────────────────────────────────
        // Each Find() / Get*() result must be stored in an explicitly-typed
        // variable before using it — TypeCON does not support method chaining.
        const trooper: EnemyStats = new EnemyStats();
        const trooperNode: CJson = root.Find("trooper");
        const thNode: CJson = trooperNode.Find("health");
        trooper.health = thNode.GetInt();
        const tdNode: CJson = trooperNode.Find("damage");
        trooper.damage = tdNode.GetInt();

        // ── Load commander into typed object ─────────────────────────────
        const commander: EnemyStats = new EnemyStats();
        const commanderNode: CJson = root.Find("commander");
        const chNode: CJson = commanderNode.Find("health");
        commander.health = chNode.GetInt();
        const cdNode: CJson = commanderNode.Find("damage");
        commander.damage = cdNode.GetInt();

        // ── Assert on typed object fields ─────────────────────────────────
        checkEq("trooper health",   30, trooper.health);
        checkEq("trooper damage",   10, trooper.damage);
        checkEq("commander health", 50, commander.health);
        checkEq("commander damage", 20, commander.damage);

        // ── Array field ───────────────────────────────────────────────────
        const drops: CJson = root.Find("drops");
        checkEq("drops length", 3, drops.GetLength());
        const d0: CJson = drops.GetItem(0);
        const d1: CJson = drops.GetItem(1);
        const d2: CJson = drops.GetItem(2);
        checkEq("drops[0]", 100, d0.GetInt());
        checkEq("drops[1]", 50,  d1.GetInt());
        checkEq("drops[2]", 25,  d2.GetInt());

        root.Free();
    }
}
