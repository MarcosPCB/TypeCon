import { CON_NATIVE } from './native';

//@typecon

namespace nocompile {}

namespace statedecl {}

declare global {
    export function JibSounds(): CON_NATIVE<'jib_sounds'>;
    export function StandardJibs(): CON_NATIVE<'standard_jibs'>;
    export function GenericShrunkCode(): CON_NATIVE<'genericshrunkcode'>;
    export function GenericGrowCode(): CON_NATIVE<'genericgrowcode'>;
    export function Rats(): CON_NATIVE<'rats'>;
    export function GetCode(): CON_NATIVE<'getcode'>;
    export function RandomGetWeaponSounds(): CON_NATIVE<'randgetweapsnds'>;
    export function GetWeaponCode(): CON_NATIVE<'getweaponcode'>;
    export function RespawnIt(): CON_NATIVE<'respawnit'>;
    export function QuickGet(): CON_NATIVE<'quikget'>;
    export function QuickWeaponGet(): CON_NATIVE<'quikweaponget'>;
    export function DropAmmo(): CON_NATIVE<'drop_ammo'>;
    export function DropBattery(): CON_NATIVE<'drop_battery'>;
    export function DropShotgunShells(): CON_NATIVE<'drop_sgshells'>;
    export function DropShotgun(): CON_NATIVE<'drop_shotgun'>;
    export function DropChaingun(): CON_NATIVE<'drop_chaingun'>;
    export function RandomWallJibs(): CON_NATIVE<'random_wall_jibs'>;
    export function TroopBodyJibs(): CON_NATIVE<'troop_body_jibs'>;
    export function LizBodyJibs(): CON_NATIVE<'liz_body_jibs'>;
    export function StandardJibs(): CON_NATIVE<'standard_pjibs'>;
}