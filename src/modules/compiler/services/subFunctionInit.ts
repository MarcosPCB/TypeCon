import { ArrowFunction, FunctionExpression, SyntaxKind } from "ts-morph";
import { CompilerContext } from "../Compiler";
import { createHash } from "crypto";
import { indent } from "../helper/indent";
import { visitArrowFunctionExpression } from "./visitArrowFunctionExpression";
import { visitFunctionExpression } from "./visitFunctionExpression";

/**
 * subFunctionInit
 * Initializes the _subFunction state if it hasn't been initialized yet and adds a new clause to the switch.
 * @param node The function expression or arrow function to add to the switch.
 * @param context The compiler context.
 */
export function subFunctionInit(node: FunctionExpression | ArrowFunction, context: CompilerContext) {
    //First we check if the _subFunction state has already been initialized
    
    if(context.subFunction.code == '') {
        const hash = createHash('shake256', {
            outputLength: 6
        });
        hash.update(context.currentFile.path);
        context.subFunction.hash = hash.digest('hex');
        context.subFunction.code = `defstate _subFunctions_${context.subFunction.hash}\n`
        context.subFunction.code += indent(`state pushd\nset rd 0\ngetcurraddress rb\nife rd 1 {\n`, 1);
        context.subFunction.code += indent(`switch rsi\n`, 2);
    }

    //Now we add the clause based on its address
    context.subFunction.index++;
    context.subFunction.code += indent(`case ${context.subFunction.index * 100 + 0x10000}:`, 3);
    context.subFunction.code += indent(
        node.isKind(SyntaxKind.ArrowFunction)
            ? visitArrowFunctionExpression(node as ArrowFunction, context)
            : visitFunctionExpression(node as FunctionExpression, context), 4);
    context.subFunction.code += indent(`state pop\nset rd 0\njump ra\nbreak\n\n`, 3);
}