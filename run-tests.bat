@echo off
:: TypeCON test runner
:: Usage:
::   run-tests.bat          -- run all tests (assumes dist\ is current)
::   run-tests.bat --build  -- run yarn build first

setlocal enabledelayedexpansion

set PASS=0
set FAIL=0
set TOTAL=0

:: ── optional build ─────────────────────────────────────────────────────────────
if /I "%~1"=="--build" (
    echo Building...
    call yarn build
    if errorlevel 1 ( echo [FATAL] Build failed -- aborting. & exit /b 1 )
    echo.
)

goto :main

:: ── shared compile+link ────────────────────────────────────────────────────────
:: Returns errorlevel 0 on success, 1 on failure.
:: Sets _cl_step to "compile" or "link" on failure.
:compile_and_link
    node dist/main.js -C > nul 2>&1

    node dist/main.js -c -il "%~1" > "%TEMP%\tcc_out.txt" 2>&1
    findstr /C:"[ERROR]" "%TEMP%\tcc_out.txt" > nul 2>&1
    if not errorlevel 1 ( set _cl_step=compile & exit /b 1 )

    node dist/main.js -L -di > "%TEMP%\tcc_out.txt" 2>&1
    findstr /C:"[ERROR]" "%TEMP%\tcc_out.txt" > nul 2>&1
    if not errorlevel 1 ( set _cl_step=link & exit /b 1 )

    exit /b 0

:: ── runner: compile + link + simulate --test ──────────────────────────────────
:run_test_sim
    set "_src=%~1"
    set "_name=%~n1"
    set "_con=compiled\%_name%.con"
    set /a TOTAL+=1

    call :compile_and_link "%_src%"
    if errorlevel 1 (
        set /a FAIL+=1
        echo   FAIL  %_name%.ts  (!_cl_step!)
        findstr /C:"[ERROR]" "%TEMP%\tcc_out.txt"
        goto :eof
    )

    node dist/main.js -S --test -nv -i "%_con%" > "%TEMP%\tcc_out.txt" 2>&1
    set _sim_exit=%errorlevel%

    set "_summary="
    for /f "tokens=*" %%L in ('findstr /C:"passed" "%TEMP%\tcc_out.txt" 2^>nul') do set "_summary=%%L"

    if !_sim_exit! neq 0 (
        set /a FAIL+=1
        echo   FAIL  %_name%.ts  (sim)  !_summary!
    ) else (
        set /a PASS+=1
        echo   PASS  %_name%.ts  (sim)  !_summary!
    )
    goto :eof

:: ── runner: compile + link + validate ─────────────────────────────────────────
:run_test
    set "_src=%~1"
    set "_name=%~n1"
    set "_con=compiled\%_name%.con"
    set /a TOTAL+=1

    call :compile_and_link "%_src%"
    if errorlevel 1 (
        set /a FAIL+=1
        echo   FAIL  %_name%.ts  (!_cl_step!)
        findstr /C:"[ERROR]" "%TEMP%\tcc_out.txt"
        goto :eof
    )

    node dist/main.js -V -i "%_con%" > "%TEMP%\tcc_out.txt" 2>&1
    findstr /C:"[ERROR]" "%TEMP%\tcc_out.txt" > nul 2>&1
    if not errorlevel 1 (
        set /a FAIL+=1
        echo   FAIL  %_name%.ts  (validate)
        findstr /C:"[ERROR]" "%TEMP%\tcc_out.txt"
        goto :eof
    )

    set /a PASS+=1
    echo   PASS  %_name%.ts  (validate)
    goto :eof

:: ── main ───────────────────────────────────────────────────────────────────────
:main

echo === Actors ===
call :run_test examples\actors\AssaultTrooper.ts
call :run_test examples\actors\BattleLord.ts

echo.
echo === General ===
call :run_test examples\general\test.ts

echo.
echo === Events ===
call :run_test examples\tests\events\test_events.ts

echo.
echo === Input ===
call :run_test examples\tests\input\test_cinput.ts
call :run_test examples\tests\input\test_input.ts

echo.
echo === JSON ===
call :run_test_sim examples\tests\json\test_json.ts
call :run_test_sim examples\tests\json\test_json_alias.ts
call :run_test_sim examples\tests\json\test_json_alias2.ts
call :run_test_sim examples\tests\json\test_record.ts

echo.
echo === Math ===
call :run_test_sim examples\tests\math\test_anim.ts
call :run_test_sim examples\tests\math\test_fp.ts
call :run_test_sim examples\tests\math\test_math.ts

echo.
echo === Singletons ===
call :run_test examples\tests\singletons\test_player_singleton.ts
call :run_test examples\tests\singletons\test_singleton.ts

echo.
echo === Structs ===
call :run_test examples\tests\structs\test_players.ts
call :run_test examples\tests\structs\test_projectiles.ts
call :run_test examples\tests\structs\test_sectors.ts
call :run_test examples\tests\structs\test_sprites.ts
call :run_test examples\tests\structs\test_tiledata.ts
call :run_test examples\tests\structs\test_tsprites.ts
call :run_test examples\tests\structs\test_userdef.ts

:: ── summary ────────────────────────────────────────────────────────────────────
echo.
echo -------------------------------------------------
echo Results: %PASS% passed, %FAIL% failed / %TOTAL% total

node dist/main.js -C > nul 2>&1

if %FAIL% gtr 0 exit /b 1
exit /b 0
