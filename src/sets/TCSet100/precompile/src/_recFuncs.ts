import '../../types';

// ─── Native Record<string, T> hash-map runtime ───────────────────────────────
//
// Layout (flat[], linear probing, power-of-2 capacity):
//   flat[ptr + 0]              = capacity  (power of 2)
//   flat[ptr + 1]              = count     (live entries)
//   flat[ptr + 2 + i*3 + 0]   = hash      (0=empty, -1=tombstone)
//   flat[ptr + 2 + i*3 + 1]   = key_str_ptr (heap string pointer; 0 if not stored)
//   flat[ptr + 2 + i*3 + 2]   = val
//
// Calling conventions:
//   _rec_alloc    : r0=capacity (0→default 16)          → rb=ptr
//   _rec_hash     : r0=key_str_ptr                       → rb=hash
//   _rec_get      : r0=hash, r1=rec_ptr                  → rb=val, rc=1 if found
//   _rec_set_raw  : r0=hash, r1=rec_ptr, r2=val, r11=key_str_ptr (internal)
//   _rec_resize   : r0=old_ptr                           → rb=new_ptr (internal)
//   _rec_set      : r0=hash, r1=rec_ptr, r2=val, r11=key_str_ptr
//   _rec_del      : r0=hash, r1=rec_ptr                  → tombstones slot
//   _rec_free     : r0=rec_ptr                           → frees block + key strings

// Allocate a new record block.
// r0 = desired capacity; 0 means use default (16). Must be a power of 2.
// Returns rb = pointer to new block.
function _rec_alloc(): void {
    CONUnsafe(`
ife r0 0
    set r0 16
// block size = 2 + capacity*3
set r2 r0
mul r2 3
add r2 2
state pushr2         // saves r0=capacity
set r0 r2            // r0 = block size for alloc
set r1 4
state alloc          // rb = allocated block (block_size words reserved)
state popr2          // restores r0=capacity
// store capacity and count=0
setarray flat[rb] r0
set ri rb
add ri 1
setarray flat[ri] 0
// Preserve rb (heap ptr) through the CONUnsafe epilogue "set rb ra"
set ra rb
`);
}

// Compute FNV-1a 32-bit hash of a heap string.
// r0 = key_str_ptr → rb = hash (never 0; 0 remapped to 1)
function _rec_hash(): void {
    CONUnsafe(`
set ra -2128831035
set rc flat[r0]
set r1 0
whilel r1 rc {
    set ri r0
    add ri r1
    add ri 1
    xor ra flat[ri]
    mul ra 16777619
    add r1 1
}
ife ra 0
    set ra 1
set rb ra
`);
}

// Look up a hash in the record.
// r0=hash, r1=rec_ptr → rb=value, rc=1 if found (0 otherwise)
function _rec_get(): void {
    CONUnsafe(`
set rc 0
set rb 0
set r2 flat[r1]       // r2 = capacity
set r3 r2
sub r3 1              // r3 = mask = cap-1
and r3 r0             // r3 = initial slot = hash & mask
set r4 0              // probe counter
set r5 r1
add r5 2              // r5 = slot base ptr

whilel r4 r2 {
    set r6 r3
    mul r6 3
    add r6 r5          // r6 = &slot[r3].hash
    set r7 flat[r6]    // r7 = stored hash
    // empty slot → not found
    ife r7 0 {
        set r4 r2      // break
    }
    // match
    ife r7 r0 {
        add r6 2       // skip key_str_ptr (+1), reach val at +2
        set rb flat[r6]
        set rc 1
        set r4 r2      // break
    }
    ifn r7 r0 {
        add r3 1
        set r8 r2
        sub r8 1
        and r3 r8      // wrap: r3 = (r3+1) & (capacity-1)
    }
    add r4 1
}
// Put result in ra so the CONUnsafe epilogue "set rb ra" preserves rb correctly
set ra rb
`);
}

// Internal: linear probe insertion without load-factor check.
// r0=hash, r1=rec_ptr, r2=val, r11=key_str_ptr
// Used by both _rec_set (after optional resize) and _rec_resize (during rehash).
function _rec_set_raw(): void {
    CONUnsafe(`
set r3 flat[r1]        // capacity
set r4 r3
sub r4 1               // mask = cap-1
and r4 r0              // initial slot
set r5 r1
add r5 2               // slot base
set r6 0               // probe counter
set r7 -1              // first tombstone index (-1 = none)

whilel r6 r3 {
    set r8 r4
    mul r8 3
    add r8 r5           // r8 = &slot[r4].hash
    set r9 flat[r8]     // r9 = stored hash
    ife r9 0 {
        // empty: insert here (or at first tombstone if we saw one)
        ife r7 -1 {
            setarray flat[r8] r0    // hash
            add r8 1
            setarray flat[r8] r11   // key_str_ptr
            add r8 1
            setarray flat[r8] r2    // val
        }
        ifn r7 -1 {
            // use tombstone slot instead
            set r8 r7
            mul r8 3
            add r8 r5
            setarray flat[r8] r0    // hash
            add r8 1
            setarray flat[r8] r11   // key_str_ptr
            add r8 1
            setarray flat[r8] r2    // val
        }
        // increment count
        set ri r1
        add ri 1
        set ra flat[ri]
        add ra 1
        setarray flat[ri] ra
        set r6 r3       // break
    }
    // tombstone
    set r10 -1
    ife r9 r10 {
        ife r7 -1
            set r7 r4   // remember first tombstone
        add r4 1
        sub r3 1
        and r4 r3      // wrap: r4 = (r4+1) & (capacity-1)
        add r3 1
    }
    // existing match: update value in place; free incoming key string (avoid heap leak)
    ife r9 r0 {
        // free the new key_str_ptr (r11) — slot already has a key stored
        ifn r11 0 {
            state pushr9
            set r0 r11
            state free
            state popr9
            set r0 r9   // restore hash (r0 was clobbered by free's arg)
        }
        add r8 2        // skip hash (+0) and key_ptr (+1), reach val at +2
        setarray flat[r8] r2
        set r6 r3       // break
    }
    ifn r9 0 {
        ifn r9 r10 {
            ifn r9 r0 {
                add r4 1
                sub r3 1
                and r4 r3      // wrap: r4 = (r4+1) & (capacity-1)
                add r3 1
            }
        }
    }
    add r6 1
}
`);
}

// Internal: double the capacity and rehash all live entries into a new block.
// r0=old_ptr → rb=new_ptr
// Calls _rec_set_raw (defined above) — no forward reference.
function _rec_resize(): void {
    CONUnsafe(`
set r2 flat[r0]        // old capacity
set r3 r2
mul r3 2               // new capacity
// allocate new block
state pushr4
set r4 r3
mul r4 3
add r4 2
state pushr2
set r1 4
state alloc
state popr2
state popr4
// rb = new block ptr
setarray flat[rb] r3   // new capacity
set ri rb
add ri 1
setarray flat[ri] 0    // count = 0
// rehash all live slots from old block
set r4 0               // slot index
set r5 r0
add r5 2               // old slot base
set r6 rb              // save new ptr (rb may be clobbered by _rec_set_raw)
whilel r4 r2 {
    set r7 r4
    mul r7 3
    add r7 r5          // &old_slot[r4].hash
    set r8 flat[r7]    // old hash
    // skip empty and tombstones
    ife r8 0 { add r4 1 }
    set r9 -1
    ife r8 r9 { add r4 1 }
    ifn r8 0 {
        ifn r8 r9 {
            add r7 1
            set r9 flat[r7]    // old key_str_ptr
            add r7 1
            set r10 flat[r7]   // old val
            // save r0-r5 and r9 (key_str_ptr) across _rec_set_raw
            state pushr6
            set r0 r8
            set r1 r6
            set r2 r10
            set r11 r9         // key_str_ptr in r11 (above pushr6 range r0-r5)
            state _rec_set_raw
            state popr6
            add r4 1
        }
    }
}
// free old block (r0 = old_ptr, restored by final popr6 above)
state pushr1
state free
state popr1
set rb r6
// Preserve rb (new block ptr) through the CONUnsafe epilogue "set rb ra"
set ra rb
`);
}

// Insert or update a key-value pair.
// r0=hash, r1=rec_ptr, r2=val, r11=key_str_ptr
// Resizes (doubles) when count exceeds 75% of capacity.
// r11 passes through untouched (this function only uses r3-r7 internally).
function _rec_set(): void {
    CONUnsafe(`
// Check load factor: resize if count > capacity * 3 / 4
set r3 flat[r1]        // r3 = capacity
set r4 flat[r1]
mul r4 3
div r4 4               // r4 = 75% threshold
set r5 r1
add r5 1
set r6 flat[r5]        // r6 = count
ifg r6 r4 {
    state pushr3
    set r0 r1
    state _rec_resize
    set r1 rb
    state popr3
    set r3 flat[r1]    // refresh capacity after resize
}
state _rec_set_raw
`);
}

// Tombstone a slot by hash.
// r0=hash, r1=rec_ptr
function _rec_del(): void {
    CONUnsafe(`
set r2 flat[r1]        // capacity
set r3 r2
sub r3 1
and r3 r0              // initial slot
set r4 r1
add r4 2               // slot base
set r5 0               // probe counter
whilel r5 r2 {
    set r6 r3
    mul r6 3
    add r6 r4
    set r7 flat[r6]
    ife r7 0 {
        set r5 r2      // break (not found)
    }
    ife r7 r0 {
        // tombstone: set hash=-1, free key_str_ptr, clear val
        setarray flat[r6] -1
        add r6 1
        set r8 flat[r6]    // key_str_ptr
        setarray flat[r6] 0  // clear key_ptr
        add r6 1
        setarray flat[r6] 0  // clear val
        // free key string if non-zero
        ifn r8 0 {
            state pushr1
            set r0 r8
            state free
            state popr1
        }
        // decrement count
        set ri r1
        add ri 1
        set ra flat[ri]
        sub ra 1
        setarray flat[ri] ra
        set r5 r2      // break
    }
    ifn r7 r0 {
        add r3 1
        set r9 r2      // use r9 as mask scratch (fixes pre-existing wrap bug)
        sub r9 1
        and r3 r9      // wrap: r3 = (r3+1) & (capacity-1)
    }
    add r5 1
}
`);
}

// Free the record block and all stored key strings.
// r0=rec_ptr
function _rec_free(): void {
    CONUnsafe(`
// Iterate all live slots and free their key strings
set r2 flat[r0]    // r2 = capacity
set r3 r0
add r3 2           // r3 = slot_base
set r4 0           // slot index
whilel r4 r2 {
    set r5 r4
    mul r5 3
    add r5 r3          // r5 = &slot[r4].hash
    set r6 flat[r5]    // r6 = hash
    ifn r6 0 {
        set r7 -1
        ifn r6 r7 {
            // live slot: free key_str_ptr if non-zero
            add r5 1
            set r7 flat[r5]    // r7 = key_str_ptr
            ifn r7 0 {
                // pushr8 saves r0-r7; popr8 restores all of them
                state pushr8
                set r0 r7
                state free
                state popr8
                // r0=rec_ptr, r2=capacity, r3=slot_base, r4=slot_index all restored
            }
        }
    }
    add r4 1
}
// free the record block itself
state pushr1
state free
state popr1
`);
}
