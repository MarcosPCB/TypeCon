import { JSON } from '../../../include/TCSet100/JSON';
import { CJson } from '../../../include/TCSet100/CJson';

class TestJsonAlias2 extends CEvent {
    constructor() { super('Init'); }
    // debug-test
    public Append(): void {
        const node: CJson = JSON.parse('{"x":10}');

        const xNode: CJson = node.Find("x");
        const xVal: number = xNode.GetInt();

        checkEq("x", 10, xVal);

        node.Free();
    }
}
