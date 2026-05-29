import '../../../include/TCSet100/types';

class TestSingleton extends CEvent {
    constructor() { super('NewGame'); }
    public Append(): void {
        let b: number = userdef.brightness;
        let sc: number = userdef.screen.size;
        userdef.brightness = 8;
        userdef[0].god = 0;
    }
}
