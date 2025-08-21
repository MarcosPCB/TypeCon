import { PropertyDeclaration, ObjectLiteralExpression, SyntaxKind, CallExpression } from "ts-morph";
import { CompilerContext, SymbolDefinition, ESymbolType, SegmentProperty } from "../Compiler";
import { addDiagnostic } from "./addDiagnostic";
import { evaluateLiteralExpression } from "../helper/helpers";
import { unrollMemberExpression } from "./unrollMemberExpression";

/* ------------------------------------------------------------------
 * 1.  Top-level router that recognises both the old and new shapes
 * ------------------------------------------------------------------ */
export function parseVarForActionsMovesAi(
    decl: PropertyDeclaration,
    ctx: CompilerContext,
    className: string
  ) {
    const typeNode = decl.getTypeNode();
    if (!typeNode) return;

    /* ── 1. figure out declared type and “arrayness” ─────────────── */
    let typeTxt = typeNode.getText().trim();
    let isArray = false;

    if (typeTxt.endsWith("[]")) {
      isArray = true;
      typeTxt = typeTxt.slice(0, -2).trim();              //  Foo[]      → Foo
    } else {
      const m = /^Array<\s*(.+?)\s*>$/.exec(typeTxt);
      if (m) {
        isArray = true;
        typeTxt = m[1].trim();                            // Array<Foo>  → Foo
      }
    }

    /* 🔥 2️⃣  NEW RULE: arrays are no longer accepted --------------- */
  if (isArray) {
    addDiagnostic(decl, ctx, 'error', `Array type for Action/Move/AI is not supported`);
    return;
  }

    // strip generic parameters so we end up with IAction / TAction …
    const baseType = typeTxt.slice(0, typeTxt.indexOf('<'));         // TAction<'a'> → TAction

    /* ── 2. grab initializer ─────────────────────────────────────── */
    const init = decl.getInitializer();
    if (!init) return;

    let sym: SymbolDefinition;

    /* helper that forwards to the correct low-level parser */
    const handleObj = (obj: ObjectLiteralExpression, propName?: string) => {
      let s: SymbolDefinition;
      switch (baseType) {
        case "IAction":
        case "TAction":
          s = parseIActionLiteral(obj, ctx, propName, className);
          break;

        case "IMove":
        case "TMove":
          s = parseIMoveLiteral(obj, ctx, propName, className);
          break;

        case "IAi":
        case "TAi":
          s = parseIAiLiteral(obj, ctx, propName, className);
          break;
      }

      return s;
    };

    /* ── 3. OLD SHAPES ───────────────────────────────────────────── */
    // 3 a) single object → IAction / IMove / IAi
    if (!isArray && !/^[T][A-Z]/.test(baseType)) {        // not TAction / …
      if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const sym = handleObj(init as ObjectLiteralExpression, decl.getName());
        sym.global = true;
        ctx.symbolTable.set(decl.getName(), sym);
        ctx.currentActorLabels[decl.getName()] = sym;
        sym.offset = ctx.globalVarCount;
        let code = `set ri ${ctx.globalVarCount + 1}\nsetarray flat[${ctx.globalVarCount}] ri\nsetarray flat[ri] 0\n`;
        ctx.globalVarCount += 2;
        Object.entries(sym.children).forEach((e, i) => {
          if(!i)
            return;
          e[1] = e[1] as SymbolDefinition;
          if(ctx.currentActorLabelAsObj)
            code += `add ri 1\nsetarray flat[ri] ${e[1].literal}\n`
          ctx.globalVarCount++;
        });

        ctx.initCode += code;
      }
      return;
    }

    /* ── 4. NEW SHAPE  (dictionary) ─────────────────────────────── */
    // top-level object whose *properties* are the actions / moves / ais
    if (!init.isKind(SyntaxKind.ObjectLiteralExpression)) return;

    ctx.symbolTable.set(decl.getName(), {
      name: decl.getName(),
      offset: ctx.globalVarCount,
      global: true,
      readonly: true,
      type: ESymbolType.object,
      children: {}
    });

    let code = `set ri ${ctx.globalVarCount + 1}\nsetarray flat[${ctx.globalVarCount}] ri\n`;
    ctx.globalVarCount++;

    const obj = ctx.symbolTable.get(decl.getName()) as SymbolDefinition;
    obj.num_elements = obj.size = 0;
    let code2 = '';

    let gv = ctx.globalVarCount;
    
    (init as ObjectLiteralExpression).getProperties().forEach((prop, i, a) => {
      if (!prop.isKind(SyntaxKind.PropertyAssignment)) return;

      const propName = prop.getName().replace(/[`'"]/g, ""); // walk / run / …
      const value = prop.getInitializer();
      if (value && value.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const sym = handleObj(value as ObjectLiteralExpression, propName);
        ctx.currentActorLabels[propName] = sym;
        obj.children[propName] = sym;
        obj.num_elements++;
        obj.size += sym.size;
        sym.offset = i;
        sym.parent = obj;
        code += `set ri ${ctx.globalVarCount + a.length + i}\nsetarray flat[${gv}] ri\n`;
        code2 += `set ri ${ctx.globalVarCount + a.length + i}\nsetarray flat[ri] 0\n`;
        ctx.globalVarCount++;
        gv++;
        Object.entries(sym.children).forEach((e, i) => {
          if(!i)
            return;
          e[1] = e[1] as SymbolDefinition;
          if(ctx.currentActorLabelAsObj || sym.name.startsWith('AI_'))
            code2 += `add ri 1\nsetarray flat[ri] ${sym.name.startsWith('AI_') ? '0' : e[1].literal}\n`
          ctx.globalVarCount++;
        });
      }
    });

    code += code2;
    ctx.globalVarCount += (init as ObjectLiteralExpression).getProperties().length * 2;
    ctx.initCode += code;
  }

  /* ------------------------------------------------------------------
   * 2.  Low-level helpers – accept an *optional* fallback name
   * ------------------------------------------------------------------ */
  export function parseIActionLiteral(
    obj: ObjectLiteralExpression,
    ctx: CompilerContext,
    fallbackName = "",
    className: string,
  ): SymbolDefinition {
    let start = 0, length = 0, viewType = 0, inc = 0, delay = 0;

    obj.getProperties().forEach(p => {
      if (!p.isKind(SyntaxKind.PropertyAssignment)) return;
      const key = p.getName();
      const val = p.getInitializerOrThrow().getText();
      switch (key) {
        case "start": start = +val; break;
        case "length": length = +val; break;
        case "viewType": viewType = +val; break;
        case "incValue": inc = +val; break;
        case "delay": delay = +val; break;
      }
    });

    ctx.currentActorActions.push(
      `action A_${className}_${fallbackName} ${start} ${length} ${viewType} ${inc} ${delay}`);

    return {
      name: `A_${className}_${fallbackName}`,
      offset: 0,
      type: ESymbolType.object,
      num_elements: 6,
      size: 6,
      readonly: true,
      children: {
        loc: { name: 'loc', type: ESymbolType.number, offset: 0, literal: `A_${className}_${fallbackName}` },
        start: { name: 'start', type: ESymbolType.number, offset: 1, literal: start },
        length: { name: 'length', type: ESymbolType.number, offset: 2, literal: length },
        viewType: { name: 'viewType', type: ESymbolType.number, offset: 3, literal: viewType },
        incValue: { name: 'incValue', type: ESymbolType.number, offset: 4, literal: inc },
        delay: { name: 'delay', type: ESymbolType.number, offset: 5, literal: delay },
      }
    };
  }

  export function parseIMoveLiteral(
    obj: ObjectLiteralExpression,
    ctx: CompilerContext,
    fallbackName = "",                                // 🔑 NEW
    className: string,
  ): SymbolDefinition {
    let hv = 0, vv = 0;

    obj.getProperties().forEach(p => {
      if (!p.isKind(SyntaxKind.PropertyAssignment)) return;
      const key = p.getName();
      const val = +p.getInitializerOrThrow().getText();
      switch (key) {
        case "horizontal_vel": hv = val; break;
        case "vertical_vel": vv = val; break;
      }
    });

    ctx.currentActorMoves.push(`move M_${className}_${fallbackName} ${hv} ${vv}`);

    return {
      name: `M_${className}_${fallbackName}`,
      offset: 0,
      type: ESymbolType.object,
      num_elements: 3,
      size: 3,
      readonly: true,
      children: {
        loc: { name: 'loc', type: ESymbolType.number, offset: 0, literal: `M_${className}_${fallbackName}` },
        horizontal_vel: { name: 'horizontal_vel', type: ESymbolType.number, offset: 1, literal: hv },
        vertical_vel: { name: 'vertical_vel', type: ESymbolType.number, offset: 2, literal: vv },
      }
    };
  }

  export function parseIAiLiteral(
    obj: ObjectLiteralExpression,
    ctx: CompilerContext,
    fallbackName = "",                                // 🔑 NEW
    className: string,
  ): SymbolDefinition {
    let action: SymbolDefinition, move: SymbolDefinition; let flags = 0;

    obj.getProperties().forEach(p => {
      if (!p.isKind(SyntaxKind.PropertyAssignment)) return;
      const key = p.getName();
      const valNode = p.getInitializerOrThrow();
      const segments = unrollMemberExpression(valNode);
      const seg: SegmentProperty = segments[segments.length - 1] as SegmentProperty;
      switch (key) {
        case "action": action = ctx.currentActorLabels[seg.name]; break;
        case "move": move = ctx.currentActorLabels[seg.name]; break;
        case "flags": flags = Number(evaluateLiteralExpression(valNode)); break;
      }
    });

    ctx.currentActorAis.push(`ai AI_${className}_${fallbackName} ${action.name} ${move.name} ${flags}`);

    return {
      name: `AI_${className}_${fallbackName}`,
      offset: 0,
      type: ESymbolType.object,
      num_elements: 4,
      size: 4,
      readonly: true,
      children: {
        loc: { name: 'loc', type: ESymbolType.number | ESymbolType.pointer, offset: 0, literal: `AI_${className}_${fallbackName}` },
        action: action,
        move: move,
        flags: { name: 'flags', type: ESymbolType.number, offset: 3, literal: flags },
      }
    };
  }


  export function parseActorSuperCall(call: CallExpression, context: CompilerContext) {
    // super(picnum, isEnemy, extra, actions, firstAction, moves, ais)
    const args = call.getArguments();
    if (args.length >= 1) {
      const a0 = args[0];
      if (a0.isKind(SyntaxKind.NumericLiteral)) {
        context.currentActorPicnum = parseInt(a0.getText(), 10);
      }
    }
    if (args.length >= 2) {
      const a1 = args[1];
      if (a1.isKind(SyntaxKind.TrueKeyword)) {
        context.currentActorIsEnemy = true;
      } else if (a1.isKind(SyntaxKind.FalseKeyword)) {
        context.currentActorIsEnemy = false;
      }
    }
    if (args.length >= 3) {
      const a2 = args[2];
      if (a2.isKind(SyntaxKind.NumericLiteral)) {
        context.currentActorExtra = parseInt(a2.getText(), 10);
      }
    }
    if (args.length >= 4) {
      // label as objects in memory
      const fa = args[3];

      if (fa && (fa.getText() != 'undefined' && fa.getText() != 'null'))
        context.currentActorLabelAsObj = fa.getText() == 'true' ? true : false;
    }

    if (args.length >= 5) {
      // label as objects in memory
      const fa = args[4];

      if (fa && (fa.getText() != 'undefined' && fa.getText() != 'null'))
        context.currentActorHardcoded = fa.getText() == 'true' ? true : false;
    }
  }