import '../../types';
import { CON_FUNC_ALIAS } from '../../native';

namespace _drawFuncs {
    function TextMultiLine(pos: pos2, style: TStyle, text: string, max_w: number, max_h: number, font: IFont) {
        const lines = text.split('\n');
        const QuoteDimension: CON_FUNC_ALIAS<typeof CEvent.prototype.QuoteDimension> = CEvent.prototype.QuoteDimension;

        lines.forEach((e) => {
            const q = Quote(e);
            const dims = QuoteDimension(font.tile, pos.xy.x, pos.xy.y, pos.scale, pos.ang, 0, q,
                style.shade, style.pal, style.orientation, 0, font.xSpace, font.yLine, font.xBetween,
                font.yBetween,font.flags, 0, 0, xDim, yDim);

            //if(dims.x > max_w)
        })
    }
}
