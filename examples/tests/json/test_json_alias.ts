import { JSON } from '../../../src/sets/TCSet100/JSON';

const node = JSON.parse('{"x":10,"label":"duke"}');

const xNode = node.Find("x");
const xVal: number = xNode.GetInt();

const asStr: string = JSON.stringify(node);

node.Free();

console.log("x=" + xVal);
console.log("json=" + asStr);
