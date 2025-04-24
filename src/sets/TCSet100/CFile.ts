import './types';

export enum FileReadType {
    binary = 0,
    text = 1,
}

/**
 * Class for file operations (code is optimized)
 */
export class CFile {
    /**
     * The current file seek position
     */
    public seek: number;
    /**
     * The current path of the file opened
     */
    public path: string;
    /**
     * The buffer that holds the file contents
     */
    private buffer: number[];
    /**
     * The length of the file content
     */
    public length: number;

    /**
     * If the file has been read or not
     */
    private loaded: boolean;

    /**
     * Determines if it's a binary or text file
     */
    public type: number;

    /**
     * Open a file
     * @param path - The path of the file
     * @returns - A class object holding the file's content and method to operate it.
     */
    constructor(path: string) {
        this.length = 0;
        this.buffer = [];
        this.path = path;
        this.seek = 0;
        this.loaded = false;
    }

    /**
     * Reads the file as a 4 byte binary or a encoded text
     * @param type - Binary or text @see {@link FileReadType}
     * @param encoding - (optional) 8 by default. Only used if in text mode
     */
    Read(type: number, encoding: 8 | 16 | 32 = 8) {
        if(this.loaded)
            return;

        const pathQuote = Quote(this.path);
        if(type == FileReadType.binary) {
            sysFrame.BufferToSourceIndex(pathQuote as any, false);
            CONUnsafe(`
getarraysize rstack rd
qstrcpy 1022 rsi
readarrayfromfile rstack 1022
getarraysize rstack rb
state pushr1
set r0 rb
add r0 1
state alloc
sub r0 1
setarray flat[rb] r0
set ri rb
add ri 1
copy rstack[0] flat[ri] r0
resizearray rstack rd
set rd r0
set ra rb
state popr1
`);
            this.length = sysFrame.rd;
            this.buffer = sysFrame.GetReference(sysFrame.rb) as [];
        } else {
            sysFrame.BufferToSourceIndex(pathQuote as any, false);
            CONUnsafe(`
getarraysize rstack rd
qstrcpy 1022 rsi
readarrayfromfile rstack 1022
getarraysize rstack rb
state pushr1
set r0 rb

switch r1
  case 8:
    mul r0 4
    break
  case 16:
    mul r0 2
    break
endswitch

add r0 1
state alloc
sub r0 1
setarray flat[rb] r0
set ri rb
add ri 1

ife r1 32
  copy rstack[0] flat[ri] r0
else {
  state pushr1
  state pushd
  state pushc
  set rd 0
  set rc 0
  getarraysize rstack r0

  whilel rc r0 {
    set ra rstack[rc]
    ife r1 8 {
      switch rd
        case 3:
          and ra 0xFF000000
          shiftr ra 24
          setarray flat[ri] ra
          break

        case 2:
          and ra 0xFF0000
          shiftr ra 16
          setarray flat[ri] ra
          break

        case 1:
          and ra 0xFF00
          shiftr ra 8
          setarray flat[ri] ra
          break

        case 0:
          and ra 0xFF
          setarray flat[ri] ra
          break
      endswitch

      add rd 1
      ife rd 4 {
        set rd 0
        add rc 1
      }
    } else {
      switch rd
        case 1:
          and ra 0xFF00
          shiftr ra 8
          setarray flat[ri] ra
          break

        case 0:
          and ra 0xFF
          setarray flat[ri] ra
          break
      endswitch

      add rd 1
      ife rd 2 {
        set rd 0
        add rc 1
      }
    }

    add ri 1
  }

  state popc
  state popd
  state popr1
}

resizearray rstack rd
set rd r0
set ra rb
state popr1
`)
        }

        this.buffer = sysFrame.GetReference(sysFrame.rb) as [];
        this.length = sysFrame.rd;
        this.type = type;

        this.seek = 0;
        this.loaded = true;
    }

    /**
     * Write the contents of buffer to the path
     * @param type binary or text
     * @param encoding text enconding
     */
    Write(type: FileReadType, encoding: 8 | 16 | 32 = 8) {
      if(!this.loaded)
        return;

      const pathQuote = Quote(this.path);
      if(type == FileReadType.binary) {
        sysFrame.BufferToSourceIndex(pathQuote as any, false);
        sysFrame.rc = this.length;
        sysFrame.BufferToIndex(this.buffer, true);
        CONUnsafe(`
getarraysize rstack rd
resizearray rstack rc
copy flat[ri] rstack[0] rc
qstrcpy 1022 rsi
writearraytofile rstack 1022
getarraysize rstack rb
resizearray rstack rd
`);
    } else {
        sysFrame.BufferToSourceIndex(pathQuote as any, false);
        sysFrame.rc = this.length;
        sysFrame.BufferToIndex(this.buffer, true);
        CONUnsafe(`
getarraysize rstack rd
set ra rc

switch r1
  case 8
    div ra 4
    break
  
  case 16
    div ra 2
    break
endswitch

ife r1 32
  copy flat[ri] rstack[0] rc
else {
  resizearray rstack ra
  state pushr1
  state pushd

  set rd 0
  set r0 rc
  set rc 0
  whilel rc ra {
    set rb flat[ri]
    ife r1 8 {
      switch rd
        case 3:
          shiftl rb 24
          setarray rstack[rc] rb
          break

        case 2:
          shiftl rb 16
          or rb flat[ri]
          setarray rstack[rc] rb
          break

        case 1:
          shiftl rb 8
          or rb flat[ri]
          setarray rstack[rc] rb
          break

        case 0:
          or rb flat[ri]
          setarray rstack[rc] rb
          break
      endswitch

      add rd 1
      ife rd 4 {
        set rd 0
        add rc 1
      }
    } else {
      switch rd
        case 1:
          shiftl rb 8
          or rb flat[ri]
          setarray rstack[rc] rb
          break

        case 0:
          or rb flat[ri]
          setarray rstack[rc] rb
          break
      endswitch

      add rd 1
      ife rd 2 {
        set rd 0
        add rc 1
      }
    }

    add ri 1
  }

  state popd
  state popr1
}

resizearray rstack rd
`)
      }
    }

    /**
     * Gets the value of the current file by its seek position
     * @returns The value from the file's seek position
     */
    GetValue(): number {
        return this.buffer[this.seek++];
    }

    /**
     * Sets the a value using the current file's seek position
     * @param value - The value to be set
     */
    SetValue(value: number): void {
        this.buffer[this.seek++] = value;
    }

    /**
     * Copies a portion of a buffer's content to the file
     * @param buffer - The source buffer
     * @param num_dwords - The size in DWORD (32-bits) to be copied
     */
    CopyMemToFile(buffer: [], num_dwords: number): void {
        if(buffer.length < num_dwords) {
            console.debug(`Number of bytes to be copied is greater than the buffer itself`);
            CONBreak(100);
            return;
        }

        MemCopy(buffer, this.buffer as any, num_dwords);
        this.seek += num_dwords;
    }

    /**
     * Copies a portion of the file's content to a buffer
     * @param buffer - The destination buffer
     * @param num_dwords - The size in DWORD (32-bits) to be copied
     */
    CopyFileToMem(buffer: [], num_dwords: number): void {
        if(buffer.length < num_dwords) {
            console.debug(`Number of bytes to be copied is greater than the buffer itself`);
            CONBreak(101);
            return;
        }

        MemCopy(this.buffer as any, buffer, num_dwords);
        this.seek += num_dwords;
    }

    /**
     * Reads a string from the file
     * @returns - The string
     */
    ReadString(): string {
        const start = this.seek;
        while(this.seek < this.length) {
            if(this.buffer[this.seek] == 0)
                break;
            this.seek++;
        }

        sysFrame.BufferToSourceIndex(this.buffer, true);
        sysFrame.rd = this.seek + sysFrame.rsi;
        sysFrame.rc = start + sysFrame.rsi;
        sysFrame.ra = this.seek - start + 1;

        CONUnsafe(`
state pushr1
set r0 ra
state alloc
state popr1
sub ra 1

setarray flat[rb] ra
set ri rb
add ri 1

copy flat[rsi] flat[ri] ra
set ra rb
`);

        return sysFrame.GetReference(sysFrame.rb) as string;
    }

    /**
     * Reads a line from the file
     * @returns - The line string
     */
    ReadLine(): string {
        const start = this.seek;
        while(this.seek < this.length) {
            if(this.buffer[this.seek] == 10)
                break;

            this.seek++;
        }

        sysFrame.BufferToSourceIndex(this.buffer, true);
        sysFrame.rd = this.seek + sysFrame.rsi;
        sysFrame.rc = start + sysFrame.rsi;
        sysFrame.ra = this.seek - start + 1;

        CONUnsafe(`
state pushr1
set r0 ra
state alloc
state popr1
sub ra 1

setarray flat[rb] ra
set ri rb
add ri 1

copy flat[rsi] flat[ri] ra
set ra rb
`);

        return sysFrame.GetReference(sysFrame.rb) as string;
    }

    /**
     * Returns the buffer witht eh file content
     * @returns an array or string
     */
    GetBuffer(): [] | string {
      sysFrame.BufferToSourceIndex(this.buffer, true);
      return sysFrame.GetReference(sysFrame.rsi);
    }

    /**
     * Sets the current buffer to the one provided
     * @param buffer the buffer that's gonna replace
     */
    SetBuffer(buffer: []) {
      sysFrame.BufferToSourceIndex(buffer as any, true);
      this.buffer = sysFrame.GetReference(sysFrame.rsi) as [];
    }
}