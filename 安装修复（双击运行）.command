#!/bin/bash
# FertilizerHelper 安装脚本
# 双击运行：自动安装到 Applications 并解除安全限制

echo "================================================"
echo "  FertilizerHelper 安装工具"
echo "================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="FertilizerHelper.app"
SOURCE_APP=""

# 在脚本同目录或 mac-arm64 子目录查找 app
if [ -d "$SCRIPT_DIR/$APP_NAME" ]; then
    SOURCE_APP="$SCRIPT_DIR/$APP_NAME"
elif [ -d "$SCRIPT_DIR/mac-arm64/$APP_NAME" ]; then
    SOURCE_APP="$SCRIPT_DIR/mac-arm64/$APP_NAME"
fi

if [ -z "$SOURCE_APP" ]; then
    echo "❌ 未找到 $APP_NAME"
    echo "   请确保此脚本和 $APP_NAME 在同一目录下"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi

echo "找到应用: $SOURCE_APP"
echo ""

# 复制到 Applications
TARGET="/Applications/$APP_NAME"
if [ -d "$TARGET" ]; then
    echo "检测到已安装旧版本，正在覆盖..."
    rm -rf "$TARGET"
fi

echo "正在安装到 /Applications ..."
cp -R "$SOURCE_APP" /Applications/

if [ $? -ne 0 ]; then
    echo "❌ 安装失败，尝试使用管理员权限..."
    sudo cp -R "$SOURCE_APP" /Applications/
fi

# 解除安全限制
echo "正在解除安全限制..."
xattr -cr "$TARGET" 2>/dev/null

echo ""
echo "================================================"
echo "  ✅ 安装完成！"
echo "================================================"
echo ""
echo "  可以在 启动台(Launchpad) 或 /Applications 中找到"
echo "  FertilizerHelper"
echo ""

# 询问是否立即打开
read -p "是否立即打开应用？(y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "$TARGET"
fi
