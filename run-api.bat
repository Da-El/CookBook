@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
set PATH=C:\Users\bjenn\.cargo\bin;C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64;%PATH%
set RUSTUP_HOME=C:\Users\bjenn\.rustup
set CARGO_HOME=C:\Users\bjenn\.cargo
set CATALOG_PATH=C:\Users\bjenn\CookBook\apps\web\public\data\catalog.json
set PORT=8080
set HOST=127.0.0.1
cd /d C:\Users\bjenn\CookBook
cargo run -p cookbook-api --target x86_64-pc-windows-msvc
