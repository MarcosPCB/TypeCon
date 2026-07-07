import { ClassDeclaration, SyntaxKind, Statement, Block, ObjectLiteralExpression, ExpressionStatement, CallExpression, Expression, PropertyAssignment, StringLiteral } from "ts-morph";
import { CompilerContext, SymbolDefinition, ESymbolType, EHeapType } from "../Compiler";
import { evaluateLiteralExpression } from "../helper/helpers";
import { indent } from "../helper/indent";
import { addDiagnostic } from "./addDiagnostic";
import { EventList, TEvents } from "../types";
import { visitConstructorDeclaration } from "./visitConstructorDeclaration";
import { parseVarForActionsMovesAi, parseActorSuperCall, PROJECTILE_FIELD_MAP, parseProjectileSuperCall } from "./actorHelper";
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
  // Strip namespace prefix so "TCSet100.CGame" matches the same as "CGame"
  let type = base.includes('.') ? base.split('.').pop()! : base;
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

  if (type === 'CGame') {
    return visitCGameDeclaration(cd, localCtx);
  }

  if (type === 'CVolume') {
    return visitCVolumeDeclaration(cd, localCtx);
  }

  if (type === 'CInput') {
    type = 'CEvent';
    localCtx.currentEventName = 'PROCESSINPUT';
  }

  // Detect inheritance from another user-defined plain class
  let parentClassName: string | undefined;
  const BUILTIN_TYPES = new Set(['CActor', 'CPlayer', 'CProjectile', 'CEvent', 'CInput', 'CGame', 'CVolume']);
  if (type !== '' && !BUILTIN_TYPES.has(type)) {
    const maybeSym = context.symbolTable.get(type) as SymbolDefinition | undefined;
    if (maybeSym && (maybeSym.type & ESymbolType.class)) {
      parentClassName = type;
      type = '';
      context.currentParentClass = parentClassName;
    }
  }

  let cls: SymbolDefinition;

  if (type == '') {
    cls = context.symbolTable.get(className) as SymbolDefinition;
    if (cls) {
      addDiagnostic(cd, context, 'error', `Duplicate definition. Tried to declare a class named ${className} when there's already a ${cls.type} with the same name`);
      return '';
    }

    const parentSymDef = parentClassName
      ? (context.symbolTable.get(parentClassName) as SymbolDefinition)
      : undefined;

    context.symbolTable.set(className, {
      name: className,
      type: ESymbolType.class,
      offset: 0,
      num_elements: parentSymDef?.num_elements ?? 0,
      size: 0,
      heap: true,
      children: parentSymDef ? { ...parentSymDef.children } : {},
      astNode: cd,
    });

    cls = context.symbolTable.get(className) as SymbolDefinition;
  }

  const ctors = cd.getConstructors();

  // Pre-extract currentActorPicnum (and related fields) from super() before the
  // property loop, so the _enabler global allocation uses the correct picnum.
  // visitConstructorDeclaration for CActor/CPlayer is deferred to after the
  // property loop (so actorCustomChildren is ready), but that means the property
  // loop would allocate lb{undefined}_enabler instead of lb{picnum}_enabler.
  if ((type === 'CActor' || type === 'CPlayer' || type === 'CProjectile') && ctors.length > 0) {
    const body = ctors[0].getBody() as Block;
    if (body) {
      for (const st of body.getStatements()) {
        if (!st.isKind(SyntaxKind.ExpressionStatement)) continue;
        const expr = (st as ExpressionStatement).getExpression();
        if (!expr.isKind(SyntaxKind.CallExpression)) continue;
        if ((expr as CallExpression).getExpression().getText() !== 'super') continue;
        if (type === 'CPlayer') {
          const args = (expr as CallExpression).getArguments();
          if (args.length >= 1) {
            const val = evaluateLiteralExpression(args[0] as Expression, localCtx);
            if (typeof val === 'number') localCtx.currentActorPicnum = val;
          }
          if (args.length >= 2) {
            const val = evaluateLiteralExpression(args[1] as Expression, localCtx);
            if (typeof val === 'number') localCtx.currentActorExtra = val;
          }
        } else if (type === 'CProjectile') {
          parseProjectileSuperCall(expr as CallExpression, localCtx);
        } else {
          parseActorSuperCall(expr as CallExpression, localCtx);
        }
        break;
      }
    }
  }

  // For CEvent/CInput: run the constructor immediately — it sets currentEventName
  // which is needed for the appendevent code generated further below.
  // For CActor/CPlayer: deferred to AFTER property collection (see further below)
  // so actorCustomChildren is populated before the constructor body is compiled.
  // For plain classes (type == ''): handled in the defstate constructor section below.
  if (ctors.length > 0 && (type === 'CEvent' || type === 'CInput')) {
    code += visitConstructorDeclaration(ctors[0], localCtx, type);
  }

  // Fallback: if no constructor (or empty constructor) set currentEventName from
  // the generic type argument — e.g. `extends CEvent<'Spawn'>` → EVENT_SPAWN.
  if (type === 'CEvent' && !localCtx.currentEventName) {
    const typeArgs = cd.getExtends()?.getTypeArguments() ?? [];
    if (typeArgs.length > 0) {
      const eventNameRaw = typeArgs[0].getText().replace(/[`'"]/g, '');
      if (EventList.includes(eventNameRaw as TEvents))
        localCtx.currentEventName = eventNameRaw.toUpperCase();
      else
        addDiagnostic(cd, localCtx, 'error', `Event '${eventNameRaw}' in type argument is not a valid event name`);
    } else {
      addDiagnostic(cd, localCtx, 'error', `CEvent subclass '${className}' has no event name — add a super() call or use extends CEvent<'EventName'>`);
    }
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

  if (type == 'CProjectile') {
    localCtx.symbolTable.set('defaultPicnum', {
      name: 'defaultPicnum',
      offset: 0,
      type: ESymbolType.constant,
      literal: localCtx.currentActorPicnum
    });
  }

  // Pre-register all method names before processing properties so that self-referential
  // calls within Events handlers (e.g. this.OnDraw() inside DrawWeapon) resolve correctly.
  if (type == '') {
    context.curClass = cls;
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

  // visit properties
  const properties = cd.getProperties();
  let codeV = '';
  let hasLabels = false;
  let hasOnEvent = false;
  let globalPtrName: string | undefined;
  let ptrAddr: string | undefined;
  let eventCode = '';

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

    if (/^OnEvent(<.*>)?$/.test(p.getTypeNode().getText())) {
      const init = p.getInitializerOrThrow();

      if (init.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const events = init.getProperties();

        hasOnEvent = true;
        if (type === '' && !globalPtrName) {
          globalPtrName = `_g_${className}_ptr`;
          if (!context.symbolTable.has(globalPtrName)) {
            localCtx.globalVarCount++;
            context.symbolTable.set(globalPtrName, {
              name: globalPtrName,
              offset: localCtx.globalVarCount - 1,
              global: true,
              type: ESymbolType.number
            });
            context.globalAllocations.push({ name: globalPtrName, size: 1 });
          }
          ptrAddr = context.options.mode === 'module'
            ? `_G_ADDR_${globalPtrName}`
            : String(localCtx.globalVarCount - 1);
        }

        for (const e of events) {
          const isArrow = e.isKind(SyntaxKind.PropertyAssignment) &&
            (e as any).getInitializer?.()?.isKind(SyntaxKind.ArrowFunction);
          if (!e.isKind(SyntaxKind.MethodDeclaration) && !isArrow) {
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
            paramMap: {},
            curClass: type === '' ? cls : localCtx.curClass,
            currentEventName: eFnName.toUpperCase(),
          };

          const isPlainClass = type === '';
          const lineDetail = context.options.lineDetail ? formatLineDetail(e.getText(), '\n') : '';

          let evtCode = `${lineDetail}\nonevent EVENT_${eFnName.toUpperCase()}\nset ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;
          evtCode += isPlainClass
            ? `  set ra flat[${ptrAddr}]\n  setarray flat[rbp] ra\n  add rsp 1\n`
            : `  ifactor ${localCtx.currentActorPicnum} {\n`;

          // Support both method shorthand (Game() {}) and arrow property (Game: () => {})
          const body = (isArrow ? (e as any).getInitializer().getBody() : (e as any).getBody()) as any;
          if (body) {
            const stmts = body.getStatements() as Statement[];
            stmts.forEach(s => {
              evtCode += visitStatement(s, evntLocalCtx);
            });
          }

          evtCode += isPlainClass
            ? `  sub rsp 1\n  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nendevent \n\n`
            : `  }\n  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nendevent \n\n`;

          if (isPlainClass) eventCode += evtCode;
          else code += evtCode;
        }
      }
    } else if (type == '') {
      const pName = p.getName();
      const pType = p.getTypeNode().getText();

      // CON_FUNC_ALIAS: register as callable native alias (no heap slot)
      if (pType.startsWith('CON_FUNC_ALIAS')) {
        cls.children[pName] = { name: pName, offset: -1, type: ESymbolType.function, nativeAlias: true } as SymbolDefinition;
        continue;
      }
      // Skip other CON_ type annotations and static properties — not heap slots
      if (pType.startsWith('CON_') || p.isStatic()) continue;

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

          const typeAlias = context.typeAliases.get(t);

          if (!typeAlias) {
            if (t.includes('|')) {
              // Union type (e.g. CProjectile | number) — treat as plain number
              cls.children[pName].type = ESymbolType.number;
              break;
            }
            addDiagnostic(p, context, 'error', `Undeclared type ${pType}`);
            return '';
          }

          if (typeAlias.literal) {
            if (typeAlias.literal == 'string' && isArray)
              cls.children[pName].type = ESymbolType.string | ESymbolType.array;
            else if (isArray)
              cls.children[pName].type = ESymbolType.array;
            else cls.children[pName].type = typeAlias.literal as any;
          } else {
            cls.children[pName].type = ESymbolType.object | (isArray ? ESymbolType.array : 0);
            cls.children[pName].children = getObjectTypeLayout(t, context);
            cls.children[pName].size = getObjectSize(t, context);
            cls.children[pName].num_elements = Object.keys(cls.children[pName].children).length;
          }
      }
      cls.num_elements++;
    } else if ((type == 'CActor' || type == 'CPlayer' || type == 'CProjectile') && p.getTypeNode()) {
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

  // Now that actorCustomChildren is populated, compile the CActor/CPlayer/CProjectile constructor body.
  // Non-super statements are compiled into localCtx.actorCustomInitCode and emitted
  // inside EVENT_SPAWN after the _pCptr allocation.
  if (ctors.length > 0 && (type === 'CActor' || type === 'CPlayer' || type === 'CProjectile')) {
    visitConstructorDeclaration(ctors[0], localCtx, type);
  }

  // Emit top-level defineprojectile calls from CProjectile constructor body.
  // Each `this.xxx = constant` where xxx is an IProjectile field becomes:
  //   defineprojectile {picnum} {field} {value}
  let projectileDefineCode = '';
  if (type === 'CProjectile' && ctors.length > 0) {
    const projBody = ctors[0].getBody() as Block;
    if (projBody) {
      for (const st of projBody.getStatements()) {
        if (!st.isKind(SyntaxKind.ExpressionStatement)) continue;
        const expr = (st as ExpressionStatement).getExpression();
        if (!expr.isKind(SyntaxKind.BinaryExpression)) continue;
        const left = expr.getLeft();
        if (!left.isKind(SyntaxKind.PropertyAccessExpression)) continue;
        if (!left.getExpression().isKind(SyntaxKind.ThisKeyword)) continue;
        const propName = left.getName();
        const conField = PROJECTILE_FIELD_MAP[propName];
        if (!conField) continue;
        const val = evaluateLiteralExpression(expr.getRight() as Expression, localCtx);
        if (val === null || val === undefined) {
          addDiagnostic(st, localCtx, 'error', `CProjectile property '${propName}' must be a constant value`);
          continue;
        }
        projectileDefineCode += `defineprojectile ${localCtx.currentActorPicnum} ${conField} ${val}\n`;
      }
    }
  }

  let labels = '';

  // if CActor/CProjectile => append the actions/moves/ais lines
  if (type == 'CActor' || type == 'CProjectile') {
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

  // Pre-scan parent's OnEvent so we can allocate _g_Child_ptr before the constructor is generated
  if (parentClassName && !hasOnEvent) {
    const pSym = context.symbolTable.get(parentClassName) as SymbolDefinition | undefined;
    const pCd = pSym?.astNode as ClassDeclaration | undefined;
    if (pCd) {
      for (const pp of pCd.getProperties()) {
        if (/^OnEvent(<.*>)?$/.test(pp.getTypeNode()?.getText() ?? '')) {
          globalPtrName = `_g_${className}_ptr`;
          if (!context.symbolTable.has(globalPtrName)) {
            localCtx.globalVarCount++;
            context.symbolTable.set(globalPtrName, {
              name: globalPtrName, offset: localCtx.globalVarCount - 1,
              global: true, type: ESymbolType.number
            });
            context.globalAllocations.push({ name: globalPtrName, size: 1 });
          }
          ptrAddr = context.options.mode === 'module'
            ? `_G_ADDR_${globalPtrName}`
            : String(localCtx.globalVarCount - 1);
          hasOnEvent = true;
          break;
        }
      }
    }
  }

  if (ctors.length > 0 && type == '') {
    code = `${context.options.lineDetail ? formatLineDetail(ctors[0].getText()) : ''}\ndefstate ${className}_constructor \n  set ra rbp \n  state push \n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;
    code += indent(`state pushr2\nset r0 ${cls.num_elements}\nset r1 ${EHeapType.object}\nstate alloc\nstate popr2\nsetarray flat[rbp] rb\nadd rsp 1\n`, 1);
    code += visitConstructorDeclaration(ctors[0], context, '');
    if (hasOnEvent && ptrAddr)
      code += `  set ra flat[rbp]\n  setarray flat[${ptrAddr}] ra\n`;
    code += `  set rb flat[rbp]\n  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\nends \n\n`;
  }

  // Monomorphize parent's event handlers into child's context (re-generate with child's method dispatch)
  if (parentClassName && hasOnEvent) {
    const pSym = context.symbolTable.get(parentClassName) as SymbolDefinition | undefined;
    const pCd = pSym?.astNode as ClassDeclaration | undefined;
    if (pCd) {
      for (const pp of pCd.getProperties()) {
        if (!/^OnEvent(<.*>)?$/.test(pp.getTypeNode()?.getText() ?? '')) continue;
        const pInit = pp.getInitializer();
        if (!pInit?.isKind(SyntaxKind.ObjectLiteralExpression)) break;
        const evts = (pInit as ObjectLiteralExpression).getProperties();
        for (const ev of evts) {
          const isArrow = ev.isKind(SyntaxKind.PropertyAssignment) &&
            (ev as any).getInitializer?.()?.isKind(SyntaxKind.ArrowFunction);
          if (!ev.isKind(SyntaxKind.MethodDeclaration) && !isArrow) continue;
          const eFnName = ev.getName();
          if (!EventList.includes(eFnName as TEvents)) continue;
          const evntLocalCtx: CompilerContext = {
            ...localCtx,
            localVarOffset: {},
            localVarCount: 0,
            paramMap: {},
            curClass: cls,
            currentEventName: eFnName.toUpperCase(),
          };
          const lineDetail = context.options.lineDetail ? formatLineDetail(ev.getText(), '\n') : '';
          let evtCode = `${lineDetail}\nonevent EVENT_${eFnName.toUpperCase()}\nset ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;
          evtCode += `  set ra flat[${ptrAddr}]\n  setarray flat[rbp] ra\n  add rsp 1\n`;
          const body = (isArrow ? (ev as any).getInitializer().getBody() : (ev as any).getBody()) as any;
          if (body) {
            const stmts = body.getStatements() as Statement[];
            stmts.forEach(s => { evtCode += visitStatement(s, evntLocalCtx); });
          }
          evtCode += `  sub rsp 1\n  sub rbp 1\n  set rsp rbp\n  set rssp rsbp\n  state pop\n  set rsbp ra\n  state pop\n  set rbp ra\n  state _GC\nendevent \n\n`;
          eventCode += evtCode;
        }
        break;
      }
    }
  }

  if (hasOnEvent) code += eventCode;

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

            codeV += `${context.options.lineDetail ? formatLineDetail(e.getText(), '\n') : ''}\n${localCtx.currentActorHardcoded || type === 'CProjectile' ? 'actor' : `useractor ${localCtx.currentActorIsEnemy ? 1 : 0}`} ${picnum} ${extra} ${action}\n  set ra rbp\n  state push\n  set ra rsbp\n  state push\n  set rsbp rssp\n  set rbp rsp\n  add rbp 1\n`;

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
  context.currentParentClass = undefined;

  let prefix = projectileDefineCode + labels + '\n';

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

/** Extract a string literal value, preserving internal quotes/apostrophes. */
function getStringLiteralValue(node: Expression): string {
  if (node.isKind(SyntaxKind.StringLiteral))
    return (node as StringLiteral).getLiteralText();
  return node.getText().replace(/^[`'"]|[`'"]$/g, '');
}

/******************************************************************************
 * Helper: resolve an argument expression to either a label name or a literal.
 * Used by CGame/CVolume to support GameLabel symbols in header defines.
 *****************************************************************************/
function resolveHeaderArg(arg: Expression, context: CompilerContext): string {
  if (arg.isKind(SyntaxKind.Identifier)) {
    const sym = context.symbolTable.get(arg.getText()) as SymbolDefinition;
    if (sym?.isLabel) return sym.name;
    if (sym?.type & ESymbolType.constant) return String(sym.literal ?? 0);
  }
  const val = evaluateLiteralExpression(arg, context);
  return val !== null && val !== undefined ? String(val) : arg.getText();
}

/******************************************************************************
 * CGame class handler — emits setgamename, defineskillname, gamestartup,
 * precache, and definecheat lines to context.headerDefines.
 *****************************************************************************/
// Fixed CON gamestartup argument order — must match the 27-param EDuke32 spec exactly
const CGAME_STARTUP_KEYS: string[] = [
  'maxHealth', 'maxArmor', 'maxSteroids', 'maxHoloduke', 'maxJetpack',
  'maxScuba', 'maxBoots', 'maxFirstAid', 'initialHealth', 'initialArmor',
  'maxAmmoPistol', 'maxAmmoShotgun', 'maxAmmoChaingun', 'maxAmmoRPG',
  'maxAmmoShrinker', 'maxAmmoDevastator', 'maxAmmoLaser', 'maxAmmoFreeze',
  'maxAmmoShrunk', 'maxAmmoHeat', 'maxAmmoExpander',
  'damagePistol', 'damageShotgun', 'damageChaingun', 'damageRPG',
  'damageMortar', 'damageGrenade',
];

function visitCGameDeclaration(cd: ClassDeclaration, context: CompilerContext): string {
  const ctors = cd.getConstructors();
  if (ctors.length === 0) return '';

  const body = ctors[0].getBody() as Block;
  if (!body) return '';

  for (const st of body.getStatements()) {
    if (!st.isKind(SyntaxKind.ExpressionStatement)) continue;
    const expr = (st as ExpressionStatement).getExpression();
    if (!expr.isKind(SyntaxKind.CallExpression)) continue;
    const call = expr as CallExpression;
    const callee = call.getExpression().getText();
    const args = call.getArguments();

    if (callee === 'super') {
      // super(name) → setgamename "name"
      if (args.length >= 1) {
        const name = getStringLiteralValue(args[0] as Expression);
        context.headerDefines.push(`setgamename "${name}"\n`);
      }
    } else if (callee === 'this.skill') {
      // this.skill(id, name) → defineskillname id "name"
      if (args.length >= 2) {
        const id = resolveHeaderArg(args[0] as Expression, context);
        const name = getStringLiteralValue(args[1] as Expression);
        context.headerDefines.push(`defineskillname ${id} "${name}"\n`);
      }
    } else if (callee === 'this.startup') {
      // this.startup({...}) → gamestartup v0..v26
      if (args.length >= 1 && args[0].isKind(SyntaxKind.ObjectLiteralExpression)) {
        const obj = args[0] as ObjectLiteralExpression;
        const propMap: Record<string, number> = {};
        for (const prop of obj.getProperties()) {
          if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;
          const pa = prop as PropertyAssignment;
          const val = evaluateLiteralExpression(pa.getInitializer() as Expression, context);
          if (val !== null && val !== undefined) propMap[pa.getName()] = val as number;
        }
        const values = (CGAME_STARTUP_KEYS as string[]).map(k => String(propMap[k] ?? 0));
        context.headerDefines.push(`gamestartup ${values.join(' ')}\n`);
      }
    } else if (callee === 'this.precache') {
      // this.precache(external, startTile, endTile) → precache startTile endTile flag
      if (args.length >= 3) {
        const external = args[0].isKind(SyntaxKind.TrueKeyword) ? 1 : 0;
        const start = resolveHeaderArg(args[1] as Expression, context);
        const end   = resolveHeaderArg(args[2] as Expression, context);
        context.headerDefines.push(`precache ${start} ${end} ${external}\n`);
      }
    } else if (callee === 'this.cheat') {
      // this.cheat(code, label) → definecheat "code" label
      if (args.length >= 2) {
        const codeStr = getStringLiteralValue(args[0] as Expression);
        const label = resolveHeaderArg(args[1] as Expression, context);
        context.headerDefines.push(`definecheat "${codeStr}" ${label}\n`);
      }
    }
  }
  return '';
}

/******************************************************************************
 * CVolume class handler — emits definevolumename, definelevelname, and music
 * lines to context.headerDefines.
 *****************************************************************************/
function visitCVolumeDeclaration(cd: ClassDeclaration, context: CompilerContext): string {
  const ctors = cd.getConstructors();
  if (ctors.length === 0) return '';

  const body = ctors[0].getBody() as Block;
  if (!body) return '';

  let volId = '0';

  for (const st of body.getStatements()) {
    if (!st.isKind(SyntaxKind.ExpressionStatement)) continue;
    const expr = (st as ExpressionStatement).getExpression();
    if (!expr.isKind(SyntaxKind.CallExpression)) continue;
    const call = expr as CallExpression;
    const callee = call.getExpression().getText();
    const args = call.getArguments();

    if (callee === 'super') {
      // super(volId, name) → definevolumename volId "name"
      if (args.length >= 1) volId = resolveHeaderArg(args[0] as Expression, context);
      if (args.length >= 2) {
        const name = getStringLiteralValue(args[1] as Expression);
        context.headerDefines.push(`definevolumename ${volId} "${name}"\n`);
      }
    } else if (callee === 'this.level') {
      // this.level(id, file, music, name, par?, des?) → definelevelname vol id "file" "music" "name" [par des]
      if (args.length >= 4) {
        const id    = resolveHeaderArg(args[0] as Expression, context);
        const file  = getStringLiteralValue(args[1] as Expression);
        const music = getStringLiteralValue(args[2] as Expression);
        const name  = getStringLiteralValue(args[3] as Expression);
        const par   = args.length >= 5 ? ` ${resolveHeaderArg(args[4] as Expression, context)}` : '';
        const des   = args.length >= 6 ? ` ${resolveHeaderArg(args[5] as Expression, context)}` : '';
        context.headerDefines.push(`definelevelname ${volId} ${id} "${file}" "${music}" "${name}"${par}${des}\n`);
      }
    } else if (callee === 'this.music') {
      // this.music(lev, file) → music vol lev "file"
      if (args.length >= 2) {
        const lev  = resolveHeaderArg(args[0] as Expression, context);
        const file = getStringLiteralValue(args[1] as Expression);
        context.headerDefines.push(`music ${volId} ${lev} "${file}"\n`);
      }
    }
  }
  return '';
}