#!/bin/bash
set -e

echo "============================================"
echo "  ListTodo Build Script"
echo "============================================"

# 1. 安装前端依赖
echo ""
echo "[1/4] 安装前端依赖..."
cd frontend
npm install
cd ..

# 2. 构建前端
echo ""
echo "[2/4] 构建前端..."
cd frontend
npm run build
cd ..

# 3. 构建后端
echo ""
echo "[3/4] 构建后端..."
cargo build -p backend --release

# 4. 构建 Tauri 桌面应用
echo ""
echo "[4/4] 构建 Tauri 桌面应用..."

# macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  → 构建 macOS 版本..."
    cargo tauri build --target aarch64-apple-darwin
    cargo tauri build --target x86_64-apple-darwin
# Linux
elif [[ "$OSTYPE" == "linux"* ]]; then
    echo "  → 构建 Linux 版本..."
    cargo tauri build --target x86_64-unknown-linux-gnu
# Windows (Git Bash / WSL / MSYS2)
else
    echo "  → 构建 Windows 版本..."
    cargo tauri build --target x86_64-pc-windows-msvc
fi

echo ""
echo "============================================"
echo "  构建完成！"
echo "============================================"
echo ""
echo "  后端: target/release/backend"
echo "  前端: frontend/dist/"
echo "  Tauri: src-tauri/target/release/bundle/"
