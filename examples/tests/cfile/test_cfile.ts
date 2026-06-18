import { CFile, FileReadType } from '../../../include/TCSet100/CFile';

class TestCFile extends CEvent {
    constructor() { super('Init'); }
    // debug-test
    public Append(): void {
        // ── FileExists: file that exists ──────────────────────────
        // Write a small file first so we know it exists.
        const existWrite: CFile = new CFile('test_cfile_exists.txt');
        existWrite.WriteString("exists");
        const existCheck: CFile = new CFile('test_cfile_exists.txt');
        checkEq("exists_yes", 1, existCheck.FileExists() as unknown as number);

        // ── FileExists: file that does not exist ──────────────────
        const noFile: CFile = new CFile('__no_such_file_cfile_xyzabc__.bin');
        checkEq("exists_no", 0, noFile.FileExists() as unknown as number);

        // ── Binary write + read round-trip ────────────────────────
        const binData: number[] = [];
        binData.push(42);
        binData.push(1337);
        binData.push(99999);

        const binWrite: CFile = new CFile('test_cfile.bin');
        binWrite.CopyMemToFile(binData as any, binData.length);
        binWrite.Write(FileReadType.binary, 8);

        const binRead: CFile = new CFile('test_cfile.bin');
        binRead.Read(FileReadType.binary, 8);
        checkEq("bin_val0", 42,    binRead.GetValue());
        checkEq("bin_val1", 1337,  binRead.GetValue());
        checkEq("bin_val2", 99999, binRead.GetValue());

        // ── WriteString (text) + Read(text) char-by-char ─────────
        // "HELLO" packs as [H E L L][O LF LF LF] = 2 ints = 8 bytes.
        // After 8-bit text read: buffer = [72,69,76,76,79,10,10,10], length=8.
        const txtWrite: CFile = new CFile('test_cfile.txt');
        const hello: string = "HELLO";
        txtWrite.WriteString(hello);

        const txtRead: CFile = new CFile('test_cfile.txt');
        txtRead.Read(FileReadType.text, 8);
        checkEq("txt_H",  72, txtRead.GetValue());
        checkEq("txt_E",  69, txtRead.GetValue());
        checkEq("txt_L",  76, txtRead.GetValue());
        checkEq("txt_L2", 76, txtRead.GetValue());
        checkEq("txt_O",  79, txtRead.GetValue());

        // ── IsTextValid: clean text file → 1 ─────────────────────
        // seek is at 5; remaining chars are LF (10) — all valid ASCII.
        const tvResult: number = txtRead.IsTextValid() as unknown as number;
        checkEq("txt_valid", 1, tvResult);

        // ── Write(text) + Read(text) round-trip ───────────────────
        // Chars [65='A', 66='B', 67='C'] via CopyMemToFile → Write(text,8).
        // Tail of 3 chars → [A B C LF] = 1 int.
        // After Read(text,8): buffer = [65,66,67,10], length=4.
        const charArr: number[] = [];
        charArr.push(65);
        charArr.push(66);
        charArr.push(67);

        const txtWrite2: CFile = new CFile('test_cfile_w.txt');
        txtWrite2.CopyMemToFile(charArr as any, charArr.length);
        txtWrite2.Write(FileReadType.text, 8);

        const txtRead2: CFile = new CFile('test_cfile_w.txt');
        txtRead2.Read(FileReadType.text, 8);
        checkEq("wt_A", 65, txtRead2.GetValue());
        checkEq("wt_B", 66, txtRead2.GetValue());
        checkEq("wt_C", 67, txtRead2.GetValue());

        // ── IsTextValid: binary data read as 8-bit text → 0 ─────
        // Write 0x000000FF (255). File bytes: [0xFF,0x00,0x00,0x00].
        // Read as text: [255,0,0,0]. 255>126 → invalid; 0<9 → invalid.
        const badData: number[] = [];
        badData.push(255);

        const badWrite: CFile = new CFile('test_cfile_bad.bin');
        badWrite.CopyMemToFile(badData as any, 1);
        badWrite.Write(FileReadType.binary, 8);

        const badRead: CFile = new CFile('test_cfile_bad.bin');
        badRead.Read(FileReadType.text, 8);
        const bvResult: number = badRead.IsTextValid() as unknown as number;
        checkEq("bad_valid", 0, bvResult);
    }
}
