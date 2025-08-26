import { Expression } from "ts-morph";
import { CompilerContext, SegmentIdentifier, SegmentIndex, SegmentProperty, MemberSegment, SymbolDefinition, EnumDefinition, ESymbolType } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { CON_NATIVE_VAR, CON_NATIVE_FLAGS, CON_NATIVE_TYPE, nativeVars_Players } from "../../../sets/TCSet100/native";
import { nativeVars_Sprites, nativeVars_Sectors, nativeVars_Walls } from "../../../sets/TCSet100/native";
import { unrollMemberExpression } from "./unrollMemberExpression";
import { visitExpression } from "./visitExpression";

export function visitMemberExpression(expr: Expression, context: CompilerContext, assignment?: boolean, direct?: boolean, reg = 'ra'): string {
    let code = context.options.lineDetail ? `/* ${expr.getText()} */\n` : '';
    const segments = unrollMemberExpression(expr);

    if (segments.length === 0) {
      addDiagnostic(expr, context, "warning", `No segments found for expression: ${expr.getText()}`);
      return `set ${reg} 0\n`;
    }

    // Handle the object
    const obj = segments[0] as SegmentIdentifier;
    let sym: SymbolDefinition | EnumDefinition | null = null;
    if (obj.kind == 'identifier' && ['sprites', 'sectors', 'walls', 'players', 'EMoveFlags'].indexOf(obj.name) == -1) {
      const eSym = context.symbolTable.get(obj.name);

      code += context.options.symbolPrint ? `/*Symbol ${JSON.stringify(eSym, undefined, 2)}*/\n` : '';

      if (eSym && eSym.type == ESymbolType.enum) {
        const seg = segments[1] as SegmentProperty
        if (direct)
          return String(eSym.children[seg.name]);

        code = `set ${reg} ${eSym.children[seg.name]}\n`;
        return code;
      }

      let isParam = false;
      sym = context.symbolTable.get(obj.name) as SymbolDefinition;
      if (!sym) {
        sym = context.paramMap[obj.name];

        if (!sym) {
          addDiagnostic(expr, context, "error", `Undefined object: ${expr.getText()}`);
          return "set ${reg} 0\n";
        }

        isParam = true;
      }

      if (sym.type & ESymbolType.string || sym.type & ESymbolType.array) {
        if ((segments[1].kind == 'property' && segments[1].name == 'length'))
          return code + `set ri rbp\nadd ri ${sym.offset}\nset ri flat[ri]\n${assignment ? `setarray flat[ri] ${reg}\n` : `set ${reg} flat[ri]`}\n`;
      }

      if (sym.type & ESymbolType.native) {
        //If got here, it must be a symbol only
        for (let i = 1; i < segments.length; i++) {
          const seg = segments[i];

          if (seg.kind == 'index') {
            addDiagnostic(expr, context, "error", `Native object array symbols not yet supported`);
            return "";
          }

          if (seg.kind == 'property') {
            if (!sym.children) {
              addDiagnostic(expr, context, "error", `Object ${sym.name} properties are not defined: ${expr.getText()}`);
              return "set ra 0\n";
            }

            if (!sym.children[seg.name]) {
              addDiagnostic(expr, context, "error", `Property ${seg.name} not found in: ${expr.getText()}`);
              return "set ra 0\n";
            }

            sym = sym.children[seg.name] as SymbolDefinition;
            continue;
          }
        }

        code += assignment ? `set ${sym.CON_code} ${reg}\n` : `set ${reg} ${sym.CON_code}\n`;
        return code;
      }

      if (!sym.native_pointer) {
        if(!isParam)
          code += `set ri rbp\nadd ri ${sym.offset}\n`;
        else
          code += `set ri r${sym.offset}\n`;
        //code += `set ri flat[ri]\n`;

        for (let i = 1; i < segments.length; i++) {
          const seg = segments[i];

          if (sym.type & ESymbolType.object || sym.type & ESymbolType.array)
            code += `set ri flat[ri]\n`;

          if (seg.kind == 'index') {
            if (!(sym.type & ESymbolType.array) && !(sym.type & ESymbolType.object) && !(sym.type & ESymbolType.string)) {
              addDiagnostic(expr, context, "error", `Indexing a non array variable: ${expr.getText()} - ${sym.type}`);
              return "set ra 0\n";
            }

            const localVars = context.localVarCount;
            //code += `state pushd\n`
            if (assignment)
              code += `state push\n`;

            code += `state pushi\n`;
            code += visitExpression(seg.expr, context);
            if (localVars != context.localVarCount) {
              code += `sub rsp ${localVars - context.localVarCount - 1}\n`;
              context.localVarCount = localVars;
            }
            code += `state popi\n`;
            if (sym.type & (ESymbolType.object | ESymbolType.array))
              code += `mul ra ${((sym as SymbolDefinition).size / (sym as SymbolDefinition).num_elements || 1) + 1}\nadd ri ra\nadd ri 1\n`
            else
              code += `add ri ra\nadd ri 1\n`;

            if (sym.type & (ESymbolType.string | ESymbolType.array))
              context.curExpr = ESymbolType.string | ESymbolType.array;

            if (assignment)
              code += `state pop\n`;

            continue;
          }

          if (seg.kind == 'property') {
            if (seg.name == 'length' && sym.type & ESymbolType.array) {
              code += `set ri flat[ri]\n`;
              context.curExpr = ESymbolType.number;
              break;
            }

            if (!sym.children) {
              addDiagnostic(expr, context, "error", `Object property ${seg.name} is not defined: ${expr.getText()}`);
              return "set ra 0\n";
            }

            if (!sym.children[seg.name]) {
              addDiagnostic(expr, context, "error", `Property ${seg.name} not found in: ${expr.getText()}`);
              return "set ra 0\n";
            }

            sym = sym.children[seg.name] as SymbolDefinition | EnumDefinition;

            if (sym.type == ESymbolType.enum)
              return direct ? String(sym.children[(segments[i + 1] as SegmentProperty).name]) : (`set ${reg} ${sym.children[(segments[i + 1] as SegmentProperty).name]}\n`);

            if(sym.global) {
              if (sym.offset != 0)
                code += `set ri ${sym.offset}\n`;
              else
                code += `set ri 0\n`;
            } else if (sym.offset != 0)
              code += `add ri ${sym.offset}\n`;

            continue;
          }
        }

        if(assignment && sym.readonly) {
          addDiagnostic(expr, context, 'error', `Tried to assign to a read-only property ${sym.name} in ${expr.getText()}`);
          return '';
        }

        if (assignment)
          code += `setarray flat[ri] ${reg}\n`;
        else
          code += `set ${reg} flat[ri]\n`;

        if (direct)
          return String(sym.literal);

        if(sym.type & ESymbolType.constant)
          code = `set ${reg} ${sym.literal}\n`;

        if(sym.type & ESymbolType.object || (sym.type & ESymbolType.array && segments.at(-1).kind != 'index'))
          return code + `set ${reg} ri\n`;

        return code;
      }
    }

    if (obj.kind == 'identifier' || obj.kind == 'this') {
      let currSegIndex = 1;
      switch (obj.name) {
        case 'EMoveFlags':
          if (direct)
            return EMoveFlags[(segments[1] as SegmentProperty).name];

          code = `set ${reg} ${EMoveFlags[(segments[1] as SegmentProperty).name]}\n`;
          return code;

        default: //sprites, sectors, walls or other enums
          if (obj.kind != 'this') {
            //Check if it's a enum
            const e = context.symbolTable.get(obj.name);

            if (e && e.type == ESymbolType.enum) {
              const seg = segments[1] as SegmentProperty
              if (direct)
                return String(e.children[seg.name]);

              code += `set ${reg} ${e.children[seg.name]}\n`;
              return code;
            }

            if (segments[1].kind != 'index' && (sym && !(sym as SymbolDefinition).native_pointer_index)) {
              addDiagnostic(expr, context, "error", `Missing index for ${obj.name}: ${expr.getText()}`);
              return "set ra 0\n";
            }
            if (segments[1].kind == 'index') {
              if(assignment)
                code += `state push\n`;
              code += visitExpression(segments[1].expr, context);
              code += `set ri ra\n`;
              if(assignment)
                code += `state pop\n`;
            }
          } else {
            if (context.curClass)
              code += `set ri flat[rbp]\n`;

            if (context.isPlayer)
              obj.name = 'players';
            else if (context.currentActorPicnum)
              obj.name = 'sprites';
          }

          //Go no further, it just wants the reference
          if (segments.length == 2 && segments[1].kind == 'index') {
            context.localVarNativePointer = obj.name as any;
            context.localVarNativePointerIndexed = true,
              code += `set ${reg} ri\n`;
            return code;
          }

          sym = sym as SymbolDefinition;

          let seg = segments[obj.kind == 'this' || (sym && sym.native_pointer_index) ? 1 : 2] as SegmentProperty;
          let op = '';

          if (sym && sym.native_pointer) {
            obj.name = sym.native_pointer;

            if (sym.native_pointer_index)
              code += `set ri rbp\nadd ri ${sym.offset}\nset ri flat[ri]\n`;
          }

          if (seg.kind == 'property') {
            if (obj.kind == 'this' && (context.curClass || context.symbolTable.has(seg.name))) {
              if (context.curClass && context.curClass.num_elements == 0) {
                addDiagnostic(expr, context, 'error', `Class ${context.curClass.name} has no properties`);
                return '';
              }

              if (context.curClass && !Object.keys(context.curClass.children).find(e => e == seg.name)) {
                addDiagnostic(expr, context, 'error', `Undefined property ${seg.name} in class ${context.curClass.name}`);
                return '';
              }

              //Check if it's an action, move or ai
              let lastSeg = segments.at(-1);
              if(lastSeg.kind == 'property') {
                //@ts-ignore
                const pointer = context.currentActorLabels[lastSeg.name];

                if(pointer && !(pointer.type & ESymbolType.enum) && (pointer.type & ESymbolType.object)) {
                  if(direct)
                    return String(pointer.name);
                }
              }

              let pSym = (context.curClass
                ? context.curClass.children[seg.name]
                : context.symbolTable.get(seg.name)) as SymbolDefinition;

              if(pSym.global) {
                if (pSym.offset != 0)
                  code += `set ri ${pSym.offset}\n`;
                else 
                  code += `set ri 0\n`;
              } else if (pSym.offset != 0)
                code += `add ri ${pSym.offset}\n`;

              currSegIndex++;
              for (let i = currSegIndex; i < segments.length; i++) {
                const s = segments[i];

                if (pSym.type & ESymbolType.object || pSym.type & ESymbolType.array)
                  code += `set ri flat[ri]\n`;

                if (s.kind == 'index') {
                  if (!(pSym.type & ESymbolType.array)) {
                    addDiagnostic(expr, context, 'error', `Indexing a non-array property ${pSym.name}`);
                    return '';
                  }

                  const localVars = context.localVarCount;
                  //code += `state pushd\n`
                  if (assignment)
                    code += `state push\n`;
                  code += `state pushi\n`;
                  code += visitExpression(s.expr, context);
                  if (localVars != context.localVarCount) {
                    code += `sub rsp ${localVars - context.localVarCount - 1}\n`;
                    //code += `add rsp 1\n` //Account for the push rd we did back there
                    context.localVarCount = localVars;
                  }

                  code += `state popi\n`;

                  if (pSym.type == (ESymbolType.object | ESymbolType.array))
                    code += `mul ra ${pSym.size / pSym.num_elements}\nadd ri ra\nadd ri 1\n`
                  else
                    code += `add ri ra\nadd ri 1\n`;

                  if (pSym.type == (ESymbolType.string | ESymbolType.array))
                    context.curExpr = pSym.type;

                  if (assignment)
                    code += `state pop\n`;

                  continue;
                }

                if (s.name == 'length' && (pSym.type & ESymbolType.string || pSym.type & ESymbolType.array))
                  return code + (assignment ? `setarray flat[ri] ra\n` : `set ${reg} flat[ri]\n`);

                if (!Object.keys(pSym.children).find(e => e == s.name)) {
                  addDiagnostic(expr, context, 'error', `Undefined property ${s.name} in obj/class ${pSym.name} in ${expr.getText()}`);
                  return '';
                }

                pSym = pSym.children[s.name] as SymbolDefinition;

                if (pSym.offset != 0)
                  code += `add ri ${pSym.offset}\n`;
              }

              if(assignment && pSym.readonly) {
                addDiagnostic(expr, context, 'error', `Tried to assign to a read-only property ${pSym.name} in ${expr.getText()}`);
                return '';
              }

              if(direct)
                return String(pSym.literal);

              if(pSym.type & ESymbolType.constant)
                return `set ${reg} ${pSym.literal}\n`;

              if(pSym.type & ESymbolType.object || (pSym.type & ESymbolType.array && segments.at(-1).kind != 'index'))
                return code + `set ${reg} ri\n`;

              return code + (assignment ? `setarray flat[ri] ${reg}\n` : `set ${reg} flat[ri]\n`);
            }

            //code += `set ri THISACTOR\n`;

            let nativeVar: CON_NATIVE_VAR[];

            currSegIndex = obj.kind === 'this' ? 2 : 3;

            switch (obj.name) {
              case 'sprites':
                nativeVar = nativeVars_Sprites;
                op = 'a';
                break;

              case 'sectors':
                nativeVar = nativeVars_Sectors;
                op = 'sector';
                break;

              case 'walls':
                nativeVar = nativeVars_Walls;
                op = 'wall';
                break;

              case 'players':
                nativeVar = nativeVars_Players;
                op = 'p';
                break;

              default:
                addDiagnostic(expr, context, "error", `Object ${obj.name} does not exist: ${expr.getText()}`);
                return "set ra 0\n";
            }

            let nVar = nativeVar.find(e => e.name == seg.name);

            if (!nVar) {
              addDiagnostic(expr, context, "error", `Property ${seg.name} not found in ${obj.name}: ${expr.getText()}`);
              return "set ra 0\n";
            }

            let overriden = false;

            //if (assignment)
              //code += `state push\n`;

            let pushes = 0;
            let setRI = false;

            if (nVar.type == CON_NATIVE_FLAGS.OBJECT) {
              let v = nVar.object;

              for (let i = currSegIndex; i < segments.length; i++) {
                const s = segments[i];

                if (nVar.var_type == CON_NATIVE_TYPE.array) {
                  if (s.kind != 'index') {
                    addDiagnostic(expr, context, "error", `Missing index for ${seg.name}: ${expr.getText()}`);
                    return "set ra 0\n";
                  }

                  if(assignment) {
                    code += `state push\n`;
                    pushes++;
                  }

                  code += visitExpression(s.expr, context);
                  if (nVar.override_code) {
                    if(!setRI && obj.kind == 'this') {
                      if(obj.name == 'players')
                        code = 'getp[].index ri\n' + code;
                      else
                        code = 'set ri THISACTOR\n' + code;
                    }
                    setRI = true;
                    code += nVar.code[assignment ? 1 : 0];
                    overriden = true;
                  }

                  if (nVar.type == CON_NATIVE_FLAGS.OBJECT) {
                    const v = nVar.object.find(e => e.name == (segments[i + 1] as SegmentProperty).name);

                    if (!v) {
                      addDiagnostic(expr, context, "error", `Segment ${(segments[i + 1] as SegmentProperty).name} is not a property of ${seg.name}: ${expr.getText()}`);
                      return "set ra 0\n";
                    }

                    nVar = v;
                    i++;
                  }

                  if(nVar.type == CON_NATIVE_FLAGS.ARRAY) {
                    code += `set rsi ra\n`;
                    if(assignment)
                      code += `state pop\n`;

                    code += `${assignment ? 'set' : 'get'}${op}[${obj.kind === 'this' ? 'THISACTOR' : 'ri'}].`;
                    code += `${nVar.code} ${reg}\n`;
                  }

                  continue;
                }

                if (nVar.var_type == CON_NATIVE_TYPE.object) {
                  if (s.kind != 'property') {
                    addDiagnostic(expr, context, "error", `Segment after ${seg.name}: ${(s as SegmentIndex).expr.getText()} is not a property: ${expr.getText()}`);
                    return "set ra 0\n";
                  }

                  const v = nVar.object.find(e => e.name == s.name);

                  if (!v) {
                    addDiagnostic(expr, context, "error", `Segment ${s.name} is not a property of ${seg.name}: ${expr.getText()}`);
                    return "set ra 0\n";
                  }

                  if (nVar.override_code) {
                    if(!setRI && obj.kind == 'this') {
                      if(obj.name == 'players')
                        code = 'getp[].index ri\n' + code;
                      else
                        code = 'set ri THISACTOR\n' + code;
                    }
                    setRI = true;
                    code += nVar.code[assignment ? 1 : 0];
                    overriden = true;
                  }

                  if (v.var_type == CON_NATIVE_TYPE.native) {
                    for(let i = 0; i < pushes; i++)
                      code += `state pop\n`;
                    if (!overriden)
                      code += `${assignment ? 'set' : 'get'}${op}[${obj.kind === 'this' ? 'THISACTOR' : 'ri'}].`;

                    code += `${v.code} ${reg}\n`;
                  }

                  if (v.var_type == CON_NATIVE_TYPE.object || v.var_type == CON_NATIVE_TYPE.array)
                    nVar = v;
                }
              }
            } else if(nVar.type == CON_NATIVE_FLAGS.ARRAY) {
              let nextSeg = segments.at(-1);

              if (nextSeg.kind != 'index') {
                addDiagnostic(expr, context, "error", `Missing index for ${seg.name}: ${expr.getText()}`);
                return "set ra 0\n";
              }

              if(assignment)
                code += `state push\n`;

              code += visitExpression(nextSeg.expr, context);
              code += `set rsi ra\n`;

              if(assignment)
                code += `state pop\n`;

               code += `${assignment ? 'set' : 'get'}${op}[${obj.kind === 'this' ? 'THISACTOR' : 'ri'}].`;
               code += `${nVar.code} ${reg}\n`;
            } else if (nVar.type == CON_NATIVE_FLAGS.VARIABLE) {
              if (nVar.var_type == CON_NATIVE_TYPE.native) {
                if (!overriden)
                  code += `${assignment ? 'set' : 'get'}${op}[${obj.kind === 'this' ? 'THISACTOR' : 'ri'}].`;

                code += `${nVar.code} ${reg}\n`;
              } else code += `set ${assignment ? (nVar.code + ` ${reg}\n`)
                : (`${reg} ` + nVar.code + '\n')}`
            }
          }

          return code;
      }
    }

    addDiagnostic(expr, context, "warning", `Unhandled member expression: ${expr.getText()}`);
    code += `set ra 0\n`;
    return code;
  }