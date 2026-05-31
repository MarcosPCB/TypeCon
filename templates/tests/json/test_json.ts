import { CJson, CJsonType } from '../../../src/sets/TCSet100/CJson';

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

j.Free();
