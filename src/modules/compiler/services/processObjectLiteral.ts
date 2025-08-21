import { ObjectLiteralExpression, SyntaxKind, PropertyAssignment, NumericLiteral } from 'ts-morph';
import { CompilerContext, SymbolDefinition, ESymbolType, CompilerOptions } from '../Compiler';
import { addDiagnostic } from './addDiagnostic';
import { visitExpression } from './visitExpression';
import { getTypeAliasNameForObjectLiteral } from './getTypeAliasNameForObjectLiteral';
import { getArraySize } from './getArraySize';
import { getObjectSize } from './getObjectSize';
import { getObjectTypeLayout } from './getObjectLayout';

export function processObjectLiteral(objLit: ObjectLiteralExpression, context: CompilerContext): { code: string, layout: { [key: string]: SymbolDefinition }, size: number, instanceSize: number } {
    let code = context.options.lineDetail ? `/* Object literal: ${objLit.getText()} */\n` : '';

    // Reserve one slot for the object's base pointer.
    code += `add rsp 1\nset ri rsp\nadd ri 1\nsetarray flat[rsp] ri\n`;
    // The object's base pointer is now stored at flat[rsp].

    //We will store the code for nested objects and arrays here
    //After definining all the root properties, then we add the instance code
    let instanceCode = '';

    /*
      Any object, literal or typed, will follow this structure example:
        [0x00000400] Object address: 0x00000401
        [0x00000401]  - Property 0 (integer) value = 0
        [0x00000402]  - Property 1 (stack array with 3 elements) address = 0x00000404
        [0x00000403]  - Property 2 (stack object with 2 properties) address = 0x00000408

        [0x00000404]    - Property 1 length = 3
        [0x00000405]    - Property 1 element 0 = 0
        [0x00000406]    - Property 1 element 1 = 5
        [0x00000407]    - Property 1 element 2 = 90

        [0x00000408]    - Property 2 property 0 (integer) value = 3
        [0x00000409]    - Property 2 property 1 (integer) value = 7

        So the contents of objects/arrays will come after the properties
    */

    // Build the layout as a plain object.
    let layout: { [key: string]: SymbolDefinition } = {};
    let totalSlots = 0; // count of property slots allocated

    let curTotalSize = 0;

    const aliasName = getTypeAliasNameForObjectLiteral(objLit);
    if (aliasName && context.typeAliases.has(aliasName)) {
      const typeDef = context.typeAliases.get(aliasName)!;
      // Process each expected property (in the declared order from the type alias).
      const totalProps = Object.keys(typeDef.members).length;
      curTotalSize = totalProps;
      for (const [propName, propType] of Object.entries(typeDef.members)) {
        totalSlots++; // Reserve one slot for this property (or the start for arrays/nested objects)
        // Find the property assignment in the object literal by comparing names (ignoring quotes).
        const prop = objLit.getProperties().find(p => {
          if (p.isKind(SyntaxKind.PropertyAssignment)) {
            return (p as any).getName().replace(/[`'"]/g, "") === propName;
          }
          return false;
        });

        if (prop && prop.isKind(SyntaxKind.PropertyAssignment)) {
          const pa = prop as PropertyAssignment;
          //An array of objects is an array of pointers
          if (propType.endsWith("[]")) {
            curTotalSize++;
            code += context.options.lineDetail ? `/* Object array property: ${prop.getText()} */\n` : '';
            code += `add rsp 1\nset ri rsp\nadd ri ${curTotalSize - totalSlots}\nsetarray flat[rsp] ri\n`
            curTotalSize++;
            // For an array property (e.g., low: wow[])
            const baseType = propType.slice(0, -2).trim();
            const initText = pa.getInitializerOrThrow().getText();
            const count = getArraySize(initText);
            const instanceSize = getObjectSize(baseType, context);
            const instanceType = context.typeAliases.get(baseType);
            instanceCode += `add rsp 1\nsetarray flat[rsp] ${count}\n`;
            if (instanceType) {
              const result = getObjectTypeLayout(baseType, context);
              //Set the pointer
              for (let j = 0; j < count; j++) {
                curTotalSize ++;
                instanceCode += context.options.lineDetail ? `/* Element ${j} pointer */\n` : '';
                instanceCode += `add rsp 1\nset ri rsp\nadd ri 1\nsetarray flat[rsp] ri\n`;
                for (let k = 0; k < instanceSize; k++) {
                  instanceCode += context.options.lineDetail ? `/* Element ${j} property ${k} */\n` : '';
                  instanceCode += `set ra 0\nadd rsp 1\nsetarray flat[rsp] ra\n`;
                  curTotalSize++;
                }
              }

              curTotalSize ++;

              layout[propName] = {
                name: propName,
                type: ESymbolType.object | ESymbolType.array,
                offset: totalSlots - 1,
                size: count * instanceSize,
                num_elements: count,
                children: { ...result }  // clone children as plain object
              };
            } else {
              code += context.options.lineDetail ? `/* Array property: ${prop.getText()} */\n` : '';
              // For each element, allocate instanceSize slots.
              for (let j = 0; j < count; j++) {
                curTotalSize += 1;
                instanceCode += context.options.lineDetail ? `/* Element ${j} pointer */\n` : '';
                instanceCode += `add rsp 1\nset ri rsp\nadd ri 1\nsetarray flat[rsp] ri\n`;
                instanceCode += context.options.lineDetail ? `/* Element ${j} instance */\n` : '';
                for (let k = 0; k < instanceSize; k++) {
                  instanceCode += `set ra 0\nadd rsp 1\nsetarray flat[i] ra\n`;
                  curTotalSize++;
                }
              }

              layout[propName] = {
                name: propName,
                type: ESymbolType.array,
                offset: totalSlots - 1,
                size: count * instanceSize,
                num_elements: count,
              };
            }
          } else if (context.typeAliases.has(propType)) {
            code += context.options.lineDetail ? `/* Object property: ${prop.getText()} */\n` : '';
            curTotalSize++;
            code += `add rsp 1\nset ri rsp\nadd ri ${curTotalSize - totalSlots}\nsetarray flat[rsp] ri\n`
            // For a nested object property.
            const result = processObjectLiteral(pa.getInitializerOrThrow() as ObjectLiteralExpression, context);
            instanceCode += result.code;
            const nestedSize = result.size;
            curTotalSize += result.size;
            layout[propName] = {
              name: propName,
              type: ESymbolType.object,
              offset: totalSlots - 1,
              size: nestedSize,
              children: { ...result.layout }  // clone children as plain object
            };
          } else {
            code += context.options.lineDetail ? `/* Primitive property: ${prop.getText()} */\n` : '';
            //curTotalSize++;
            // For a primitive property.
            const init = pa.getInitializerOrThrow();
            code += visitExpression(init, context);
            code += `add rsp 1\nsetarray flat[rsp] ra\n`;
            layout[propName] = {
              name: propName,
              type: ESymbolType.number,
              offset: totalSlots - 1,
              size: 1,
              literal: init.isKind(SyntaxKind.NumericLiteral)
                ? (init as NumericLiteral).getLiteralValue()
                : undefined
            };
          }
        } else {
          // Property not provided: default to 0.
          code += `set ra 0\nadd rsp 1\nsetarray flat[rsp] ra\n`;
          layout[propName] = { name: propName, type: ESymbolType.number, offset: totalSlots, size: 1 };
        }
      }
    } else {
      //addDiagnostic(objLit, context, "warning", `No type alias found for object literal; assuming empty object.`);
      const props = objLit.getProperties();

      for (const p of props) {
        totalSlots++;
        if (p.isKind(SyntaxKind.PropertyAssignment)) {
          const init = p.getInitializerOrThrow();
          const propName = p.getName().replace(/[`'"]/g, "");
          if (init.isKind(SyntaxKind.ArrayLiteralExpression)) {
            code += context.options.lineDetail ? `/* Array literal: ${p.getText()} */\n` : '';
            curTotalSize++;
            code += `add rsp 1\nset ri rsp\nadd ri ${curTotalSize - totalSlots}\nsetarray flat[rsp] ri\n`
            const initText = init.getText();
            const count = getArraySize(initText);
            //const instanceSize = getObjectSize(baseType, context);
            // For each element, allocate instanceSize slots.
            instanceCode += `add rsp 1\nsetarray flat[rsp] ${count}\n`;
            for (let j = 0; j < count; j++) {
              instanceCode += `set ra 0\nadd rsp 1\nsetarray flat[rsp] ra\n`;
              curTotalSize++;
            }
            layout[propName] = {
              name: propName,
              type: ESymbolType.object | ESymbolType.array,
              offset: totalSlots - 1,
              size: count,
              num_elements: count,
            };
          } else if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
            code += context.options.lineDetail ? `/* Object literal property: ${p.getText()} */\n` : '';
            // For a nested object property.
            curTotalSize++;
            code += `add rsp 1\nset ri rsp\nadd ri ${curTotalSize - totalSlots}\nsetarray flat[rsp] ri\n`
            const result = processObjectLiteral(init, context);
            instanceCode += result.code;
            const nestedSize = result.size;
            curTotalSize += result.size;
            layout[p.getName()] = {
              name: propName,
              type: ESymbolType.object,
              offset: totalSlots - 1,
              size: nestedSize,
              children: { ...result.layout }  // clone children as plain object
            };
          } else {
            code += context.options.lineDetail ? `/* Primitive property: ${p.getText()} */\n` : '';
            // For a primitive property.
            //curTotalSize++;
            code += visitExpression(init, context);
            code += `add rsp 1\nsetarray flat[rsp] ra\n`;
            layout[propName] = {
              name: propName,
              type: ESymbolType.number,
              offset: totalSlots - 1,
              size: 1,
              literal: init.isKind(SyntaxKind.NumericLiteral)
                ? (init as NumericLiteral).getLiteralValue()
                : undefined
            };
          }
        } else
          addDiagnostic(objLit, context, "error", `No property assignment found in object literal; no declaration found during object declaration: ${objLit.getText()}`);
      }

    }

    // The object's base pointer is at: flat[rsp - (totalSlots + 1)]
    //code += `set ri rbp\nadd ri ${totalSlots + 1}\nset ra flat[ri]\n`;

    code += instanceCode;

    return { code, layout: layout, size: totalSlots, instanceSize: curTotalSize };
  }