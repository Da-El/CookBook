@echo off
set PATH=C:\Users\bjenn\.cargo\bin;%PATH%
set V2_HOST=127.0.0.1
set V2_PORT=8081
set RUST_LOG=grok_cookbook_v2_api=info,tower_http=info
rem Optional later: set XAI_API_KEY=...
cd /d C:\Users\bjenn\CookBook
cargo run -p grok-cookbook-v2-api
