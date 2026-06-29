import '../../../include/TCSet100/types';

// Plain classes — heap-allocated via defstate ClassName_constructor.
// Note: plain class names are not registered as type aliases, so they cannot
// appear as property types of other classes. Use type aliases for nested struct
// properties (test_type_objects.ts) or interfaces (test_interfaces.ts).

class Vec2 {
    public x: number = 0;
    public y: number = 0;

    constructor() {}
}

class Rect {
    public x: number = 0;
    public y: number = 0;
    public width: number = 0;
    public height: number = 0;

    constructor() {}
}

class TestObjects extends CEvent {
    constructor() { super('InitComplete'); }

    // debug-test
    public Append(): void {
        // Basic object creation and property set/get
        let v = new Vec2();
        v.x = 7;
        v.y = 13;
        checkEq("vec2.x", 7, v.x);
        checkEq("vec2.y", 13, v.y);

        // Arithmetic update through property
        v.x = v.x + 3;
        checkEq("vec2.x after +3", 10, v.x);

        // Second class type
        let r = new Rect();
        r.x = 10;
        r.y = 20;
        r.width = 800;
        r.height = 600;
        checkEq("rect.x", 10, r.x);
        checkEq("rect.y", 20, r.y);
        checkEq("rect.width", 800, r.width);
        checkEq("rect.height", 600, r.height);

        // Two independent instances must not alias
        let a = new Vec2();
        let b = new Vec2();
        a.x = 1;
        b.x = 2;
        checkEq("instance a.x", 1, a.x);
        checkEq("instance b.x", 2, b.x);
    }
}
