@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
set PATH=C:\Users\bjenn\.cargo\bin;C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64;%PATH%
set RUSTUP_HOME=C:\Users\bjenn\.rustup
set CARGO_HOME=C:\Users\bjenn\.cargo
set DATABASE_URL=postgres://grok_cookbook:grok_cookbook@127.0.0.1:5432/grok_cookbook?sslmode=disable
set CATALOG_PATH=C:\Users\bjenn\CookBook\apps\web\public\data\catalog.json
set JWT_SECRET=grok-cookbook-local-dev-jwt-secret-32chars
set UPLOAD_DIR=C:\Users\bjenn\CookBook\uploads
set FDC_API_KEY=DEMO_KEY
set PORT=8080
set HOST=127.0.0.1
set RUST_LOG=grok_cookbook_api=info,sqlx=warn
cd /d C:\Users\bjenn\CookBook
cargo run -p grok-cookbook-api --target x86_64-pc-windows-msvc
