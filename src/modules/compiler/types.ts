import { CON_NATIVE_FLAGS } from '../../sets/TCSet100/native';

export enum EBlock {
    ACTOR,
    EVENT,
    BRANCH,
    FUNCTION,
    STATE,
    NONE
}

export enum EState {
    INIT,
    PARAMS,
    BODY,
    TERMINATED,
    NONE
}

export interface IBlock {
    type: EBlock;
    state: EState;
    name: string;
    locals?: 0;
    args: number;
    stack: number;
    base: number;
}

interface IArg {
    type: CON_NATIVE_FLAGS,
    name: string,
    variable: IVar
}

export type TObjectType = {
    name: string;
    type: 'string' | 'integer' | 'label' | 'object',
    array: boolean,
    object?: TObjectType[],
    size?: number
}

export interface IFunction {
    name: string,
    args: IArg[]
    returns: boolean,
    return_type: CON_NATIVE_FLAGS,
    object: 'this' | 'global'
}

export interface IVar {
    global: boolean,
    block: number,
    name: string,
    constant: boolean,
    type: 'integer' | 'string' | 'action' | 'move' | 'ai' | 'label' | 'any',
    typeRef?: IType,
    init: any,
    pointer: number,
    object_name?: string, //If object_name is _array, then it's an array
    object?: any, //If empty but object_name is defined, then it's the start of the object,
    //otherwise it's an array of objects, holding all the possibilities
    static?: true,
    size?: number, //For objects and arrays
    arg?: number,
    heap: boolean,
    returned?: boolean //So the transpiler knows that the variable is a return value - works best with objects and arrays
}

export type TVar = {
    type: string,
    value: string | number | boolean
}

export interface IType {
    name: string,
    aliasTo: 'object' | 'number' | 'string',
    size: number,
    object?: TObjectType[]
}

export type TClassType = 'CActor' | 'CEvent';

export interface ILabel {
    label: string,
    pointer: any
}

export enum Names {
    APLAYER = 1405,
    BLOOD = 1620,
    FIRELASER = 1625,
    JIBS6 = 2286
}

export type TEventPAE =
    'Game' | 'EGS' | 'Spawn' | 'KillIt' |
    'ResetPlayer' | 'LoadActor' | 'IncurDamage' |
    'FakeDoMoveThings' | 'World' | 'PreWorld' |
    'MoveSector' | 'MoveEffectors' |
    'RecogSound' | 'Sound' |
    'CheckTouchDamage' | 'CheckFloorDamage' | 'DamageHPlane' |
    'DamageSprite' | 'PostDamageSprite' | 'DamageWall' | 'DamageFloor' | 'DamageCeiling' |
    'ResetGotPics' | 'OperateActivators' | 'PreActorDamage';

export type TEventDE =
    'AnimateSprites' |
    'DisplayRest' | 'DisplayStart' | 'DisplayEnd' |
    'DisplaySBar' | 'DisplayCrosshair' |
    'DisplayRooms' | 'DisplayRoomsEnd' | 'DisplayRoomsCamera' | 'DisplayRoomsCameraTile' |
    'DisplayBonusScreen' |
    'DisplayMenu' | 'DisplayMenuRest' | 'DisplayInactiveMenu' | 'DisplayInactiveMenuRest' |
    'DisplayLoadingScreen' |
    'DisplayCursor' | 'DisplayLevelStats' | 'DisplayCameraOsd' |
    'DisplaySpit' | 'DisplayFist' | 'DisplayKnee' | 'DisplayKnuckles' |
    'DisplayScuba' | 'DisplayTip' | 'DisplayAccess' |
    'DisplayOverheadMapText' | 'DisplayOverheadMapPlayer' |
    'DisplayPointer' | 'DisplayBorder' |
    'DisplayWeapon' |
    'Screen' | 'UpdateScreenArea';

export type TEventIE =
    'LookLeft' | 'LookRight' | 'SoarUp' | 'SoarDown' |
    'Crouch' | 'Jump' | 'ReturnToCenter' |
    'LookUp' | 'LookDown' | 'AimUp' | 'AimDown' |
    'TurnLeft' | 'TurnRight' | 'TurnAround' |
    'StrafeLeft' | 'StrafeRight' |
    'MoveForward' | 'MoveBackward' |
    'SwimUp' | 'SwimDown' |
    'Use' | 'ProcessInput' |
    'PreUpdateAngles' | 'PostUpdateAngles';

export type TEventWE =
    'WeapKey1' | 'WeapKey2' | 'WeapKey3' | 'WeapKey4' | 'WeapKey5' |
    'WeapKey6' | 'WeapKey7' | 'WeapKey8' | 'WeapKey9' | 'WeapKey10' |
    'DoFire' | 'PressedFire' | 'Fire' | 'AltFire' | 'AltWeapon' |
    'FireWeapon' | 'PreWeaponShoot' | 'PostWeaponShoot' |
    'SelectWeapon' | 'ChangeWeapon' | 'PreviousWeapon' | 'NextWeapon' | 'LastWeapon' |
    'DrawWeapon' | 'Holster' | 'QuickKick' |
    'GetShotRange' | 'GetAutoAimAngle';

export type TEventPIE =
    'Inventory' | 'InventoryLeft' | 'InventoryRight' |
    'UseNightVision' | 'UseSteroids' |
    'HoloDukeOn' | 'HoloDukeOff' |
    'UseMedkit' | 'UseJetpack' |
    'ResetInventory' | 'ResetWeapons';

export type TEventME =
    'Init' | 'InitComplete' |
    'EnterLevel' | 'PreLevel' | 'NewGame' | 'PreGame' | 'NewGameCustom' |
    'LoadGame' | 'SaveGame' | 'PreLoadGame' | 'PostSaveGame' |
    'Logo' |
    'ActivateCheat' |
    'CheatGetSteroids' | 'CheatGetHeat' | 'CheatGetBoot' | 'CheatGetShield' |
    'CheatGetScuba' | 'CheatGetHoloduke' | 'CheatGetJetpack' | 'CheatGetFirstAid' |
    'ChangeMenu' | 'OpenMenuSound' |
    'SetDefaults' |
    'MainMenuScreen' | 'NewGameScreen' | 'EndLevelScreen' | 'ExitGameScreen' | 'ExitProgramScreen' |
    'CutScene' | 'PreCutScene' | 'SkipCutScene' |
    'PlayLevelMusicSlot' | 'ContinueLevelMusicSlot' |
    'MenuCursorLeft' | 'MenuCursorRight' | 'MenuCursorShade' | 'MenuShadeSelected' |
    'GetLoadTile' | 'GetMenuTile' | 'GetBonusTile' |
    'Capir' | 'ValidateStart';

export type TEvents = TEventPAE | TEventDE | TEventIE | TEventWE | TEventPIE | TEventME;

export const EventList: TEvents[] = [
    // PAE — Per-Actor Events
    'Game', 'EGS', 'Spawn', 'KillIt',
    'ResetPlayer', 'LoadActor', 'IncurDamage',
    'FakeDoMoveThings', 'World', 'PreWorld',
    'MoveSector', 'MoveEffectors',
    'RecogSound', 'Sound',
    'CheckTouchDamage', 'CheckFloorDamage', 'DamageHPlane',
    'DamageSprite', 'PostDamageSprite', 'DamageWall', 'DamageFloor', 'DamageCeiling',
    'ResetGotPics', 'OperateActivators', 'PreActorDamage',
    // DE — Display Events
    'AnimateSprites',
    'DisplayRest', 'DisplayStart', 'DisplayEnd',
    'DisplaySBar', 'DisplayCrosshair',
    'DisplayRooms', 'DisplayRoomsEnd', 'DisplayRoomsCamera', 'DisplayRoomsCameraTile',
    'DisplayBonusScreen',
    'DisplayMenu', 'DisplayMenuRest', 'DisplayInactiveMenu', 'DisplayInactiveMenuRest',
    'DisplayLoadingScreen',
    'DisplayCursor', 'DisplayLevelStats', 'DisplayCameraOsd',
    'DisplaySpit', 'DisplayFist', 'DisplayKnee', 'DisplayKnuckles',
    'DisplayScuba', 'DisplayTip', 'DisplayAccess',
    'DisplayOverheadMapText', 'DisplayOverheadMapPlayer',
    'DisplayPointer', 'DisplayBorder',
    'DisplayWeapon',
    'Screen', 'UpdateScreenArea',
    // IE — Input Events
    'LookLeft', 'LookRight', 'SoarUp', 'SoarDown',
    'Crouch', 'Jump', 'ReturnToCenter',
    'LookUp', 'LookDown', 'AimUp', 'AimDown',
    'TurnLeft', 'TurnRight', 'TurnAround',
    'StrafeLeft', 'StrafeRight',
    'MoveForward', 'MoveBackward',
    'SwimUp', 'SwimDown',
    'Use', 'ProcessInput',
    'PreUpdateAngles', 'PostUpdateAngles',
    // WE — Weapon Events
    'WeapKey1', 'WeapKey2', 'WeapKey3', 'WeapKey4', 'WeapKey5',
    'WeapKey6', 'WeapKey7', 'WeapKey8', 'WeapKey9', 'WeapKey10',
    'DoFire', 'PressedFire', 'Fire', 'AltFire', 'AltWeapon',
    'FireWeapon', 'PreWeaponShoot', 'PostWeaponShoot',
    'SelectWeapon', 'ChangeWeapon', 'PreviousWeapon', 'NextWeapon', 'LastWeapon',
    'DrawWeapon', 'Holster', 'QuickKick',
    'GetShotRange', 'GetAutoAimAngle',
    // PIE — Player Inventory Events
    'Inventory', 'InventoryLeft', 'InventoryRight',
    'UseNightVision', 'UseSteroids',
    'HoloDukeOn', 'HoloDukeOff',
    'UseMedkit', 'UseJetpack',
    'ResetInventory', 'ResetWeapons',
    // ME — Misc / Game-Lifecycle Events
    'Init', 'InitComplete',
    'EnterLevel', 'PreLevel', 'NewGame', 'PreGame', 'NewGameCustom',
    'LoadGame', 'SaveGame', 'PreLoadGame', 'PostSaveGame',
    'Logo',
    'ActivateCheat',
    'CheatGetSteroids', 'CheatGetHeat', 'CheatGetBoot', 'CheatGetShield',
    'CheatGetScuba', 'CheatGetHoloduke', 'CheatGetJetpack', 'CheatGetFirstAid',
    'ChangeMenu', 'OpenMenuSound',
    'SetDefaults',
    'MainMenuScreen', 'NewGameScreen', 'EndLevelScreen', 'ExitGameScreen', 'ExitProgramScreen',
    'CutScene', 'PreCutScene', 'SkipCutScene',
    'PlayLevelMusicSlot', 'ContinueLevelMusicSlot',
    'MenuCursorLeft', 'MenuCursorRight', 'MenuCursorShade', 'MenuShadeSelected',
    'GetLoadTile', 'GetMenuTile', 'GetBonusTile',
    'Capir', 'ValidateStart',
];