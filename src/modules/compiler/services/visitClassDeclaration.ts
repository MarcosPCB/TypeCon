import { ClassDeclaration, SyntaxKind, Statement, Block, ObjectLiteralExpression } from "ts-morph";
import { CompilerContext, SymbolDefinition, ESymbolType, EHeapType } from "../Compiler";
import { evaluateLiteralExpression } from "../helper/helpers";
import { indent } from "../helper/indent";
import { addDiagnostic } from "./addDiagnostic";
import { EventList, TEvents } from "../types";
import { visitConstructorDeclaration } from "./visitConstructorDeclaration";
import { parseVarForActionsMovesAi } from "./actorHelper";
import { visitStatement } from "./visitStatement";
import { getObjectTypeLayout } from "./getObjectLayout";
import { getObjectSize } from "./getObjectSize";
import { visitMethodDeclaration } from "./visitMethodDeclaration";
import { visitMemberExpression } from "./visitMemberExpression";
import { visitLeafOrLiteral } from "./visitLeafOrLiteral";
import { formatLineDetail } from "../helper/formatLineDetail";

/******************************************************************************
   * VISIT CLASS DECL => if extends CActor => parse constructor => skip code => gather actions
   ****************************************************************************/
export function visitClassDeclaration(cd: ClassDeclaration, context: CompilerContext): string {
  const className = cd.getName() || "AnonClass";
  let code = context.options.lineDetail ? `// class ${className}\n` : '';

  const base = cd.getExtends()?.getExpression().getText() || "";
  let type = base;
  // const isEvent = base === "CEvent"; // demonstration if needed

  // We'll create a local context for parsing this class
  const localCtx: CompilerContext = {
    ...context,
    localVarOffset: {},
    localVarCount: 0,
    initCode: '',
    paramMap: {},
    currentActorPicnum: undefined,
    currentActorExtra: undefined,
    currentActorIsEnemy: undefined,
    currentActorFirstAction: undefined,
    currentActorHardcoded: false,
    currentActorLabelAsObj: true,
    currentActorActions: [],
    currentActorMoves: [],
    currentActorAis: [],
    currentActorLabels: {},
    isPlayer: undefined,
    mainBFunc: false,
    curFunc: undefined,
  };

  if (type === 'CInput') {
    type = 'CEvent';
    localCtx.currentEventName = 'PROCESSINPUT';
  }

  let cls: SymbolDefinition;

  if (type == '') {
    cls = context.symbolTable.get(className) as SymbolDefinition;
    if (cls) {
      addDiagnostic(cd, context, 'error', `Duplicate definition. Tried to declare a class named ${className} when there's already a ${cls.type} with the same name`);
      return '';
    }

    context.symbolTable.set(className, {
      name: className,
      type: ESymbolType.class,
      offset: 0,
      num_elements: 0,
      size: 0,
      heap: true,
      children: {}
    });

    cls = context.symbolTable.get(className) as SymbolDefinition;
  }

  const ctors = cd.getConstructors();
  // For CEvent/CInput: run the constructor immediately — it sets currentEventName
  // which is needed for the appendevent code generated further below.
  // For CActor/CPlayer: deferred to AFTER property collection (see further below)
  // so actorCustomChildren is populated before the constructor body is compiled.
  // For plain classes (type == ''): handled in the defstate constructor section below.
  if (ctors.length > 0 && (type === 'CEvent' || type === 'CInput')) {
    code += visitConstructorDeclaration(ctors[0], localCtx, type);
  }

  if (type == 'CPlayer') {
    localCtx.isPlayer = true;

    localCtx.symbolTable.set('defaultPicnum', {
      name: 'defaultPicnum',
      offset: 0,
      type: ESymbolType.constant,
      literal: localCtx.currentActorPicnum
    });
  }

  if (type == 'CActor') {
    localCtx.symbolTable.set('defaultPicnum', {
      name: 'defaultPicnum',
      offset: 0,
      type: ESymbolType.constant,
      literal: localCtx.currentActorPicnum
    });

    localCtx.symbolTable.set('defaultStrength', {
      name: 'defaultStrength',
      offset: 0,
      type: ESymbolType.constant,
      literal: localCtx.currentActorExtra
    });
  }

  // visit properties
  const properties = cd.getProperties();
  let codeV = '';
  let hasLabels = false;

  for (const p of properties) {
    if (p.getTypeNode().getText().match(/\b(TAction|IAction|TMove|IMove|TAi|IAi)\b/)) {
      if (!hasLabels) {
        let globalOffsetStr: string | number = `_G_ADDR_lb${localCtx.currentActorPicnum}_enabler`;

        localCtx.initCode = `setarray flat[${globalOffsetStr}] 0\n`
        localCtx.globalVarCount++;
        localCtx.symbolTable.set(`lb${localCtx.currentActorPicnum}_enabler`, {
          name: `lb${localCtx.currentActorPicnum}_enabler`,
          offset: localCtx.globalVarCount - 1,
          global: true,
          type: ESymbolType.boolean
        });

        context.globalAllocations.push({
          name: `lb${localCtx.currentActorPicnum}_enabler`,
          size: 1
        });

        hasLabels = true;
      }

      parseVarForActionsMovesAi(p, localCtx, className);
    }

    if (p.getTypeNode().getText() == 'OnEvent') {
      const init = p.getInitializerOrThrow();

      if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const events = init.getProperties();

        for (const e of events) {
          if (!e.isKind(SyntaxKind.MethodDeclaration)) {
            addDiagnostic(e, context, 'error', `OnEvent property must only contain functions: ${p.getText()}`);
            return '';
          }

          const eFnName = e.getName();

          if (!EventList.includes(eFnName as TEvents)) {
            addDiagnostic(e, context, 'error', `Invalid event ${e.getName()}: ${p.getText()}`);
            return '';
          }

          const evntLocalCtx: CompilerContext = {
            ...localCtx,
            localVarOffset: {},
            localVarCount: 0,
            paramMap: {}
          };

          code += `${context.options.lineDetail ? formatLineDetail(e.getText(), '\n') : ''}\nonevent EVENT_${eFnName.toUpperCase()}\nset ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n  ifactor ${localCtx.currentActorPicnum} {\n`;
          const body = e.getBody() as any;
          if (body) {
            const stmts = body.getStatements() as Statement[];

            stmts.forEach(s => {
              code += visitStatement(s, evntLocalCtx);
            });
          }

          code += `  }\n  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nendevent \n\n`;
        }
      }
    } else if (type == '') {
      const pName = p.getName();
      const pType = p.getTypeNode().getText();

      cls.children[pName] = { name: pName, offset: cls.num_elements, type: ESymbolType.number };

      switch (pType) {
        case 'string':
        case 'number':
        case 'pointer':
        case 'boolean':
          cls.children[pName].type = ESymbolType[pType];
          break;

        case 'string[]':
          cls.children[pName].type = ESymbolType.string | ESymbolType.array;
          break;

        case 'number[]':
        case '[]':
          cls.children[pName].type = ESymbolType.array;
          break;

        default:
          let t = pType;
          let isArray = false;
          if (t.endsWith('[]')) {
            t = pType.slice(0, t.length - 2);
            isArray = true;
          }

          const type = context.typeAliases.get(t);

          if (!type) {
            addDiagnostic(p, context, 'error', `Undeclared type ${pType}`);
            return '';
          }

          if (type.literal) {
            if (type.literal == 'string' && isArray)
              cls.children[pName].type = ESymbolType.string | ESymbolType.array;
            else if (isArray)
              cls.children[pName].type = ESymbolType.array;
            else cls.children[pName].type = type.literal as any;
          } else {
            cls.children[pName].type = ESymbolType.object | (isArray ? ESymbolType.array : 0);
            cls.children[pName].children = getObjectTypeLayout(t, context);
            cls.children[pName].size = getObjectSize(t, context);
            cls.children[pName].num_elements = Object.keys(cls.children[pName].children).length;
          }
      }
      cls.num_elements++;
    } else if ((type == 'CActor' || type == 'CPlayer') && p.getTypeNode()) {
      // Custom (non-native, non-special) CActor/CPlayer property → heap-allocated via _pCptr.
      // Skip properties whose type alias starts with 'CON_' (they are native struct fields).
      const aliasName = p.getType().getAliasSymbol()?.getName() ?? '';
      const typeText = p.getTypeNode().getText();
      const isNative = aliasName.startsWith('CON_') || typeText.startsWith('CON_');
      const isSpecial = typeText.match(/\b(TAction|IAction|TMove|IMove|TAi|IAi|OnEvent|OnVariation)\b/);
      if (!isNative && !isSpecial && !p.isStatic()) {
        if (!localCtx.actorCustomChildren) {
          localCtx.actorCustomChildren = {};
        }
        const pName = p.getName();
        let pTypeRaw = typeText;
        let isArray = false;

        // Detect array suffix
        if (pTypeRaw.endsWith('[]')) {
          isArray = true;
          pTypeRaw = pTypeRaw.slice(0, -2);
        }

        // Calculate the current byte offset from the running count of allocated slots
        const offset = Object.values(localCtx.actorCustomChildren).reduce(
          (sum, s: SymbolDefinition) => sum + (s.size ?? 1), 0
        );

        if (isArray || pTypeRaw === 'string') {
          // Arrays and strings are heap pointers stored in one slot of the _pCptr block.
          // The actual allocation happens in EVENT_SPAWN.
          const symType = isArray
            ? ESymbolType.array | (pTypeRaw === 'string' ? ESymbolType.string : ESymbolType.number)
            : ESymbolType.string;
          localCtx.actorCustomChildren[pName] = {
            name: pName,
            type: symType,
            offset,
            size: 1,
            heap: true,
            parentClass: className,
          };
        } else if (context.typeAliases.get(pTypeRaw)) {
          // Known struct/interface type: store INLINE in the _pCptr block.
          const layout = getObjectTypeLayout(pTypeRaw, context);
          const objSize = getObjectSize(pTypeRaw, context);
          localCtx.actorCustomChildren[pName] = {
            name: pName,
            type: ESymbolType.object,
            offset,
            size: objSize,
            children: layout,
            heap: true,
            parentClass: className,
          };
        } else {
          // Simple scalar (number, boolean, or unrecognised → treat as number)
          let symType = ESymbolType.number;
          if (pTypeRaw === 'boolean') symType = ESymbolType.boolean;
          localCtx.actorCustomChildren[pName] = {
            name: pName,
            type: symType,
            offset,
            size: 1,
            heap: true,
            parentClass: className,
          };
        }
      }
    }
  }

  // Now that actorCustomChildren is populated, compile the CActor/CPlayer constructor body.
  // Non-super statements are compiled into localCtx.actorCustomInitCode and emitted
  // inside EVENT_SPAWN after the _pCptr allocation.
  if (ctors.length > 0 && (type === 'CActor' || type === 'CPlayer')) {
    visitConstructorDeclaration(ctors[0], localCtx, type);
  }

  let labels = '';

  // if CActor => append the actions/moves/ais lines
  if (type == 'CActor') {
    for (const a of localCtx.currentActorActions) {
      labels += a + "\n";
    }
    for (const mv of localCtx.currentActorMoves) {
      labels += mv + "\n";
    }
    for (const ai of localCtx.currentActorAis) {
      labels += ai + "\n";
    }
  }

  if (type == '') {
    context.curClass = cls;
    // Pre-register all method names before the constructor is compiled so that
    // forward references (calling a method defined later in the file) resolve correctly.
    const methodsForPreReg = cd.getInstanceMethods();
    for (const m of methodsForPreReg) {
      const mName = m.getName();
      const retText = m.getReturnTypeNode()?.getText();
      const retClassSym = retText ? context.symbolTable.get(retText) as SymbolDefinition : undefined;
      const retIsClass = retClassSym && (retClassSym.type & ESymbolType.class);
      context.symbolTable.set(mName, {
        name: `${className}_${mName}`,
        type: ESymbolType.function,
        offset: 0,
        parentClass: className,
        returns: retIsClass ? ESymbolType.class : (retText && retText !== 'void' ? ESymbolType.number : undefined),
      });
      cls.children[mName] = context.symbolTable.get(mName) as SymbolDefinition;
    }
  }

  if (ctors.length > 0 && type == '') {
    code = `${context.options.lineDetail ? formatLineDetail(ctors[0].getText()) : ''}\ndefstate ${className}_constructor \n  set ra rbp \n  state push \n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;
    code += indent(`state pushr2\nset r0 ${cls.num_elements}\nset r1 ${EHeapType.object}\nstate alloc\nstate popr2\nsetarray flat[rbp] rb\nadd rsp 1\n`, 1);
    code += visitConstructorDeclaration(ctors[0], context, '');
    code += `  set rb flat[rbp]\n  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\nends \n\n`;
  }

  // visit methods
  const methods = cd.getInstanceMethods();
  for (const m of methods)
    code += visitMethodDeclaration(m, className, type != '' ? localCtx : context, type);

  for (const p of properties) {
    if (p.getTypeNode().getText().includes('OnVariation')) {
      const init = p.getInitializerOrThrow();

      if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const events = init.getProperties();

        for (const e of events) {
          if (!e.isKind(SyntaxKind.MethodDeclaration)) {
            addDiagnostic(e, context, 'error', `OnVariation property must only contain functions: ${p.getText()}`);
            return '';
          }

          const eFnName = e.getName();

          const variationLocalCtx: CompilerContext = {
            ...localCtx,
            localVarOffset: {},
            localVarCount: 0,
            paramMap: {}
          };


          const body = e.getBody() as Block;
          if (body) {
            const stmts = body.getStatements() as Statement[];

            const cactor = body.getDescendantsOfKind(SyntaxKind.ReturnStatement)

            if (cactor.length == 0) {
              addDiagnostic(init, localCtx, 'error', `Missing return statement on actor variation: ${eFnName}`);
              return '';
            }

            const exp = cactor[0].getExpression();
            if (!exp.isKind(SyntaxKind.ObjectLiteralExpression)) {
              addDiagnostic(init, localCtx, 'error', `Return statement is not a object literal: ${exp.getText()}`);
              return '';
            }

            const obj: ObjectLiteralExpression = exp as ObjectLiteralExpression;

            let picnum = -1, extra = 0, action = '';

            obj.getProperties().forEach(e => {
              if (e.isKind(SyntaxKind.PropertyAssignment)) {
                let val: string | number;
                const init = e.getInitializer();

                if (init.isKind(SyntaxKind.ElementAccessExpression) || init.isKind(SyntaxKind.PropertyAccessExpression))
                  val = visitMemberExpression(init, localCtx, false, true);

                if (init.isKind(SyntaxKind.Identifier))
                  val = visitLeafOrLiteral(init, localCtx, true);

                switch (e.getName()) {
                  case 'picnum':
                    picnum = Number(val);
                    break;

                  case 'extra':
                    extra = Number(val);
                    break;

                  case 'first_action':
                    action = String(val);
                    break;
                }
              }
            });

            codeV += `${context.options.lineDetail ? formatLineDetail(e.getText(), '\n') : ''}\n${localCtx.currentActorHardcoded ? 'actor' : `useractor ${localCtx.currentActorIsEnemy ? 1 : 0}`} ${picnum} ${extra} ${action}\n  set ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;

            stmts.forEach(s => {
              if (!s.isKind(SyntaxKind.ReturnStatement))
                codeV += indent(visitStatement(s, variationLocalCtx), 1);
            });
          }

          codeV += `  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nenda \n\n`;
        }
      }
    }
  }

  code += codeV;

  context.curClass = null;

  let prefix = labels + '\n';

  if (localCtx.initCode != '') {
    const enablerSym = localCtx.symbolTable.get(`lb${localCtx.currentActorPicnum}_enabler`) as SymbolDefinition;
    const enablerOffset = context.options.mode === 'module'
      ? `_G_ADDR_lb${localCtx.currentActorPicnum}_enabler`
      : enablerSym.offset;

    prefix += `
appendevent EVENT_NEWGAME
${indent(localCtx.initCode, 1)}
  add ri 1
  set rbp ri
  set rsp rbp
  sub rsp 1
endevent

appendevent EVENT_SPAWN
  ifactor ${localCtx.currentActorPicnum} {
    ife flat[${enablerOffset}] 0 {
      setarray flat[${enablerOffset}] 1
      geta[].htg_t 4 ra
      geta[].htg_t 1 rb
      geta[].htg_t 5 rc
      geta[].hitag rd

${Object.values(localCtx.currentActorLabels).map(e => {
      if (e.name.startsWith('A_'))
        return `
      set ri flat[${e.parent ? `__RELOC_GLOBAL_${e.parent.name}__` : e.offset}]
      ${e.parent && e.offset != 0 ? `add ri ${e.offset}` : ''}
      action ${e.name}
      setarray flat[flat[ri]] sprite[].htg_t 4`;

      if (e.name.startsWith('M_'))
        return `
      set ri flat[${e.parent ? `__RELOC_GLOBAL_${e.parent.name}__` : e.offset}]
      ${e.parent && e.offset != 0 ? `add ri ${e.offset}` : ''}
      move ${e.name} 0
      setarray flat[flat[ri]] sprite[].htg_t 1`;

      return `
      set ri flat[${e.parent ? `__RELOC_GLOBAL_${e.parent.name}__` : e.offset}]
      ${e.parent && e.offset != 0 ? `add ri ${e.offset}` : ''}
      ai ${e.name}
      set ri flat[ri]
      setarray flat[ri] sprite[].htg_t 5
      add ri 1
      setarray flat[ri] sprite[].htg_t 4
      add ri 1
      setarray flat[ri] sprite[].htg_t 1
      add ri 1
      setarray flat[ri] sprite[].hitag`;
    }).join('\n')}

      seta[].htg_t 4 ra
      seta[].htg_t 1 rb
      seta[].htg_t 5 rc
      seta[].hitag rd
    }
  }
endevent
`;
  }
  // Generate per-actor property allocation in EVENT_SPAWN if the actor has custom props.
  if (localCtx.actorCustomChildren && Object.keys(localCtx.actorCustomChildren).length > 0) {
    // Total block size = sum of all prop sizes (objects are stored inline)
    const totalSize = Object.values(localCtx.actorCustomChildren).reduce(
      (sum: number, s: SymbolDefinition) => sum + (s.size ?? 1), 0
    );

    // Build default-value initialization for each slot.
    // Objects: zero-fill all their inline slots. Arrays/strings: 0 (null pointer, allocated on first use).
    let initLines = '';
    for (const p of properties) {
      const pName = p.getName();
      const pSym = localCtx.actorCustomChildren[pName];
      if (!pSym) continue;

      if (pSym.type & ESymbolType.object) {
        // Zero-fill all inline object slots
        for (let s = 0; s < (pSym.size ?? 1); s++) {
          const absOffset = pSym.offset + s;
          if (absOffset == 0)
            initLines += `      setarray flat[rb] 0\n`;
          else
            initLines += `      set ri rb\n      add ri ${absOffset}\n      setarray flat[ri] 0\n`;
        }
      } else {
        // Scalar, string, or array-pointer slot
        const initNode = p.getInitializer();
        const defaultVal = (pSym.type & ESymbolType.array || pSym.type & ESymbolType.string)
          ? 0  // heap pointer — starts as null; array is allocated on first use
          : (initNode ? (evaluateLiteralExpression(initNode, localCtx) as number ?? 0) : 0);
        if (pSym.offset == 0)
          initLines += `      setarray flat[rb] ${defaultVal}\n`;
        else
          initLines += `      set ri rb\n      add ri ${pSym.offset}\n      setarray flat[ri] ${defaultVal}\n`;
      }
    }

    const ctorCode = localCtx.actorCustomInitCode
      ? localCtx.actorCustomInitCode.split('\n').map(l => l ? `      ${l}` : '').join('\n') + '\n'
      : '';

    prefix += `
appendevent EVENT_SPAWN
  ifactor ${localCtx.currentActorPicnum} {
    set ra _pCptr
    ife ra 0 {
      state pushr2
      set r0 ${totalSize}
      set r1 ${EHeapType.peractor}
      state alloc
      state popr2
      set _pCptr rb
${initLines}${ctorCode}    }
  }
endevent
`;
  }

  code = prefix + code;

  context.globalVarCount = localCtx.globalVarCount + 2;

  return code;
}