import { CJson, CJsonType } from '../../../include/TCSet100/CJson';

class TestJson extends CEvent {
    constructor() { super('Init'); }
    // debug-test
    public Append(): void {
        const j: CJson = new CJson('{"x":10,"y":1.5,"items":[1,2,3],"ok":true,"nothing":null}');

        const jx: CJson = j.Find("x");
        const jy: CJson = j.Find("y");
        const jItems: CJson = j.Find("items");
        const jOk: CJson = j.Find("ok");
        const jNil: CJson = j.Find("nothing");

        const xVal: number  = jx.GetInt();
        const yVal: FP16    = jy.GetNumber();
        const ilen: number  = jItems.GetLength();
        const okVal: boolean = jOk.GetBool();
        const isNull: boolean = jNil.IsNull();

        const item1: CJson  = jItems.GetItem(1);
        const i1Val: number = item1.GetInt();

        const jsStr: string = j.Stringify();

        checkEq("x", 10, xVal);
        checkFpEq("y", 98304 as unknown as FP16, yVal);  // 1.5 in FP16 = 65536 + 32768
        checkEq("items length", 3, ilen);
        checkEq("ok", 1, okVal as unknown as number);
        checkEq("isNull", 1, isNull as unknown as number);
        checkEq("items[1]", 2, i1Val);

        j.Free();
    }
}
