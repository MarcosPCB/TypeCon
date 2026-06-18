import { CJson, CJsonType } from './CJson';

/**
 * JSON — Alias to JavaScript's JSON object for TypeCON.
 *
 * Usage:
 *   const node = JSON.parse('{"x":10}');   // → CJson instance
 *   const str  = JSON.stringify(node);      // → string
 *
 * Both methods are thin wrappers around CJson:
 *   JSON.parse(text)   ≡ new CJson(text)
 *   JSON.stringify(obj) ≡ obj.Stringify()
 */
export namespace JSON {
    /**
     * Parse a JSON string and return the root node as a CJson instance.
     * Equivalent to `new CJson(text)`.
     */
    export function parse(text: string): CJson {
        return new CJson(text);
    }

    /**
     * Serialize a CJson node back to a JSON string.
     * Equivalent to `obj.Stringify()`.
     */
    export function stringify(obj: CJson): string {
        return obj.Stringify();
    }

    /**
     * Serialize a Record<string, number> directly to a JSON string.
     * Equivalent to: new CJson('').fromRecord(rec).Stringify()
     *
     * Requires that all keys were written with string literals or dynamic
     * string expressions (the compiler stores key heap-strings on each write).
     */
    export function fromRecord(rec: Record<string, any>): string {
        const node = new CJson('');
        const json: CJson = node.fromRecord(rec);
        return json.Stringify();
    }
}
