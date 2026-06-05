import { JSON } from '../../../src/sets/TCSet100/JSON';

class TestJsonAlias extends CEvent {
    constructor() { super('NewGame'); }
    // debug-test
    public Append(): void {
        const node = JSON.parse('{"x":10,"label":"duke"}');

        const xNode = node.Find("x");
        const xVal: number = xNode.GetInt();

        const asStr: string = JSON.stringify(node);

        checkEq("x", 10, xVal);

        node.Free();

        console.log("x=" + xVal);
        console.log("json=" + asStr);
    }
}
