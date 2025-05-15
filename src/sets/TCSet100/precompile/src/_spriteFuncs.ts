import { CON_FUNC_ALIAS, CON_PROPERTY_ALIAS } from '../../native';
import '../../types';

namespace _spriteFuncs {
    function CanSeeShootInDist(distance: number, greater: boolean): boolean {
        const CanSee: CON_FUNC_ALIAS<typeof CActor.prototype.CanSee> = CActor.prototype.CanSee;
        const CanShootTarget: CON_FUNC_ALIAS<typeof CActor.prototype.CanShootTarget> = CActor.prototype.CanShootTarget;

        if(
            CanSee()
            && CanShootTarget()
            && ((greater && sprites[thisActor].playerDist > distance)
            || (!greater && sprites[thisActor].playerDist <= distance)
        ))
            return true;

        return false;
    }

    function ActionAndMove(action: IAction, move: IMove, flags: number): void {
        const ActionCount: CON_FUNC_ALIAS<typeof CActor.prototype.ActionCount> = CActor.prototype.ActionCount;
        const Count: CON_FUNC_ALIAS<typeof CActor.prototype.Count> = CActor.prototype.Count;

        sprites[thisActor].curAction = action.loc;
        sprites[thisActor].curActionFrame = 0;
        sprites[thisActor].curMove = move.loc;
        sprites[thisActor].tags.hitag = flags;
        Count(0);
        ActionCount(0);
    }
}