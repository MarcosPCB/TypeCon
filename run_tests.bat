@echo off
:: TypeCON test runner — compile, link, and validate every template.
:: Usage:
::   run_tests.bat          — run all tests (assumes dist\ is current)
::   run_tests.bat --build  — run yarn build first

setlocal enabledelayedexpansion

set PASS=0
set FAIL=0
set TOTAL=0

:: ── optional build ─────────────────────────────────────────────────────────────
if /I "%~1"=="--build" (
    echo Building...
    call yarn build
    if errorlevel 1 (
        echo [FATAL] Build failed -- aborting.
        exit /b 1
    )
    echo.
)

:: ── run_test subroutine ────────────────────────────────────────────────────────
:: Call as: call :run_test <src\path\file.ts>
:: Uses the basename (without .ts) as the CON filename.
goto :main

:run_test
    set "_src=%~1"
    set "_name=%~n1"
    set "_con=compiled\%_name%.con"

    set /a TOTAL+=1
    set "_step=compile"

    :: 1 — compile
    node dist/main.js -c -il "%_src%" > "%TEMP%\tcc_out.txt" 2>&1
    findstr /C:"[ERROR]" "%TEMP%\tcc_out.txt" > nul 2>&1
    if not errorlevel 1 goto :test_fail

    :: 2 — link
    set "_step=link"
    node dist/main.js -L -di > "%TEMP%\tcc_out.txt" 2>&1
    findstr /C:"[ERROR]" "%TEMP%\tcc_out.txt" > nul 2>&1
    if not errorlevel 1 goto :test_fail

    :: 3 — validate
    set "_step=validate"
    node dist/main.js -V -i "%_con%" > "%TEMP%\tcc_out.txt" 2>&1
    findstr /C:"[ERROR]" "%TEMP%\tcc_out.txt" > nul 2>&1
    if not errorlevel 1 goto :test_fail

    :: pass
    set /a PASS+=1
    echo   PASS  %_name%.ts
    goto :eof

:test_fail
    set /a FAIL+=1
    echo   FAIL  %_name%.ts  ^(%_step%^)
    findstr /C:"[ERROR]" "%TEMP%\tcc_out.txt"
    goto :eof

:: ── main ───────────────────────────────────────────────────────────────────────
:main

echo === Actors ===
call :run_test templates\actors\AssaultTrooper.ts
call :run_test templates\actors\BattleLord.ts

echo.
echo === General ===
call :run_test templates\tests\general\test.ts

echo.
echo === Events ===
call :run_test templates\tests\events\test_events.ts

echo.
echo === Input ===
call :run_test templates\tests\input\test_cinput.ts
call :run_test templates\tests\input\test_input.ts

echo.
echo === JSON ===
call :run_test templates\tests\json\test_json.ts
call :run_test templates\tests\json\test_json_alias.ts
call :run_test templates\tests\json\test_json_alias2.ts
call :run_test templates\tests\json\test_record.ts

echo.
echo === Math ===
call :run_test templates\tests\math\test_anim.ts
call :run_test templates\tests\math\test_fp.ts
call :run_test templates\tests\math\test_math.ts

echo.
echo === Singletons ===
call :run_test templates\tests\singletons\test_player_singleton.ts
call :run_test templates\tests\singletons\test_singleton.ts

echo.
echo === Structs ===
call :run_test templates\tests\structs\test_paldata.ts
call :run_test templates\tests\structs\test_players.ts
call :run_test templates\tests\structs\test_projectiles.ts
call :run_test templates\tests\structs\test_sectors.ts
call :run_test templates\tests\structs\test_sprites.ts
call :run_test templates\tests\structs\test_tiledata.ts
call :run_test templates\tests\structs\test_tsprites.ts
call :run_test templates\tests\structs\test_userdef.ts

:: ── summary ────────────────────────────────────────────────────────────────────
echo.
echo -------------------------------------------------
echo Results: %PASS% passed, %FAIL% failed / %TOTAL% total

node dist/main.js -C > "%TEMP%\tcc_out.txt" 2>&1

if %FAIL% gtr 0 exit /b 1
exit /b 0
