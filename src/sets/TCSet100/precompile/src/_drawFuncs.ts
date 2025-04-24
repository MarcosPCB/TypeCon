import '../../types';
import { CON_FUNC_ALIAS } from '../../native';

namespace _drawFuncs {
    function TextMultiLine(pos: pos2, style: TStyle, text: string, font: IFont) {
        const lines = text.split('\n');
        const ScreenText: CON_FUNC_ALIAS<typeof CEvent.prototype.ScreenText> = CEvent.prototype.ScreenText;

        lines.forEach((e, i) => {
            const q = Quote(e);
            ScreenText(font.tile, pos.xy.x, pos.xy.y + font.yBetween + (font.yLine * i), pos.scale, pos.ang, 0, q, style.shade, style.pal,
                style.orientation, 0, font.xSpace, font.yLine, font.xBetween, font.yBetween, font.flags, 0, 0, xDim, yDim);
        });
    }
}
