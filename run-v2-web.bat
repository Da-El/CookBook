@echo off
set PATH=C:\Users\bjenn\tools\node\node-v24.18.0-win-x64;%PATH%
cd /d C:\Users\bjenn\CookBook\apps\web-v2
if not exist node_modules call npm install
npm run dev
