import './types';

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
     * Open and reads a file
     * @param path - The path of the file
     * @returns - A class object holding the file's content and method to operate it.
     */
    constructor(path: string) {
        const pathQuote = Quote(path);
        CONUnsafe(`
state pushd
getarraysize rstack rd
readarrayfromfile rstack rssp
getarraysize rstack rb
state pushr1
set r0 rb
add r0 1
state alloc
sub r0 1
set flat[rb] r0
set ri rb
add ri 1
copy rstack[0] flat[ri] r0
set ra r0
resizearray rstack rd
state popr1
state popd
`);

        this.length = sysFrame.ra;
        this.buffer = sysFrame.GetReference(sysFrame.rb) as [];
        this.path = path;
        this.seek = 0;
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
    ReadString(): string | null {
        const start = this.seek;
        let found = false;
        while(this.seek < this.length) {
            if(this.buffer[this.seek] == 0) {
                found = true;
                break;
            }
            this.seek++;
        }

        if(!found)
            return null;

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

set flat[rb] ra
set ri rb
add ri 1

copy flat[rsi] flat[ri] ra
`);

        return sysFrame.GetReference(sysFrame.rb) as string;
    }

    /**
     * Reads a line from the file
     * @returns - The line string
     */
    ReadLine(): string {
        const start = this.seek;
        let found = false;
        while(this.seek < this.length) {
            if(this.buffer[this.seek] == 10) {
                found = true;
                break;
            }
            this.seek++;
        }

        if(!found)
            return null;

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

set flat[rb] ra
set ri rb
add ri 1

copy flat[rsi] flat[ri] ra
`);

        return sysFrame.GetReference(sysFrame.rb) as string;
    }
}