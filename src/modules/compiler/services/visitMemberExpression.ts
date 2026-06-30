import { Expression, SyntaxKind, StringLiteral } from "ts-morph";
import { CompilerContext, SegmentIdentifier, SegmentIndex, SegmentProperty, MemberSegment, SymbolDefinition, EnumDefinition, ESymbolType, EHeapType } from "../Compiler";
import { fnv1a32 } from "../helper/fnv1a32";
import { addDiagnostic } from "./addDiagnostic";
import { CON_NATIVE_VAR, CON_NATIVE_FLAGS, CON_NATIVE_TYPE, nativeVars_Players } from "../../../sets/TCSet100/native";
import { nativeVars_Sprites, nativeVars_Sectors, nativeVars_Walls } from "../../../sets/TCSet100/native";
import { nativeVars_Projectiles, nativeVars_TSprites, nativeVars_UserDef, nativeVars_Input, nativeVars_TileData, nativeVars_PalData } from "../../../sets/TCSet100/native";
import { unrollMemberExpression } from "./unrollMemberExpression";
import { visitExpression } from "./visitExpression";
import { FindLabel } from "./actorHelper";
import { formatLineDetail } from "../helper/formatLineDetail";

// Emit CON code to allocate a heap string for a literal key and store its pointer in r11.
// Called from the _rec_set assignment path. r11 is the key_str_ptr convention for _rec_set_raw.
function emitStringAlloc(s: string): string {
  let code = `set r0 ${s.length + 1}\nset r1 ${EHeapType.string}\nstate alloc\nsetarray flat[rb] ${s.length}\nset ri rb\n`;
  for (let i = 0; i < s.length; i++)
    code += `add ri 1\nsetarray flat[ri] ${s.charCodeAt(i)}\n`;
  return code + `set r11 rb\n`;
}

export function visitMemberExpression(expr: Expression, context: CompilerContext, assignment?: boolean, direct?: boolean, reg = 'ra'): string {
  let code = context.options.lineDetail ? formatLineDetail(expr.getText()) : '';
  const segments = unrollMemberExpression(expr);

  if (segments.length === 0) {
    addDiagnostic(expr, context, "warning", `No segments found for expression: ${expr.getText()}`);
    return `set ${reg} 0\n`;
  }

  // Handle the object
  const obj = segments[0] as SegmentIdentifier;
  let sym: SymbolDefinition | EnumDefinition | null = null;
  if (obj.kind == 'identifier' && ['sprites', 'sectors', 'walls', 'players', 'player', 'projectiles', 'tsprites', 'userdef', 'input', 'tiledata', 'paldata', 'EMoveFlags'].indexOf(obj.name) == -1) {
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
    // Check paramMap FIRST so a method parameter shadows a same-named class field.
    if (obj.name in context.paramMap) {
      sym = context.paramMap[obj.name];
      isParam = true;
    } else {
      sym = context.symbolTable.get(obj.name) as SymbolDefinition;
      if (!sym) {
        addDiagnostic(expr, context, "error", `Undefined object: ${expr.getText()}`);
        return "set ${reg} 0\n";
      }
    }

    if (sym.type & ESymbolType.string || sym.type & ESymbolType.array) {
      if ((segments[1].kind == 'property' && segments[1].name == 'length')) {
        // For params, ri is loaded directly from the argument register (value = array ptr).
        // For locals/fields, ri is a stack address that must be dereferenced first.
        const loadRi = isParam
          ? `set ri r${sym.offset}\n`
          : `set ri rbp\nadd ri ${sym.offset}\nset ri flat[ri]\n`;
        return code + loadRi + (assignment ? `setarray flat[ri] ${reg}\n` : `set ${reg} flat[ri]\n`);
      }
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
      // ─── Native Record<string, T> element access ──────────────────────────
      if (sym.type & ESymbolType.record) {
        // Load record heap pointer into r1
        let recLoad: string;
        if (sym.global)
          recLoad = context.options.mode === 'module'
            ? `set r1 flat[_G_ADDR_${sym.name}]\n`
            : `set r1 flat[${sym.offset}]\n`;
        else
          recLoad = `set ri rbp\nadd ri ${(sym as SymbolDefinition).offset}\nset r1 flat[ri]\n`;

        const idxSeg = segments[1];
        if (!idxSeg || idxSeg.kind !== 'index') {
          // Bare record variable reference — return the pointer
          code += recLoad.replace('r1', reg);
          context.curExpr = ESymbolType.record;
          return code;
        }

        const idxExpr = (idxSeg as SegmentIndex).expr;
        const isLitKey = idxExpr.isKind(SyntaxKind.StringLiteral);

        if (assignment) {
          // r["key"] = val  (ra holds the value to store)
          // Save value to r2 BEFORE alloc/hash — both can corrupt ra.
          code += `state pushr3\n`;
          code += `set r2 ra\n`; // r2 = value (captured before anything clobbers ra)
          if (isLitKey) {
            const keyText = (idxExpr as StringLiteral).getLiteralText();
            // Allocate a heap string for the literal key; stores ptr in r11.
            // emitStringAlloc clobbers r0/r1/ra — that's fine, we set them below.
            code += emitStringAlloc(keyText);
            code += `set r0 ${fnv1a32(keyText)}\n`;  // r0 = hash (set AFTER alloc)
          } else {
            code += visitExpression(idxExpr, context, 'r0');  // r0 = key string ptr
            code += `set r11 r0\n`;  // r11 = key_str_ptr (save before _rec_hash clobbers r0)
            code += `state pushr1\nstate _rec_hash\nstate popr1\nset r0 rb\n`;
            // r11 = key_str_ptr still valid (_rec_hash uses ra/rc/r1/ri, not r11)
          }
          code += recLoad;       // r1 = rec_ptr
          code += `state _rec_set\n`;
          code += `state popr3\n`;
        } else {
          // val = r["key1"]["key2"]...  — handle chained index segments
          code += `state pushr2\n`;
          if (isLitKey) {
            code += `set r0 ${fnv1a32((idxExpr as StringLiteral).getLiteralText())}\n`;
          } else {
            code += visitExpression(idxExpr, context, 'r0');
            code += `state pushr1\nstate _rec_hash\nstate popr1\nset r0 rb\n`;
          }
          code += recLoad;       // r1 = rec_ptr
          code += `state _rec_get\n`;
          // Chain any additional index segments: r["a"]["b"]["c"]...
          for (let si = 2; si < segments.length; si++) {
            const nextSeg = segments[si];
            if (nextSeg.kind !== 'index') break;
            const nextExpr = (nextSeg as SegmentIndex).expr;
            const isNextLit = nextExpr.isKind(SyntaxKind.StringLiteral);
            code += `set r1 rb\n`;  // r1 = nested Record ptr from previous _rec_get
            if (isNextLit) {
              code += `set r0 ${fnv1a32((nextExpr as StringLiteral).getLiteralText())}\n`;
            } else {
              code += visitExpression(nextExpr, context, 'r0');
              code += `state pushr1\nstate _rec_hash\nstate popr1\nset r0 rb\n`;
            }
            code += `state _rec_get\n`;
          }
          code += `state popr2\n`;
          code += `set ${reg} rb\n`;
          context.curExpr = (sym as SymbolDefinition).record_value_type ?? ESymbolType.number;
          context.curFpBits = (sym as SymbolDefinition).record_value_fpbits ?? 0;
        }
        return code;
      }
      // ──────────────────────────────────────────────────────────────────────

      if (sym.global) {
        if (context.options.mode === 'module')
          code += `set ri _G_ADDR_${sym.name}\n`;
        else if (sym.offset != 0)
          code += `set ri ${sym.offset}\n`;
        else
          code += `set ri 0\n`;
      } else {
        if (!isParam)
          code += `set ri rbp\nadd ri ${sym.offset}\n`;
        else
          code += `set ri r${sym.offset}\n`;
      }
      //code += `set ri flat[ri]\n`;

      for (let i = 1; i < segments.length; i++) {
        const seg = segments[i];

        // Dereference the slot pointer to reach the heap block.
        // - object/array/class local (non-param): stack slot holds a heap ptr → need flat[ri]
        // - object/array/class param: ri was set to r{offset} (already the heap ptr) → no extra dereference
        if ((sym.type & ESymbolType.object || sym.type & ESymbolType.array ||
            sym.type & ESymbolType.class) && !isParam)
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
          // Heap arrays store one flat[] slot per element (number or heap pointer).
          // Stride is always 1; the +1 skips the length header at flat[ptr+0].
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

          if (sym.global) {
            if (context.options.mode === 'module')
              code += `set ri _G_ADDR_${sym.name}\n`;
            else if (sym.offset != 0)
              code += `set ri ${sym.offset}\n`;
            else
              code += `set ri 0\n`;
          } else if (sym.offset != 0)
            code += `add ri ${sym.offset}\n`;

          continue;
        }
      }

      if (assignment && sym.readonly) {
        addDiagnostic(expr, context, 'error', `Tried to assign to a read-only property ${sym.name} in ${expr.getText()}`);
        return '';
      }

      if (assignment)
        code += `setarray flat[ri] ${reg}\n`;
      else
        code += `set ${reg} flat[ri]\n`;

      if (direct)
        return String(sym.literal);

      if (sym.type & ESymbolType.constant)
        code = `set ${reg} ${sym.literal}\n`;

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
        let singletonNoIndex = false;
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

          if (segments[1].kind != 'index') {
            if (obj.name === 'userdef' || obj.name === 'input' || obj.name === 'player') {
              singletonNoIndex = true;
              code += obj.name === 'userdef'
                ? `set ri 0\n`
                : obj.name === 'player'
                  ? `set ri THISACTOR\n`
                  : `set ri myconnectindex\n`;
            } else if (sym && !(sym as SymbolDefinition).native_pointer_index) {
              addDiagnostic(expr, context, "error", `Missing index for ${obj.name}: ${expr.getText()}`);
              return "set ra 0\n";
            }
          }
          if (segments[1].kind == 'index') {
            if (assignment)
              code += `state push\n`;
            code += visitExpression(segments[1].expr, context);
            code += `set ri ra\n`;
            if (assignment)
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

        let seg = segments[singletonNoIndex || obj.kind == 'this' || (sym && sym.native_pointer_index) ? 1 : 2] as SegmentProperty;
        let op = '';

        if (sym && sym.native_pointer) {
          obj.name = sym.native_pointer;

          if (sym.native_pointer_index)
            code += `set ri rbp\nadd ri ${sym.offset}\nset ri flat[ri]\n`;
        }

        // CActor/CPlayer custom (non-native) property: access via getactorvar[THISACTOR]._pCptr + flat[] offset.
        // This check fires before the curClass path so it doesn't interfere with native prop routing.
        if (obj.kind == 'this' && seg.kind == 'property' && context.actorCustomChildren?.[seg.name]) {
          let pSym = context.actorCustomChildren[seg.name] as SymbolDefinition;
          code += `set ri _pCptr\n`;
          if (pSym.offset != 0) code += `add ri ${pSym.offset}\n`;

          if (pSym.type & ESymbolType.object) {
            // Inline object: ri points to the start of the object data in the _pCptr block.
            // Walk remaining segments to add child offsets.
            for (let i = currSegIndex + 1; i < segments.length; i++) {
              const childSeg = segments[i] as SegmentProperty;
              if (childSeg.kind != 'property' || !pSym.children?.[childSeg.name]) break;
              const childSym = pSym.children[childSeg.name] as SymbolDefinition;
              if (childSym.offset != 0) code += `add ri ${childSym.offset}\n`;
              pSym = childSym;
            }
            return code + (assignment ? `setarray flat[ri] ${reg}\n` : `set ${reg} flat[ri]\n`);
          }

          if (pSym.type & ESymbolType.array || pSym.type == ESymbolType.string) {
            // The slot at _pCptr+offset holds a heap pointer to the array/string data.
            const nextSeg = segments[currSegIndex + 1];

            if (nextSeg) {
              // Need the actual pointer — dereference the slot: ri = pointer
              code += `set ri flat[ri]\n`;

              if (nextSeg.kind == 'index') {
                // this.arr[i] — index into the array past its length header
                if (assignment) code += `state push\n`;
                code += visitExpression(nextSeg.expr, context);
                code += `add ri ra\nadd ri 1\n`;
                if (assignment) code += `state pop\n`;
                return code + (assignment ? `setarray flat[ri] ${reg}\n` : `set ${reg} flat[ri]\n`);
              }
              if (nextSeg.kind == 'property' && nextSeg.name === 'length') {
                // this.arr.length — flat[pointer] = element count
                return code + `set ${reg} flat[ri]\n`;
              }
              // Fallback for other member accesses on the pointer value
              return code + (assignment ? `setarray flat[ri] ${reg}\n` : `set ${reg} flat[ri]\n`);
            }

            // No further segments: READ returns the pointer; WRITE stores into the slot.
            // (No extra dereference — the slot IS the pointer cell.)
            if (!assignment) {
              // Tell the enclosing expression that the result is a string/array pointer,
              // not a plain integer — prevents _convertInt2String from being called on it.
              context.curExpr = pSym.type & ESymbolType.array
                ? ESymbolType.array
                : ESymbolType.string;
            }
            return code + (assignment ? `setarray flat[ri] ${reg}\n` : `set ${reg} flat[ri]\n`);
          }

          // Scalar property (number, boolean): ri points directly to the value slot.
          return code + (assignment ? `setarray flat[ri] ${reg}\n` : `set ${reg} flat[ri]\n`);
        }

        if (seg.kind == 'property') {
          // this.argument inside a CEvent body → the EDuke32 RETURN gamevar
          if (obj.kind == 'this' && seg.name == 'argument' && context.currentEventName && !context.curClass)
            return code + (assignment ? `set RETURN ${reg}\n` : `set ${reg} RETURN\n`);

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
            if (lastSeg.kind == 'property') {
              let segments2 = [...segments];
              if (['loc', 'start', 'length', 'viewType', 'incValue', 'delay', 'horizontal_vel', 'vertical_vel', 'action', 'move', 'flags'].includes(lastSeg.name))
                segments2.pop();

              const pointer = FindLabel(segments2, context);

              if (pointer && !(pointer.type & ESymbolType.enum) && (pointer.type & ESymbolType.object)) {
                if (direct)
                  return String(pointer.name);
              }
            }

            let pSym = (context.curClass
              ? context.curClass.children[seg.name]
              : context.symbolTable.get(seg.name)) as SymbolDefinition;

            if (pSym.global) {
              if (context.options.mode === 'module')
                code += `set ri _G_ADDR_${pSym.name}\n`;
              else if (pSym.offset != 0)
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

            if (assignment && pSym.readonly) {
              addDiagnostic(expr, context, 'error', `Tried to assign to a read-only property ${pSym.name} in ${expr.getText()}`);
              return '';
            }

            if (direct)
              return String(pSym.literal);

            if (pSym.type & ESymbolType.constant)
              return `set ${reg} ${pSym.literal}\n`;

            return code + (assignment ? `setarray flat[ri] ${reg}\n` : `set ${reg} flat[ri]\n`);
          }

          //code += `set ri THISACTOR\n`;

          let nativeVar: CON_NATIVE_VAR[];

          currSegIndex = singletonNoIndex || obj.kind === 'this' ? 2 : 3;

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
            case 'player':
              nativeVar = nativeVars_Players;
              op = 'p';
              break;

            case 'projectiles':
              nativeVar = nativeVars_Projectiles;
              op = 'projectile';
              break;

            case 'tsprites':
              nativeVar = nativeVars_TSprites;
              op = 'tspr';
              break;

            case 'userdef':
              nativeVar = nativeVars_UserDef;
              op = 'userdef';
              break;

            case 'input':
              nativeVar = nativeVars_Input;
              op = 'input';
              break;

            case 'tiledata':
              nativeVar = nativeVars_TileData;
              op = 'tiledata';
              break;

            case 'paldata':
              nativeVar = nativeVars_PalData;
              op = 'paldata';
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

                if (assignment) {
                  code += `state push\n`;
                  pushes++;
                }

                code += visitExpression(s.expr, context);
                if (nVar.override_code) {
                  if (!setRI && obj.kind == 'this') {
                    if (obj.name == 'players')
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

                if (nVar.type == CON_NATIVE_FLAGS.ARRAY) {
                  code += `set rsi ra\n`;
                  if (assignment)
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
                  if (!setRI && obj.kind == 'this') {
                    if (obj.name == 'players')
                      code = 'getp[].index ri\n' + code;
                    else
                      code = 'set ri THISACTOR\n' + code;
                  }
                  setRI = true;
                  code += nVar.code[assignment ? 1 : 0];
                  overriden = true;
                }

                if (v.var_type == CON_NATIVE_TYPE.native) {
                  for (let i = 0; i < pushes; i++)
                    code += `state pop\n`;
                  if (!overriden)
                    code += `${assignment ? 'set' : 'get'}${op}[${obj.kind === 'this' ? 'THISACTOR' : 'ri'}].`;

                  code += `${v.code} ${reg}\n`;
                }

                if (v.var_type == CON_NATIVE_TYPE.object || v.var_type == CON_NATIVE_TYPE.array)
                  nVar = v;
              }
            }
          } else if (nVar.type == CON_NATIVE_FLAGS.ARRAY) {
            let nextSeg = segments.at(-1);

            if (nextSeg.kind != 'index') {
              addDiagnostic(expr, context, "error", `Missing index for ${seg.name}: ${expr.getText()}`);
              return "set ra 0\n";
            }

            if (assignment)
              code += `state push\n`;

            code += visitExpression(nextSeg.expr, context);
            code += `set rsi ra\n`;

            if (assignment)
              code += `state pop\n`;

            code += `${assignment ? 'set' : 'get'}${op}[${obj.kind === 'this' ? 'THISACTOR' : 'ri'}].`;
            code += `${nVar.code} ${reg}\n`;
          } else if (nVar.type == CON_NATIVE_FLAGS.VARIABLE) {
            if (nVar.override_code) {
              code += (nVar.code as unknown as string[])[assignment ? 1 : 0];
            } else if (nVar.var_type == CON_NATIVE_TYPE.native) {
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