import { JSON } from '../../../include/TCSet100/JSON';
import { CJson } from '../../../include/TCSet100/CJson';
import { CFile, FileReadType } from '../../../include/TCSet100/CFile';

class TestRecordJson extends CEvent {
    constructor() { super('Init'); }
    // debug-test
    public Append(): void {
        const r: Record<string, number> = {};

        r["health"] = 100;
        r["speed"] = 5;
        r["score"] = 9999;

        // Basic Record read/write checks
        checkEq("health", 100, r["health"]);
        checkEq("speed", 5, r["speed"]);
        checkEq("score", 9999, r["score"]);

        // JSON round-trip: Record → JSON string → parse → Find
        const file: CFile = new CFile('test.json');
        
        const jsonStr: string = JSON.fromRecord(r);
        file.SetBuffer(jsonStr as any);
        file.Write(FileReadType.text, 8);
        const parsed: CJson = JSON.parse(jsonStr);
        const jh: CJson = parsed.Find("health");
        const jsp: CJson = parsed.Find("speed");
        const jsc: CJson = parsed.Find("score");
        checkEq("json_health", 100, jh.GetInt());
        checkEq("json_speed",  5,   jsp.GetInt());
        checkEq("json_score",  9999, jsc.GetInt());

        
    }
}
