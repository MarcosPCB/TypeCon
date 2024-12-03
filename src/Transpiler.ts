import * as T from '@babel/types';
import { EBlock, EState, IActor, IBlock, IError, ILabel, IVar, TClassType, TVar } from './types';
import { escape } from 'querystring';
import { funcTranslator, IFuncTranslation, initCode, initStates } from './translation';
import { CActor, EMoveFlags, IAction, IAi, IMove } from './defs/types';
import { CON_NATIVE_FLAGS, nativeFunctions, nativeVars } from './defs/native';

const errors: IError[] = [];
var detailLines = false;
var code = initCode;

var block: EBlock = EBlock.NONE; //Major block
var bBlock: IBlock[] = [];
var vars: IVar[] = [];
var state: EState = EState.NONE;
var actors: IActor[] = [];
var curActor: IActor = {
  name: '',
  picnum: -1,
  enemy: false,
  extra: 0
}

var sp = -1;
var bp = 0

var ra: any = 0;
var rb: any = 0;
var rc: any = null;

var typeCheck = '';

var stack: number[] = [];

var labels: ILabel[] = [];

function GetVarType(node: T.VariableDeclarator) {
  if(node.id.type == 'Identifier') {
    if(node.id.typeAnnotation?.type == 'TSTypeAnnotation') {
      const type = node.id.typeAnnotation.typeAnnotation;
      if(type.type == 'TSTypeReference') {
        const type2 = type.typeName;
        switch((type2 as T.Identifier).name) {
          case 'IAction':
            return 'action';

          case 'IMove':
            return 'move';

          case 'IAi':
            return 'ai';

          case 'TLabel':
            return 'label';
        }
      }

      switch(type.type) {
        case 'TSNumberKeyword':
          return 'integer';

        case 'TSStringKeyword':
          return 'string'
      }
    }

    return 'any';
  }
}

function StartBlock(name: string, type: TClassType): number {
  if(block != EBlock.NONE)
    return 0;

  switch(type) {
    case 'CActor':
      const actor: IActor = {
        name,
        extra: 0,
        picnum: -1,
        enemy: false
      };
      actors.push(actor);
      curActor = actor;
      block = EBlock.ACTOR;
      break;

    default:
      return -1;
  }

  return 1;
}

function ReturnFromFunction() {
  const b =  bBlock.at(-1);

  if(!b) {
    console.log(`Tried to return from a block, but it's not even in one`);
    return;
  }

  if(state == EState.BODY) {
    if(b.type == EBlock.ACTOR)
      code += `set rbp ${b.base} \nset rsp ${b.stack}`;
  }

  const diff = sp - b.stack;
  vars.splice(vars.length - 1 - diff, diff);

  sp = b.stack;
  bp = b.base;
}

function EndBlock() {
  const b =  bBlock.at(-1);
  if(!b) {
    console.log(`Tried closing a block without opening one`);
    return;
  }

  ReturnFromFunction();

  switch(b.type) {
    case EBlock.ACTOR:
      code += '\nenda';
      break;

    case EBlock.STATE:
      code += '\nends';
      break;

    case EBlock.EVENT:
      code += '\nendevent';
      break;
  }

  bBlock.pop();
}

function TranslateFunc(node: T.Expression | T.SpreadElement ) {
  let object = '';
  let func = '';
  let type = '';

  if(node.type == 'MemberExpression') {
    type = 'object';

    if(!node.object.loc)
      return {
        native: false,
        index: -2
      };

    if(node.object.type == 'Identifier')
      object = node.object.loc.identifierName as string;
    else if(node.object.type == 'ThisExpression')
      object = 'this';
    
    if(!node.property.loc)
      return {
        native: false,
        index: -2
      };

    func = node.property.loc.identifierName as string;
  }

  let conFunc: number = -1;
  let native = true;
  
  if(object == 'this') {
    if(block == EBlock.ACTOR) {
      conFunc = nativeFunctions.findIndex(e => e.name == func);
    }
  } else {
    native = false;
    conFunc = funcTranslator.findIndex(
      e => e.type == type 
      && e.tsObjName == object 
      && ((e.names && Array.from(e.tsName).includes(func)) || (!e.names && e.tsName == func))
    );
  }

  return {
    native,
    index: conFunc
  };
}

function SuperCall(node: T.CallExpression) {
  if(state != EState.INIT) {
    errors.push({
      type: 'error',
      node: node.type,
      location: node.loc as T.SourceLocation,
      message: 'Called super function out of the initilization section of a class'
    });
    return false;
  }

  //enemy or notenemy, and then extra
  const args = node.arguments;

  if(args[0].type != 'NumericLiteral') {
    errors.push({
      type: 'error',
      node: node.type,
      location: node.loc as T.SourceLocation,
      message: `Defined ${args[0].type} instead of integer for actor's picnum`
    });
    return false;
  }

  curActor.picnum = Math.trunc(args[0].value);

  if(args[1].type != 'BooleanLiteral') {
    errors.push({
      type: 'error',
      node: node.type,
      location: node.loc as T.SourceLocation,
      message: `Defined ${args[0].type} instead of boolean for enemy/notenemy definition`
    });
    return false;
  }

  curActor.enemy = args[1].value;

  if(args[2].type != 'NumericLiteral') {
    errors.push({
      type: 'error',
      node: node.type,
      location: node.loc as T.SourceLocation,
      message: `Defined ${args[2].type} instead of integer for actor strength`
    });
    return false;
  }

  curActor.extra = Math.trunc(args[2].value);

  if(args[3]) {
    if(args[3].type != 'ArrayExpression') {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: `Defined ${args[3].type} instead of array containg the actor's actions`
      });
      return false;
    }

    curActor.actions = [];

    for(let i = 0; i < args[3].elements.length; i++) {
      const e = args[3].elements[i] as T.Identifier;

      const variable = vars.findIndex(el => el.name == e.name);

      if(variable == -1) {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Variable ${e.name} does not exist or hasn't been declared yet`
        });
        return false;
      }

      if(vars[variable].type != 'action') {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Variable ${vars[variable].name} is not an action set`
        });
        return false;
      }

      curActor.actions.push(vars[variable].init as IAction);
      const action = vars[variable].init as IAction;

      code += `action ${action.name} ${action.start} ${action.length} ${action.viewType} ${action.incValue} ${action.delay} \n`;
      labels.push({
        label: action.name,
        pointer: action
      });
    }
  }

  curActor.first_action = undefined;

  if(args[4]) {
    if(args[4].type != 'Identifier') {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: `Defined ${args[4].type} instead of an IAction constant`
      });
      return false;
    }

    if(!curActor.actions) {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: `No actions were defined for this actor`
      });
      return false;
    }

    const variable = vars.findIndex(el => el.name == args[4].loc?.identifierName);

    if(variable == -1) {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: `Variable ${args[4].loc?.identifierName} does not exist or hasn't been declared yet`
      });
      return false;
    }

    if(vars[variable].type != 'action') {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: `Variable ${vars[variable].name} is not an action set`
      });
      return false;
    }

    curActor.first_action = vars[variable].init as IAction;
  }

  if(args[5]) {
    if(args[5].type != 'ArrayExpression') {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: `Defined ${args[5].type} instead of array containg the actor's moves`
      });
      return false;
    }

    curActor.moves = [];

    for(let i = 0; i < args[5].elements.length; i++) {
      const e = args[5].elements[i] as T.Identifier;

      const variable = vars.findIndex(el => el.name == e.name);

      if(variable == -1) {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Variable ${e.name} does not exist or hasn't been declared yet`
        });
        return false;
      }

      if(vars[variable].type != 'move') {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Variable ${vars[variable].name} is not a move set`
        });
        return false;
      }

      curActor.moves.push(vars[variable].init as IMove);
      const move = vars[variable].init as IMove;

      code += `move ${move.name} ${move.horizontal_vel} ${move.vertical_vel} \n`;
      labels.push({
        label: move.name,
        pointer: move
      })
    }
  }

  if(args[6]) {
    if(args[6].type != 'ArrayExpression') {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: `Defined ${args[6].type} instead of array containg the actor's AI sets`
      });
      return false;
    }

    curActor.ais = [];

    for(let i = 0; i < args[6].elements.length; i++) {
      const e = args[6].elements[i] as T.Identifier;

      const variable = vars.findIndex(el => el.name == e.name);

      if(variable == -1) {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Variable ${e.name} does not exist or hasn't been declared yet`
        });
        return false;
      }

      if(vars[variable].type != 'ai') {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Variable ${vars[variable].name} is not an ai set`
        });
        return false;
      }

      curActor.ais.push(vars[variable].init as IAi);
      const ai = vars[variable].init as IAi;

      code += `ai ${ai.name} ${ai.action} ${ai.move} ${ai.flags} \n`;
      labels.push({
        label: ai.name,
        pointer: ai
      })
    }
  }

  return true;
}

function Traverse(
  node: T.Statement |  T.ClassMethod | T.ClassPrivateMethod | T.ClassProperty | T.ClassPrivateProperty | T.ClassAccessorProperty | T.TSDeclareMethod | T.TSIndexSignature | T.StaticBlock | T.Expression | T.SpreadElement | T.ArgumentPlaceholder,
  mode: 'retrieval' | 'declaration' | 'assignment' | 'conditional' | 'else' | 'function_params' | 'native_function_params' | 'state_params' | 'constructor' | 'root' | 'function_body' | 'class_body',
  argument?: number,
) {
  if(node.type == 'ImportDeclaration')
    return true;

  if(node.type == 'CallExpression') {      
    //Class initialization
    if(mode == 'constructor') {
      if(node.callee.type == 'Super') {
        if(!SuperCall(node))
          return false;

        ReturnFromFunction();
      } else {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Except for 'super()', call expressions are not allowed in the constructor`
        });
        return false;
      }

      return true;
    }

    //Label pointer
    if((node.callee as T.Identifier).name == 'Label') {
      const args = node.arguments;

      if(args.length != 1) {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Label function takes only 1 argument`
        });
        return false;
      }

      const arg = args[0];
      let val = '';

      if(arg.type == 'StringLiteral')
        val = arg.value;

      if(arg.type == 'MemberExpression') {
        if(!Traverse(arg, mode))
          return false;
      }

      const label = labels.find(e => e.label == val);

      if(!label) {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Label ${val} not found`
        });
        return false;
      }

      if(mode == 'retrieval') {
        ra = val;
      } else {
        //Return value is the label, so set rb to the label
        code += `set rb ${val} \n`;

        if(typeof argument !== 'undefined')
          code += `set r${argument} rb \n`;
      }

      return true;
    }

    const func = TranslateFunc(node.callee as T.CallExpression);

    if(func.index < 0) {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: `Function is not supported by CON`
      });
      return false;
    }

    if(func.native) {
      const f = nativeFunctions[func.index];

      if(mode == 'conditional' && !f.returns) {
        errors.push({
          type: 'warning',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Function ${f.name} has no return value to be used in a If statement`
        });
      }
      //if(mode == 'function_body') {
        if(node.arguments.length < f.arguments.length) {
          errors.push({
            type: 'error',
            node: node.type,
            location: node.loc as T.SourceLocation,
            message: `Missing parameters in function`
          });
          return false;
        }

        const args = node.arguments;

        if(args.length > 0) {
          let params: string = '';

          code += `state pushr${args.length} \n`;

          for(let i = 0; i < args.length; i++) {
            const a = args[i];

            if(a.type == 'BinaryExpression' || a.type == 'MemberExpression') {
              if(f.arguments[i] != CON_NATIVE_FLAGS.VARIABLE && f.arguments[i] != CON_NATIVE_FLAGS.CONSTANT) {
                errors.push({
                  type: 'error',
                  node: node.type,
                  location: node.loc as T.SourceLocation,
                  message: `Wrong type of parameter for argument for function ${f.name}`
                });
              }

              if(!Traverse(a, f.arguments[i] == CON_NATIVE_FLAGS.VARIABLE ? 'function_params' : 'retrieval',
                f.arguments[i] == CON_NATIVE_FLAGS.VARIABLE ? i : undefined))
                return false;

              if(f.arguments[i] == CON_NATIVE_FLAGS.CONSTANT) {
                params += `${ra} `;
                continue;
              }
            }

            if(a.type == 'CallExpression') {
              if(f.arguments[i] == CON_NATIVE_FLAGS.LABEL) {
                if(a.callee.type != 'Identifier' || a.callee.name != 'Label') {
                  errors.push({
                    type: 'error',
                    node: node.type,
                    location: node.loc as T.SourceLocation,
                    message: `Wrong type of parameter for argument label for function ${f.name}`
                  });
                }

                if(!Traverse(a, 'retrieval'))
                  return false;

                params += `${ra} `;
                continue;
              }

              if(!Traverse(a, 'function_params', i))
                return false;
            }

            params += `r${i} `;
          }

          code += `${f.code} ${params} \n`;
          code += `state popr${args.length} \n`;
        } else code += `${f.code} \n`;

        typeCheck = '';
        if(f.returns && f.return_type)
          typeCheck = f.return_type;
      //}
    } else {
      const f = funcTranslator[func.index];

      //if(mode == 'function_body') {
        if(node.arguments.length < f.params.length) {
          errors.push({
            type: 'error',
            node: node.type,
            location: node.loc as T.SourceLocation,
            message: `Missing parameters in function`
          });
          return false;
        }

        const args = node.arguments;

        if(args.length > 0) {
          let params: string = '';

          code += `state pushr${args.length} \n`;

          for(let i = 0; i < args.length; i++) {
            const a = args[i];

            if(a.type == 'BinaryExpression') {
              const newMode = f.params[i] == 'variable' ? 'function_params' : 'retrieval';
              if(!Traverse(a, newMode, i))
                return false;
            }

            if(a.type == 'Identifier') {
              const variable = vars.find(e => e.name == a.name);

              if(!variable) {
                errors.push({
                  type: 'error',
                  node: node.type,
                  location: node.loc as T.SourceLocation,
                  message: `Unknown keyword or variable at function ${node.callee.loc?.identifierName}`
                });
                return false;
              }

              code += `set r${i} stack[${variable.pointer}] \n`;
            }

            params += `r${i} `;
          }

          code += `${f.conName} ${params} \n`;
          code += `state popr${args.length} \n`;
        } else code += `${f.conName} \n`;

        typeCheck = '';
      //}
    }

    if(typeof argument !== 'undefined')
      code += `set r${argument} rb \n`;

    return true;
  }

  if(node.type == 'BinaryExpression' || node.type == 'LogicalExpression') {
    let typeCheck2 = typeCheck;
    typeCheck = '';
    const vals: any[] = [2];
    for(let i = 1; i >= 0; i--) {
      const side = i == 0 ? node.right : node.left;

      //if(mode != 'retrieval' && i == 0)
        //code += `set rb ra \n`;

      if(side.type == 'NumericLiteral') {
        if(mode == 'retrieval')
          vals[i] = side.value;
        else code += `set ra ${side.value} \n`;
      } 

      //retrieval cannot happened with call expressions
      if(side.type == 'CallExpression') {
        if(i == 0)
          code += `state pushb \n`;

        if(!Traverse(side, mode))
          return false;

        if(i == 0)
          code += `set ra rb \nstate popb \n`;
      }

      if(side.type == 'Identifier') {
        const vName = side.name;

        const variable = vars.find(e => e.name == vName);

        if(!variable) {
          errors.push({
            type: 'error',
            node: node.type,
            location: node.loc as T.SourceLocation,
            message: `Unknown variable or keyword ${vName}`
          });
          return false;
        }

        if(mode == 'retrieval')
          vals[i] = variable.init;
        else code += `set ra stack[${variable.pointer}] \n`;
      }

      if(side.type == 'MemberExpression' || side.type == 'BinaryExpression') {
        if(!Traverse(side, mode))
          return false;

        if(mode == 'retrieval')
          vals[i] = ra;

        if(i == 1)
          code += `set rb ra \n`;
      }

      if(node.type == 'LogicalExpression') {
        if(i == 1)
          code += 'state push \n';
        else code += 'set rb ra \nstate pop \n'
      }
    }

    if(mode == 'retrieval') {
      ra = vals[0];
      switch(node.operator) {
        case '+':
          ra += vals[1];
          break;

        case '-':
          ra -= vals[1];
          break;

        case '*':
          ra *= vals[1];
          break;
        
        case '/':
          ra /= vals[1];
          break;
      }
    } else {
      let operator = '';
      let conditional = false;
      switch(node.operator) {
        case '+':
          operator = 'add';
          break;

        case '-':
          operator = 'sub';
          break;

        case '*':
          operator = 'mul';
          break;
        
        case '/':
          operator = 'div';
          break;

        case '==':
          operator = 'ife';
          conditional = true;
          break;

        case '!=':
          operator = 'ifn';
          conditional = true;
          break;

        case '>':
          operator = 'ifg';
          conditional = true;
          break;

        case '<':
          operator = 'ifl';
          conditional = true;
          break;

        case '>=':
          operator = 'ifge';
          conditional = true;
          break;

        case '<=':
          operator = 'ifle';
          conditional = true;
          break;

        case '&&':
          operator = 'ifboth';
          conditional = true;
          break;

        case '||':
          operator = 'ifeither';
          conditional = true;
          break;
      }

      if(mode == 'conditional' && conditional)
        code += `set rd ra \nset ra 0 \n${operator} rd rb set ra 1 \n`;
      else code += `${operator} ra rb \n`;
    }

    if(typeof argument !== 'undefined')
      code += `set r${argument} ra \n`;

    return true;
  }

  if(node.type == 'MemberExpression') {
    const o = node.object;
    const p = node.property;
    let object: any = null;

    if(o.type == 'Identifier') {
      switch(o.name) {
        case 'EMoveFlags':
          object = EMoveFlags;
          break;
      }
    }

    //For now, work in retrieval mode
    if(o.type == 'MemberExpression') {
      if(!Traverse(o, 'retrieval'))
        return false;

      if(node.computed) {
        if(p.type == 'NumericLiteral')
          ra = ra[p.value];
  
        return true;
      }
    }

    if(p.type == 'Identifier') {
      if(o.type == 'ThisExpression') {
        if(block == EBlock.ACTOR) {
          let v = nativeVars.find(e => (e.name == p.name && e.object == 'this' && e.var_type == 'actor'));
          if(!v) {
            errors.push({
              type: 'error',
              node: node.type,
              location: node.loc as T.SourceLocation,
              message: `Property ${p.name} does not exist in CActor or its own actor`
            });
            return false;
          }

          if(v.type == 'ts' && mode == 'retrieval') {
            ra = (curActor as any)[v.name];
            return true;
          }

          if(mode == 'retrieval')
            ra = v.init;
          
          //if(mode == 'function_params')
          code += `geta[].${v.code} ra \n`
        }
      } else {
        if(mode == 'retrieval') {

          if(o.type == 'Identifier')
            ra = object[p.name]

          if(o.type == 'MemberExpression')
            ra = ra[p.name];
        }
      }
    }

    if(typeof argument !== 'undefined') {
      code += `set r${argument} ra \n;`
    }

    return true;
  }

  if(node.type == 'ObjectExpression') {
    for(let i = 0; i < node.properties.length; i++) {
      const p = node.properties[i];

      if(p.type == 'ObjectProperty') {
        if(mode == 'retrieval' || mode == 'declaration') {
          const pName = (p.key as T.Identifier).name;
          const v = vars.at(-1) as IVar;

          if(!v.init)
            v.init = new Object();

          if(p.value.type == 'StringLiteral' || p.value.type == 'NumericLiteral')
            v.init[pName] = p.value.value;

          if(p.value.type == 'BinaryExpression' || p.value.type == 'MemberExpression') {
            if(mode == 'retrieval') { //Must pre-calculate
              ra = 0;
              if(!Traverse(p.value, mode))
                return false;

              v.init[pName] = ra;
            }
          }
        }
      }
    }
  }

  if(node.type == 'VariableDeclaration') {
    if(node.declarations[0].type == 'VariableDeclarator') {
      if(node.declarations[0].id.type == 'Identifier') {
        const v = node.declarations[0].id;
        const vType = GetVarType(node.declarations[0]);
        if(!vType) {
          errors.push({
            type: 'error',
            node: node.type,
            location: node.loc as T.SourceLocation,
            message: `Wrong or missing type for variable ${v.name}`
          });
          return false;
        }

        const variable: IVar = {
          name: v.name,
          global: mode == 'root',
          constant: node.kind == 'const',
          type: vType,
          init: 0,
          pointer: sp + 1,
          block: bBlock.length - 1
        }

        sp++;
        vars.push(variable);

        if(node.declarations[0].init) {
          const traverseMode = (state == EState.INIT || (bBlock.length > 0 && bBlock[bBlock.length - 1].name == 'constructor'))
            ? 'retrieval' : 'declaration';

          if(node.declarations[0].init.type == 'NumericLiteral' || node.declarations[0].init.type == 'StringLiteral') {
            variable.init = node.declarations[0].init.value;

            if(mode != 'constructor') {
              code += `add rsp 1 \nsetarray stack[rsp] ${variable.init} \n`;
            }
          } else {        
            if(!Traverse(node.declarations[0].init, traverseMode)) {
              vars.pop();
              sp--;
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  if(node.type == 'IfStatement') {
    if(mode == 'constructor') {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: `If statements are not allowed in the constructor`
      });
      return false;
    }

    if(!Traverse(node.test, 'conditional'))
      return false;

    code += `ife ra 1 { \n`;

    if(node.consequent.type == 'BlockStatement') {
      for(let i = 0; i < node.consequent.body.length; i++) {
        if(!Traverse(node.consequent.body[i], 'function_body'))
          return false;
      }
    }

    code += `} \n`;

    return true;
  }

  if(node.type == 'ExpressionStatement') {
    const exp = node.expression;
    if(exp.type == 'AssignmentExpression') {
      if(mode == 'constructor') {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Variable assingments are not allowed in the constructor`
        });
        return false;
      }

      const variable = vars.find(e => e.name == (exp.left as T.Identifier).name);

      if(!variable) {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Unknown variable or keyword ${(exp.left as T.Identifier).name}`
        });
        return false;
      }

      if(!Traverse(exp.right, 'assignment'))
        return false;

      code += `set rb ra \nset ra stack[${variable.pointer}] \n`;

      let operator = '';

      switch(exp.operator) {
        case '+=':
          operator = 'add';
          break;

        case '-=':
          operator = 'sub';
          break;

        case '*=':
          operator = 'mul';
          break;
        
        case '/=':
          operator = 'div';
          break;

        case '=':
          operator = 'set';
          break;
      }

      code += `${operator} ra rb \nsetarray stack[${variable.pointer}] ra \n`;
    }

    if(exp.type == 'CallExpression') {
      if(!Traverse(exp, mode))
        return false;
    }

    return true;
  }

  if(node.type == 'ClassMethod') {
    if(node.key.loc?.identifierName == 'constructor') {
      if(node.body.type != 'BlockStatement') {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: 'Missing Actor constructor body'
        });
        return false;
      }

      state = EState.INIT;
      bBlock.push({
        name: 'constructor',
        type: EBlock.ACTOR,
        state: EState.BODY,
        stack: sp,
        base: bp
      })

      for(let i = 0; i < node.body.body.length; i++) {
        if(!Traverse(node.body.body[i], 'constructor')) {
          bBlock.pop();
          state = EState.NONE;
          return false;
        }
      }

      ReturnFromFunction();
      bBlock.pop();
      state = EState.BODY;

      return true;
    }

    if(node.key.loc?.identifierName?.toLowerCase() == 'main') {
      if(node.body.type != 'BlockStatement') {
        errors.push({
          type: 'error',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: 'Missing Actor Main function body'
        });
        return false;
      }

      bBlock.push({
        type: EBlock.ACTOR,
        state: EState.BODY,
        name: 'Main',
        stack: sp,
        base: bp
      });

      code += `useractor ${curActor.enemy ? 'enemy' : 'notenemy'} ${curActor.picnum} ${curActor.extra} ${curActor.first_action ? curActor.first_action.name : ''} \n`;

      for(let i = 0; i < node.body.body.length; i++) {
        if(!Traverse(node.body.body[i], 'function_body'))
          return false;
      }

      EndBlock();

      return true;
    }
  }

  if(node.type == 'ClassDeclaration') {
    if(!node.superClass || !node.superClass.loc) {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: 'Missing Class extension'
      });
      return false;
    }

    if(!node.id) {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: 'Missing class identifier'
      });
      return false;
    }

    const starter: number = StartBlock(node.id?.name, node.superClass?.loc?.identifierName as TClassType);

    if(starter == -1) {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: 'Unknown class identifier'
      });
      return false;
    } else if(starter == 0) {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: 'Started new class inside another block'
      });
      return false;
    }

    if(node.body.type == 'ClassBody') {
      for(let i = 0; i < node.body.body.length; i++) {
        if(!Traverse(node.body.body[i], 'class_body'))
          return false;
      }
    }

    return true;
  }

  return true;
}

export default function Transpiler(ast: T.File, lineDetail: boolean, stack_size?: number) {
  if(ast.program.body.length < 1)
    return null; 

  detailLines = lineDetail;

  let depth = 0;

  if(!stack_size)
    code += '1024 0 \n \n' + initStates;
  else code += stack_size + ' 0 \n \n' + initStates;

  for(let i = 0; i < ast.program.body.length; i++) {
    const node = ast.program.body[i];
    Traverse(node, 'root');

    block = EBlock.NONE;
  }   

  if(errors.length > 0) {
    errors.forEach(e => {
      console.log(`ERROR: at ${e.node} - ${e.message} at ${e.location.filename} in line ${e.location.start.line}`);
    })
  }

  return code;
}