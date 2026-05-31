import { JSON } from '../../../src/sets/TCSet100/JSON';
import { CJson } from '../../../src/sets/TCSet100/CJson';

const node: CJson = JSON.parse('{"x":10}');

const xNode: CJson = node.Find("x");
const xVal: number = xNode.GetInt();

console.log("x=" + xVal);

node.Free();
