import * as T from '@babel/types';
import { EBlock, EState, IActor, IBlock, IError, IFunction, ILabel, IType, IVar, TClassType, TVar } from './types';
import { escape } from 'querystring';
import { funcTranslator, IFuncTranslation, initCode, initStates } from './translation';
import './defs/types';
import { CON_NATIVE_FLAGS, nativeFunctions, nativeVars, EMoveFlags, CON_NATIVE_FUNCTION, CON_NATIVE_TYPE } from './defs/native';

const errors: IError[] = [];
var detailLines = false;
var code = initCode;

var original = '';

var block: EBlock = EBlock.NONE; //Major block
var bBlock: IBlock[] = [];
var vars: IVar[] = [];
var state: EState = EState.NONE;
var actors: IActor[] = [];
var curActor: IActor = {
  name: '',
  picnum: -1,
  enemy: false,
  extra: 0,
  export_name: ''
}

var funcs: CON_NATIVE_FUNCTION[] = [];
var types: IType[] = [];

var sp = -1;
var bp = 0

var ra: any = 0;
var rb: any = 0;
var rc: any = null;

var reserved_extra_space = 30;
var minimum_array_size = 8; //For undefined sizes only

var typeCheck = '';

var stack: number[] = [];

var labels: ILabel[] = [];

var depth = 0;

function Line(loc: T.SourceLocation) {
  if(detailLines) {
    let text = '/* \n' + original.slice(loc.start.index, loc.end.index + 1);

    if(text.at(-1) == '\n')
      return text + '*/ \n';
    
    return text + '\n*/ \n';
  }

  return '';
}

function CalculateObjArraySize(size: number) {
  return Math.ceil(size * (1.0 + (reserved_extra_space / 100.0)));
}

function GetVar(name: string) {
  let variable = vars.find(e => e.name == name && e.block == bBlock.length - 1);

  if(!variable)
    variable = vars.find(e => e.name == name && e.global);

  return variable;
}

function GetObject(name: string, array = false) {
  let variable = vars.find(e => (array ? (e.name == name && e.object_name == '_array') : e.object_name == name) && e.object && e.block == bBlock.length - 1);

  if(!variable)
    variable = vars.find(e => (array ? (e.name == name && e.object_name == '_array') : e.object_name == name) && e.object && e.global);

  return variable;
}

function GetVarIndex(name: string) {
  let variable = vars.findIndex(e => e.name == name && e.block == bBlock.length - 1);

  if(variable == -1)
    variable = vars.findIndex(e => e.name == name && e.global);

  return variable;
}

function GetVarType(node: T.Identifier) {
  if(node.type == 'Identifier') {
    if(node.typeAnnotation?.type == 'TSTypeAnnotation') {
      const type = node.typeAnnotation.typeAnnotation;
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
      } else if(type.type == 'TSArrayType') {
        const type2 = type.elementType;
        if(type2.type == 'TSTypeReference') {
          switch((type2.typeName as T.Identifier).name) {
            case 'TLabel':
              return 'array_labels';

            default:
              const t = types.find(e => e.name == (type2.typeName as T.Identifier).name);

              if(!t)
                return null;

              return {
                array: true,
                type: t
              }
          }
        }
      }

      switch(type.type) {
        case 'TSNumberKeyword':
          return 'integer';

        case 'TSStringKeyword':
          return 'string'
      }
    }
  }

  return 'any';
}

function StartBlock(name: string, type: TClassType, loc: T.SourceLocation): number {
  if(block != EBlock.NONE)
    return 0;

  if(name.charAt(0) == name.charAt(0).toUpperCase()) {
    errors.push({
      type: 'error',
      node: type,
      location: loc ,
      message: 'Classes must always start with a lower case character'
    });
    return -1;
  }

  switch(type) {
    case 'CActor':
      const actor: IActor = {
        name,
        extra: 0,
        picnum: -1,
        enemy: false,
        export_name: `${name.charAt(0).toUpperCase()}${name.slice(1)}`
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

function GC_FreeHeap(block: IBlock) {
  code += `state _CheckHeapUse \n`;
}

function ReturnFromFunction() {
  const b =  bBlock.at(-1);

  if(!b) {
    console.log(`Tried to return from a block, but it's not even in one`);
    return;
  }

  if(b.name != 'constructor')
    GC_FreeHeap(b);

  if(b.type == EBlock.ACTOR && b.name != 'constructor')
    code += `set rbp ${b.base} \nset rsp ${b.stack} \n`;
  else if(b.type == EBlock.FUNCTION && b.name != 'constructor')
    code += `set rsp rbp \nstate pop \nset rbp ra \n`;

  let diff = b.type == EBlock.FUNCTION ? sp - b.stack - 2 - b.args : sp - b.stack;
  vars.splice(vars.length - 1 - diff, diff);

  sp = b.type == EBlock.FUNCTION ? b.stack - 2 - b.args : b.stack;
  bp = b.type == EBlock.FUNCTION ? b.stack - 1 - b.args : b.base;
}

function EndBlock() {
  const b =  bBlock.at(-1);
  if(!b) {
    console.log(`Tried closing a block without opening one`);
    return;
  }

  if(b.state != EState.TERMINATED)
    ReturnFromFunction();

  switch(b.type) {
    case EBlock.ACTOR:
      code += 'enda \n \n';
      break;

    case EBlock.FUNCTION:
    case EBlock.STATE:
      code += 'ends \n \n';
      break;

    case EBlock.EVENT:
      code += 'endevent \n \n';
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
        native: 0,
        index: -2
      };

    if(node.object.type == 'Identifier')
      object = node.object.loc.identifierName as string;
    else if(node.object.type == 'ThisExpression')
      object = 'this';
    
    if(!node.property.loc)
      return {
        native: 0,
        index: -2
      };

    func = node.property.loc.identifierName as string;
  }

  let conFunc: number = -1;
  let native = 1;
  
  if(object == 'this') {
    if(block == EBlock.ACTOR) {
      conFunc = nativeFunctions.findIndex(e => e.name == func);

      if(conFunc == -1) {
        conFunc = funcs.findIndex(e => e.name == func);

        if(conFunc != -1)
          native = 2;
      }
    }
  } else {
    native = 0;
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

      const variable = GetVarIndex(e.name);

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

    const variable = GetVarIndex(args[4].loc?.identifierName as string);

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

      const variable = GetVarIndex(e.name);

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

      const variable = GetVarIndex(e.name);

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

  if(node.type == 'TSTypeAliasDeclaration') {
    code += Line(node.loc as T.SourceLocation);
    let name = '';
    let aliasTo: 'object' | 'number' | 'string' = 'number';
    let size = 0;

    if(node.id.type == 'Identifier')
      name = node.id.name;

    if(node.typeAnnotation.type == 'TSTypeLiteral') {
      aliasTo = 'object';
      size = node.typeAnnotation.members.length;
    }

    types.push({
      name,
      aliasTo,
      size
    });

    return true;
  }

  if(node.type == 'ReturnStatement') {
    code += Line(node.loc as T.SourceLocation);
    if(node.argument) {
      const a = node.argument;

      if(a.type == 'Identifier') {
        const variable = GetVar(a.name);

        if(!variable) {
          errors.push({
            type: 'error',
            node: node.type,
            location: node.loc as T.SourceLocation,
            message: `Unknown keyword or variable ${a.name} at return statement`
          });
          return false;
        }

        if(variable.arg !== undefined)
          code += `set rb r${variable.arg} \n`;
        else code += `set ri rsp \nsub ri ${sp - variable.pointer} \nset rb stack[ri] \n`;
      } else {
        if(!Traverse(a, mode))
          return false;

        if(a.type != 'CallExpression')
          code += `set rb ra \n`;
      }

    }

    ReturnFromFunction();

    if((bBlock.at(-1) as IBlock).type == EBlock.FUNCTION)
      code += `terminate \n`;
    else code += `break \n`;
    return true;
  }

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
      let f: CON_NATIVE_FUNCTION;

      if(func.native == 1)
        f = nativeFunctions[func.index];
      else f = funcs[func.index];

      if(mode == 'conditional' && !f.returns) {
        errors.push({
          type: 'warning',
          node: node.type,
          location: node.loc as T.SourceLocation,
          message: `Function ${f.name} has no return value to be used in a If statement`
        });
      }

      const args = node.arguments;

      if(args.length < f.arguments.length) {
        for(let i = 0; i < f.arguments.length; i ++) {
          if(!args[i] && !(f.arguments[i] & CON_NATIVE_FLAGS.OPTIONAL)) {
            errors.push({
              type: 'error',
              node: node.type,
              location: node.loc as T.SourceLocation,
              message: `Missing parameters in function`
            });
            return false;
          }
        }
      }

      let fn = ''

      if(args.length > 0) {
        let params: string = '';

        if(f.arguments.find(e => e & CON_NATIVE_FLAGS.VARIABLE))
          code += `state pushr${f.arguments.length} \n`;

        let optional = false;

        for(let i = 0; i < args.length; i++) {
          const a = args[i];
          optional = false;
          let codeB = ''

          if(f.arguments[i] & CON_NATIVE_FLAGS.OPTIONAL) {
            f.arguments[i] -= CON_NATIVE_FLAGS.OPTIONAL;
            optional = true;
          }

          if(f.arguments[i] & CON_NATIVE_FLAGS.FUNCTION) {
            codeB = code;
            code = '';
          }

          if(a.type == 'ArrowFunctionExpression') {
            if(a.body.type == 'BlockStatement') {
              depth++;
              for(let i = 0; i < a.body.body.length; i++) {
                if(!Traverse(a.body.body[i], 'function_body'))
                  return false;
              }
              depth--;
            }
          }

          if(a.type == 'NumericLiteral') {
            if(f.arguments[i] == CON_NATIVE_FLAGS.LABEL) {
              errors.push({
                type: 'error',
                node: node.type,
                location: node.loc as T.SourceLocation,
                message: `Wrong type of parameter for argument for function ${f.name}`
              });
              if(optional)
                f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;
              return false;
            }

            if(f.arguments[i] == CON_NATIVE_FLAGS.CONSTANT) {
              params += `${Math.trunc(a.value)}`;
              if(optional)
                f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;
              continue;
            }

            code += `set r${i} ${a.value} \n`;
          }

          if(a.type == 'Identifier') {
            if(f.arguments[i] == CON_NATIVE_FLAGS.LABEL) {
              errors.push({
                type: 'error',
                node: node.type,
                location: node.loc as T.SourceLocation,
                message: `Wrong type of parameter for argument for function ${f.name}`
              });
              if(optional)
                f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;
              return false;
            }

            //Try looking for an actor before trying variables
            if(f.arguments[i] & CON_NATIVE_FLAGS.ACTOR) {
              const actor = actors.find(e => e.export_name == a.name);

              if(actor) {
                code += `set r${i} ${actor.picnum} \n`;
                params += `r${i} `;
                continue;
              }
            }

            const variable = GetVar(a.name);

            if(!variable) {
                errors.push({
                  type: 'error',
                  node: node.type,
                  location: node.loc as T.SourceLocation,
                  message: `Unknown keyword or variable at function ${f.name}`
                });
                if(optional)
                  f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;
                return false;
            }

            if(f.arguments[i] == CON_NATIVE_FLAGS.CONSTANT) {
              errors.push({
                type: 'warning',
                node: node.type,
                location: node.loc as T.SourceLocation,
                message: `Using a variable instead of a constant value at ${f.name}. Initialized value will be used`
              });

              params += `${variable.init} `;
              if(optional)
                f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;
              continue;
            }

            code += `set ri rsp \n${(sp - variable.pointer) != 0
              ? `set ri rsp \nsub ri ${sp - variable.pointer} \nset ra stack[ri] \n` 
              : `set ra stack[rsp]`} \nset r${i} ra \n`;
          }

          if(a.type == 'BinaryExpression' || a.type == 'MemberExpression') {
            if(f.arguments[i] == CON_NATIVE_FLAGS.LABEL) {
              errors.push({
                type: 'error',
                node: node.type,
                location: node.loc as T.SourceLocation,
                message: `Wrong type of parameter for argument for function ${f.name}`
              });
              if(optional)
                f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;
              return false;
            }

            if(f.arguments[i] == CON_NATIVE_FLAGS.CONSTANT
              && !(a.type == 'MemberExpression' && (a.object as T.Identifier).name == 'EMoveFlags'))
              errors.push({
                type: 'warning',
                node: node.type,
                location: node.loc as T.SourceLocation,
                message: `Detected an expression or a variable instead of a constant value at ${f.name}. Result of resolved expression or initilization value will be used`
              });

            if(!Traverse(a, f.arguments[i] == CON_NATIVE_FLAGS.VARIABLE ? 'function_params' : 'retrieval',
              f.arguments[i] == CON_NATIVE_FLAGS.VARIABLE ? i : undefined)) {
              if(optional)
                f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;
              return false;
            }

            if(f.arguments[i] == CON_NATIVE_FLAGS.CONSTANT) {
              params += `${ra} `;
              if(optional)
                f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;
              continue;
            }
          }

          if(a.type == 'CallExpression') {
            if(f.arguments[i] == CON_NATIVE_FLAGS.LABEL || f.arguments[i] == CON_NATIVE_FLAGS.CONSTANT) {
              if(f.arguments[i] == CON_NATIVE_FLAGS.LABEL) {
                if(a.callee.type != 'Identifier' || a.callee.name != 'Label') {
                  errors.push({
                    type: 'error',
                    node: node.type,
                    location: node.loc as T.SourceLocation,
                    message: `Wrong type of parameter for argument label for function ${f.name}`
                  });
                  if(optional)
                    f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;
                  return false;
                }
              }

              if(f.arguments[i] == CON_NATIVE_FLAGS.CONSTANT)
                errors.push({
                  type: 'warning',
                  node: node.type,
                  location: node.loc as T.SourceLocation,
                  message: `Detected an expression or a variable instead of a constant value at ${f.name}. Result of resolved expression or initilization value will be used`
                });

              if(!Traverse(a, 'retrieval')) {
                if(optional)
                  f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;
                return false;
              }

              params += `${ra} `;
              if(optional)
                f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;
              continue;
            }

            if(!Traverse(a, 'function_params', i)) {
              if(optional)
                f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;
              return false;
            }
          }

          if(optional)
            f.arguments[i] |= CON_NATIVE_FLAGS.OPTIONAL;

          if(f.arguments[i] & CON_NATIVE_FLAGS.FUNCTION) {
            fn = code;
            code = codeB;
          }

          params += `r${i} `;
        }

        if(args.length < f.arguments.length && f.arguments_default) {
          for(let i = args.length; i < f.arguments.length; i++) {
            code += `set r${i} ${f.arguments_default[i]} \n`;
            params += `r${i} \n`;
          }
        }

        code += `${typeof f.code === 'function' ? f.code(true, fn) : `${f.code} ${params} \n`}`;
        if(f.arguments.find(e => e & CON_NATIVE_FLAGS.VARIABLE))
          code += `state popr${f.arguments.length} \n`;
      } else code += `${typeof f.code === 'function' ? f.code() : `${f.code} \n`}`;

      typeCheck = '';
      if(f.returns && f.return_type)
        typeCheck = f.return_type;
    } else {
      const f = funcTranslator[func.index];
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

          if(a.type == 'CallExpression') {
            const newMode = f.params[i] == 'variable' ? 'function_params' : 'retrieval';
            if(!Traverse(a, newMode, i))
              return false;
          }

          if(a.type == 'Identifier') {
            const variable = GetVar(a.name);

            if(!variable) {
              errors.push({
                type: 'error',
                node: node.type,
                location: node.loc as T.SourceLocation,
                message: `Unknown keyword or variable at function ${node.callee.loc?.identifierName}`
              });
              return false;
            }

            code += `${(sp - variable.pointer) != 0
              ? `set ri rsp \nsub ri ${sp - variable.pointer} \nset r${i} stack[ri] \n` 
              : `set r${i} stack[rsp] \n`}`;
          }

          params += `r${i} `;
        }

        code += `${f.conName} ${params} \n`;
        code += `state popr${args.length} \n`;
      } else code += `${f.conName} \n`;

      typeCheck = '';
    }

    if(typeof argument !== 'undefined')
      code += `set r${argument} rb \n`;

    return true;
  }

  if(node.type == 'BinaryExpression' || node.type == 'LogicalExpression') {
    let typeCheck2 = typeCheck;
    typeCheck = '';
    const vals: any[] = [0, 0];
    for(let i = 1; i >= 0; i--) {
      const side = i == 1 ? node.right : node.left;

      //if(mode != 'retrieval' && i == 0)
        //code += `set rb ra \n`;

      if(side.type == 'NumericLiteral') {
        //if(mode == 'retrieval')
        vals[i] = side.value;
        if(mode != 'retrieval')
          code += `set r${i == 0 ? 'a' : 'b'} ${side.value} \n`; 
      } 

      //retrieval cannot happen with call expressions
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

        let variable = GetVar(vName);

        if(!variable) {
          errors.push({
            type: 'error',
            node: node.type,
            location: node.loc as T.SourceLocation,
            message: `Unknown variable or keyword ${vName}`
          });
          return false;
        }

        //if(mode == 'retrieval')
        vals[i] = variable.init;
        if(mode != 'retrieval') {
          if(variable.arg != undefined && mode != 'function_params')
            code += `set ra r${variable.arg} \n`;
          else code += `${(sp - variable.pointer) != 0
            ? `set ri rsp \nsub ri ${sp - variable.pointer} \nset ra stack[ri] \n` 
            : `set ra stack[rsp] \n`}`;
        }
      }

      if(side.type == 'MemberExpression' || side.type == 'BinaryExpression') {
        if(!Traverse(side, mode))
          return false;

        //if(mode == 'retrieval')
        vals[i] = ra;

        if(i == 1 && mode != 'retrieval')
          code += `set rb ra \n`;
      }

      if(node.type == 'LogicalExpression') {
        if(i == 1)
          code += 'state push \n';
        else code += 'set rb ra \nstate pop \n'
      }
    }

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

    if(mode != 'retrieval') {
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

      //Search for stack objects
      if(!object) {
        object = GetObject(o.name, node.computed);

        if(!object) {
          errors.push({
            type: 'error',
            node: node.type,
            location: node.loc as T.SourceLocation,
            message: `Object or array ${o.name} does not exist or hasn't been declared yet`
          });
          return false;
        }
      }
    }

    /*
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
    */

    if(p.type == 'Identifier') {
      if(o.type == 'ThisExpression') {
        if(block == EBlock.ACTOR) {
          let v = nativeVars.find(e => (e.name == p.name && (e.var_type & CON_NATIVE_TYPE.actor || e.var_type & CON_NATIVE_TYPE.variable )));
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
          else {
            if(v.var_type & CON_NATIVE_TYPE.actor) {
              if(!(v.var_type & CON_NATIVE_TYPE.variable))
                code += `geta[].${v.code} ra \n`
              else  code += `set ra ${v.code} \n`;
            }
          }
        }
      } else if(o.type == 'MemberExpression') {
        let obj = '';
        let index = '';
        if(o.object.type == 'Identifier')
          obj = o.object.name;

        if(obj == 'sprites' || obj == 'player') {
          if(!o.computed) {
            errors.push({
              type: 'error',
              node: node.type,
              location: node.loc as T.SourceLocation,
              message: `Missing index for ${obj} array`
            });
            return false;
          }

          if(o.property.type == 'NumericLiteral')
            index = `[${o.property.value}]`;

          if(o.property.type == 'StringLiteral') {
            const l = labels.find(e => e.label == (o.property as T.StringLiteral).value);

            if(!l) {
              errors.push({
                type: 'error',
                node: node.type,
                location: node.loc as T.SourceLocation,
                message: `Keyword, label or variable ${o.property.value} does not exist`
              });
              return false;
            }

            index = `[${o.property.value}]`;
          }

          if(o.property.type == 'Identifier') {
            if(o.property.name == 'RETURN')
              index += '[RETURN]';
            else {
              const variable = GetVar(o.property.name);

              if(!variable) {
                errors.push({
                  type: 'error',
                  node: node.type,
                  location: node.loc as T.SourceLocation,
                  message: `Keyword, label or variable ${o.property.name} does not exist`
                });
                return false;
              }

              const loc = sp - variable.pointer;
              
              if(loc == 0)
                index = '[stack[rsp]]';
              else {
                code += `set ri rsp \nsub ri ${loc} \n`;
                index = '[stack[ri]]';
              }
            }
          }

          let v = nativeVars.find(e => (e.name == p.name 
            && (obj == 'sprites' && e.var_type & CON_NATIVE_TYPE.actor || e.var_type & CON_NATIVE_TYPE.variable)));
          if(!v) {
            errors.push({
              type: 'error',
              node: node.type,
              location: node.loc as T.SourceLocation,
              message: `Property ${p.name} does not exist in CActor or its own actor`
            });
            return false;
          }

          if(!(v.var_type & CON_NATIVE_TYPE.variable)) {
            if(mode == 'assignment')
              code += `set${obj == 'sprites' ? 'a' : 'p'}${index}.${v.code} ra \n`;
            else code += `get${obj == 'sprites' ? 'a' : 'p'}${index}.${v.code} ra \n`
          } else {
            if(mode == 'assignment')
              code += `set${obj == 'sprites' ? 'actorvar' : 'playervar'}${index}.${v.code} ra`
            else code += `get${obj == 'sprites' ? 'actorvar' : 'playervar'}${index}.${v.code} ra`
          }
        }
      } else {
        if(mode == 'retrieval') {
          if(o.type == 'Identifier')
            ra = object[p.name]

          //if(o.type == 'MemberExpression')
            //ra = ra[p.name];
        } else {
          const obj = object as IVar;
          let pointer = 0;

          if(node.computed) {
            const variable = GetVar(p.name);

            if(!variable) {
              errors.push({
                type: 'error',
                node: node.type,
                location: node.loc as T.SourceLocation,
                message: `Variable ${p.name} does not exist or hasn't been declared yet`
              });
              return false;
            }

            pointer = variable.pointer;

            const index = sp - pointer;
            if(mode == 'assignment') {
              if(!index)
                code += `set ri stack[rsp] \nadd ri ${obj.pointer} \nsetarray heap[ri] ra \n`;
              else code += `state push \nset ri rsp \nsub ri ${index} \nset ra stack[ri] \nset ri ra \nstate pop \nadd ri ${obj.pointer} \nsetarray heap[ri] ra \n`;
            } else {
              if(!index)
                code += `set ri stack[rsp] \nadd ri ${obj.pointer} \nset ra heap[ri] \n`;
              else code += `state push \nset ri rsp \nsub ri ${index} \nset ra stack[ri] \nset ri ra \nstate pop \nadd ri ${obj.pointer} \nset ra heap[ri] \n`;
            }
          } else {
            //Find property
            const property = obj.object[p.name];

            if(!property) {
              errors.push({
                type: 'error',
                node: node.type,
                location: node.loc as T.SourceLocation,
                message: `Property ${p.name} does not exist in object ${obj.object_name}`
              });
              return false;
            }

            pointer = property.index;
          }

          const index = sp - obj.pointer;

          if(mode == 'assignment') {
            if(!index)
              code += `set ri stack[rsp] \nadd ri ${pointer} \nsetarray heap[ri] ra \n`;
            else code += `state push \nset ri rsp \nsub ri ${index} \nset ra stack[ri] \nset ri ra \nstate pop \nadd ri ${pointer} \nsetarray heap[ri] ra \n`;
          } else {
            if(!index)
              code += `set ri stack[rsp] \nadd ri ${pointer} \nset ra heap[ri] \n`;
            else code += `state push \nset ri rsp \nsub ri ${index} \nset ra stack[ri] \nset ri ra \nstate pop \nadd ri ${pointer} \nset ra heap[ri] \n`;
          }
        }
      }
    } else {
      const obj = object as IVar;

      if(node.computed) {
        if(p.type == 'NumericLiteral') {
          const i = p.value;

          if(obj.size && i > obj.size) {
            errors.push({
              type: 'warning',
              node: node.type,
              location: node.loc as T.SourceLocation,
              message: `Array index is bigger than its size`
            });
            return false;
          }

          const index = sp - obj.pointer;

          if(mode == 'assignment') {
            if(!index)
              code += `set ri stack[rsp] \nadd ri ${i} \nsetarray heap[ri] ra \n`;
            else code += `state push \nset ri rsp \nsub ri ${index} \nset ra stack[ri] \nset ri ra \nstate pop \nadd ri ${i} \nsetarray heap[ri] ra \n`;
          } else {
            if(!index)
              code += `set ri stack[rsp] \nadd ri ${i} \nset ra heap[ri] \n`;
            else code += `state push \nset ri rsp \nsub ri ${index} \nset ra stack[ri] \nset ri ra \nstate pop \nadd ri ${i} \nset ra heap[ri] \n`;
          }
        } else if(p.type == 'MemberExpression') {
          if(mode == 'assignment')
            code += 'state push \n';
          if(!Traverse(p, 'function_body'))
            return false;

          if(mode == 'assignment') {
            code += `set ri ra \nstate pop \nsetarray stack[ri] ra \n`;
          } else {
            code += `set ri ra \nset ra stack[ri] \n`;
          }
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
        if(mode == 'retrieval') {
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
        } else if(mode == 'declaration') {
          const v = vars.at(-1) as IVar;
          const pName = (p.key as T.Identifier).name;
          //let v2: IVar;

          if(i == 0) {
            v.object_name = v.name;
            v.name = pName;
            v.size = CalculateObjArraySize(node.properties.length);
            v.object = new Object();
            code += `state pushr1 \nset r0 ${v.size} \nstate alloc \nset stack[rsp] rb \nstate popr1 \n`;
            v.object[pName] = { value: 0, index: 0 };
            //v2 = v;
          } else {
            /*sp++;
            v2 = {
              name: pName,
              block: v.block,
              global: v.global,
              constant: v.constant,
              type: v.type,
              init: 0,
              pointer: sp,
              object_name: v.object_name,
              object: v
            }

            vars.push(v2);*/
            v.object[pName] = { value: 0, index: i};
          }

          //code += `add rsp 1 \nsetarray stack[rsp] 0 \n`;

          if(p.value.type == 'StringLiteral' || p.value.type == 'NumericLiteral') {
            //v2.init = p.value.value;
            code += `set ri stack[rsp] \nadd ri ${i} \nsetarray heap[ri] ${p.value.value} \n`;
            v.object[pName].value = p.value.value;
          }

          if(p.value.type == 'BinaryExpression' || p.value.type == 'MemberExpression') {
              if(!Traverse(p.value, mode)) {
                vars.pop();
                sp--;
                return false;
              }

              //v2.init = ra;
              v.object[pName].value = ra;
              //code += `setarray stack[rsp] ra \n`
              code += `set ri stack[rsp] \nadd ri ${i} \nsetarray heap[ri] ra \n`;
          }
        }
      }
    }
  }

  if(node.type == 'VariableDeclaration') {
    code += Line(node.loc as T.SourceLocation)
    if(node.declarations[0].type == 'VariableDeclarator') {
      if(node.declarations[0].id.type == 'Identifier') {
        const v = node.declarations[0].id;
        const vType = GetVarType(node.declarations[0].id);
        if(!vType) {
          errors.push({
            type: 'error',
            node: node.type,
            location: node.loc as T.SourceLocation,
            message: `Wrong or missing type for variable ${v.name}`
          });
          return false;
        }

        sp++;

        const variable: IVar = {
          name: v.name,
          global: mode == 'root',
          constant: node.kind == 'const',
          //@ts-ignore
          type: typeof vType === 'string' ? vType : vType.name,
          init: 0,
          pointer: sp,
          block: bBlock.length - 1
        }

        vars.push(variable);

        if(node.declarations[0].init) {
          const traverseMode = (state == EState.INIT || (bBlock.length > 0 && bBlock[bBlock.length - 1].name == 'constructor'))
            ? 'retrieval' : 'declaration';

          if(node.declarations[0].init.type == 'NumericLiteral' || node.declarations[0].init.type == 'StringLiteral') {
            variable.init = node.declarations[0].init.value;

            if(mode != 'constructor') {
              code += `add rsp 1 \nsetarray stack[rsp] ${variable.init} \n`;
            }
          } if(node.declarations[0].init.type == 'ArrayExpression') {
            const a = node.declarations[0].init;
            
            if(a.elements[0]) {
              if(a.elements[0].type == 'NumericLiteral') {
                variable.object_name = '_array';
                variable.size = CalculateObjArraySize(a.elements[0].value);
                variable.object = new Array(a.elements[0].value);
                variable.object[0] = 0;
                variable.init = 0;

                code += `state pushr1 \nset r0 ${variable.size} \nstate alloc \nadd rsp1 \nset stack[rsp] rb \nstate popr1 \n`;

                for(let i = 1; i < variable.size; i++) {
                  variable.object[i] = 0;
                  code += `set ri stack[rsp] \nadd ri ${i} \nsetarray heap[ri] 0 \n`;

                  //code += `add rsp 1 \nsetarray stack[rsp] 0 \n`;
                }
              }
            }
          } if (node.declarations[0].init.type == 'NewExpression') {
            const n = node.declarations[0].init;

            if(n.callee.type == 'Identifier') {
              //Special case for array
              if(n.callee.name == 'Array') {
                const a = n.arguments;

                if(a.length == 0) {
                  code += `state pushr1 \nset r0 ${typeof vType === 'string' ? 2 : CalculateObjArraySize(vType.type.size)}\nstate alloc \nstate popr1 \nadd rsp 1 \nsetarray stack[rsp] rb \n`;
                  variable.init = [];
                  variable.object_name = '_array_heap';
                } else {
                  if(a[0].type == 'NumericLiteral') {
                    code += `state pushr1 \nset r0 ${typeof vType === 'string' ? a[0].value : CalculateObjArraySize(vType.type.size * a[0].value)}\nstate alloc \nstate popr1 \nadd rsp 1 \nsetarray stack[rsp] rb \n`;
                    variable.size = CalculateObjArraySize(a[0].value);
                    variable.init = 0;
                    variable.object_name = '_array';

                    code += `add rsp 1 \nsetarray stack[rsp] 0 \n`;

                    for(let i = 1; i < variable.size; i++) {
                      sp++;
                      vars.push({
                        name: variable.name,
                        global: variable.global,
                        block: variable.block,
                        constant: variable.constant,
                        type: variable.type,
                        pointer: sp,
                        init: 0,
                        object: variable,
                        object_name: '_array',
                      });

                      code += `add rsp 1 \nsetarray stack[rsp] 0 \n`;
                    }
                  }
                }
              }

            }
            
          } else {        
            if(!Traverse(node.declarations[0].init, traverseMode)) {
              vars.pop();
              sp--;
              return false;
            }

            if(node.declarations[0].init.type != 'ObjectExpression')
              variable.init = ra;

            if(mode != 'retrieval' && traverseMode != 'retrieval' && node.declarations[0].init.type != 'ObjectExpression')
              code += `setarray stack[rsp] ra \n`;
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
      depth++
      for(let i = 0; i < node.consequent.body.length; i++) {
        if(!Traverse(node.consequent.body[i], 'function_body'))
          return false;
      }
      depth--
    }

    code += `} \n`;

    return true;
  }

  if(node.type == 'ExpressionStatement') {
    code += Line(node.loc as T.SourceLocation);
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

      let variable: IVar | undefined;

      if(exp.right.type == 'NumericLiteral')
        code += `set rb ${exp.right.value} \n`;
      else {
        if(!Traverse(exp.right, 'function_body'))
          return false;

        if(exp.right.type != 'CallExpression')
          code += `set rb ra \n`;
      }

      if(exp.left.type == 'Identifier') {
        variable = GetVar((exp.left as T.Identifier).name);

        if(!variable) {
          errors.push({
            type: 'error',
            node: node.type,
            location: node.loc as T.SourceLocation,
            message: `Unknown variable or keyword ${(exp.left as T.Identifier).name}`
          });
          return false;
        }

        if(variable.arg != undefined && mode != 'function_params')
          code += `set ra r${variable.arg} \n`;
        else code += `${(sp - variable.pointer) != 0
        ? `set ri rsp \nsub ri ${sp - variable.pointer} \nset ra stack[ri] \n` 
        : `set ra stack[rsp] \n`}`;
      }

      if(exp.left.type == 'MemberExpression') {
        if(!Traverse(exp.left, mode))
          return;
      }

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

      if(variable) {
        code += `${operator} ra rb \n${(sp - variable.pointer) != 0
          ? `set ri rsp \nsub ri ${sp - variable.pointer} \nsetarray stack[ri] ra \n`
          : `setarray stack[rsp] ra \n`}`;

        if(variable.arg != undefined)
          code += `set r${variable.arg} ra \n`;
      } else {
        if(exp.left.type == 'MemberExpression') {
          code += `${operator} ra rb \n`;

          if(!Traverse(exp.left, 'assignment'))
            return;
        }
      }
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
        base: bp,
        args: 0
      })

      depth++
      for(let i = 0; i < node.body.body.length; i++) {
        if(!Traverse(node.body.body[i], 'constructor')) {
          bBlock.pop();
          state = EState.NONE;
          return false;
        }
      }
      depth--

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
        base: bp,
        args: 0,
      });

      code += `useractor ${curActor.enemy ? 'enemy' : 'notenemy'} ${curActor.picnum} ${curActor.extra} ${curActor.first_action ? curActor.first_action.name : ''} \n`;
      code += `findplayer playerDist \n`;

      depth++
      for(let i = 0; i < node.body.body.length; i++) {
        if(!Traverse(node.body.body[i], 'function_body'))
          return false;
      }
      depth--

      if(node.body.body[node.body.body.length - 1].type == 'ReturnStatement')
        (bBlock.at(-1) as IBlock).state = EState.TERMINATED;

      EndBlock();

      return true;
    }

    if(node.body.type != 'BlockStatement') {
      errors.push({
        type: 'error',
        node: node.type,
        location: node.loc as T.SourceLocation,
        message: 'Missing function body'
      });
      return false;
    }

    const f: CON_NATIVE_FUNCTION = {
      name: (node.key as T.Identifier).name,
      returns: false,
      return_type: 'variable',
      arguments: [],
      code: () => {
        return `state ${curActor.picnum}_${(node.key as T.Identifier).name} \n`;
      }
    };

    code += `\ndefstate ${curActor.picnum}_${(node.key as T.Identifier).name} \n`;

    code += `set ra rbp \nstate push \nset rbp rsp \n`

    sp += 1 + node.params.length;
    bp = sp;

    if(node.params.length > 0) {
      code += `state pushr${node.params.length} \n`
      for(let i = 0; i < node.params.length; i++) {
        const p = node.params[i];

        if(p.type == 'Identifier') {
          const type = GetVarType(p);

          if(!type) {
            errors.push({
              type: 'error',
              node: node.type,
              location: node.loc as T.SourceLocation,
              message: `Undefined type ${p.type}`
            });
            return false;
          }

          sp++;
          switch(type) {
            case 'integer':
              f.arguments.push(CON_NATIVE_FLAGS.VARIABLE);
              break;

            case 'string':
              f.arguments.push(CON_NATIVE_FLAGS.STRING);
              break;

            case 'label':
              f.arguments.push(CON_NATIVE_FLAGS.LABEL);
              break;  

            case 'array_labels':
              f.arguments.push(CON_NATIVE_FLAGS.ARRAY | CON_NATIVE_FLAGS.LABEL);
              break;

            default:
              if(typeof type !== 'string') {
                f.arguments.push(CON_NATIVE_FLAGS.OBJECT | (type.array ? CON_NATIVE_FLAGS.ARRAY : 0));
              }

          }

          vars.push({
            global: false,
            block: bBlock.length,
            name: p.name,
            //@ts-ignore
            type: typeof type === 'string' ? type : type.name,
            constant: false,
            pointer: sp,
            arg: i,
            init: 0,
          });
        }
      }
    }

    if(node.returnType) {
      const r = node.returnType;

      if(r.type == 'TSTypeAnnotation') {
        switch(r.typeAnnotation.type) {
          case 'TSNumberKeyword':
            f.return_type = 'variable'
            break;

          case 'TSTypeReference':
            const t = r.typeAnnotation.typeName;
            if(t.type == 'Identifier') {
              switch(t.name) {
                case 'pointer':
                  f.return_type = 'pointer'
                  break;
              }
            }
            break;
        }
      }

      f.returns = true;
    }

    bBlock.push({
      type: EBlock.FUNCTION,
      state: EState.BODY,
      name: (node.key as T.Identifier).name,
      stack: sp,
      base: sp,
      args: f.arguments.length
    });

    funcs.push(f);

    (bBlock.at(-1) as IBlock).state = EState.BODY;

    depth++
    for(let i = 0; i < node.body.body.length; i++) {
      if(!Traverse(node.body.body[i], 'function_body'))
        return false;
    }
    depth--

    if(node.body.body[node.body.body.length - 1].type == 'ReturnStatement')
      (bBlock.at(-1) as IBlock).state = EState.TERMINATED;

    EndBlock();

    return true;

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

    const starter: number = StartBlock(node.id?.name, node.superClass?.loc?.identifierName as TClassType, node.loc as T.SourceLocation);

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

export default function Transpiler(ast: T.File, lineDetail: boolean, stack_size?: number, file?: string) {
  if(ast.program.body.length < 1)
    return null; 

  detailLines = lineDetail;

  original = file as string;

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
      console.log(`${e.type.toUpperCase()}: at ${e.node} - ${e.message} at ${e.location.filename} in line ${e.location.start.line}`);
    })
  }

  return code;
}