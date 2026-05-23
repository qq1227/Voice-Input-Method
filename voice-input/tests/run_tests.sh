#!/bin/bash
# ===========================================
# 语音输入法 - 一键测试运行脚本
# 用法: bash tests/run_tests.sh
# ===========================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DIR="$PROJECT_DIR/tests/reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORT_DIR/test-report-${TIMESTAMP}.txt"
SUMMARY_FILE="$REPORT_DIR/summary-${TIMESTAMP}.txt"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  语音输入法 - 自动化测试套件${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "${YELLOW}项目目录:${NC} $PROJECT_DIR"
echo -e "${YELLOW}测试报告:${NC} $REPORT_FILE"
echo ""

# 创建报告目录
mkdir -p "$REPORT_DIR"

# 检查 node_modules
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo -e "${YELLOW}[安装依赖] node_modules 不存在，执行 npm install...${NC}"
    cd "$PROJECT_DIR"
    npm install --include=dev 2>&1 | tail -5
    echo -e "${GREEN}[完成] 依赖安装完成${NC}"
    echo ""
fi

# 安装测试必要的依赖
echo -e "${YELLOW}[检查] 验证测试依赖...${NC}"
cd "$PROJECT_DIR"

# 确保 jest 可用
if ! npx jest --version &>/dev/null; then
    echo -e "${RED}[错误] jest 不可用，尝试安装...${NC}"
    npm install --save-dev jest ts-jest @types/jest jest-junit 2>&1 | tail -3
fi

echo ""

# ===========================================
# 运行测试
# ===========================================
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  开始执行测试...${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# 运行测试并同时输出到终端和文件
set +e
npx jest --config "$PROJECT_DIR/tests/jest.config.js" \
         --verbose \
         --no-cache \
         2>&1 | tee "$REPORT_FILE"
EXIT_CODE=$?
set -e

echo ""

# ===========================================
# 生成测试摘要
# ===========================================
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  测试摘要${NC}"
echo -e "${BLUE}============================================${NC}"

# 从报告中提取统计信息
TOTAL=$(grep -oP 'Tests:\s+\K\d+' "$REPORT_FILE" | tail -1 || echo "0")
PASSED=$(grep -oP '\d+ passed' "$REPORT_FILE" | tail -1 | grep -oP '\d+' || echo "0")
FAILED=$(grep -oP '\d+ failed' "$REPORT_FILE" | tail -1 | grep -oP '\d+' || echo "0")

# 如果没找到数字，尝试另一种格式
if [ "$TOTAL" = "0" ]; then
    TOTAL=$(grep -c '✓\|√\|PASS\|passed' "$REPORT_FILE" || echo "0")
fi

# 检查 JUnit 报告
if [ -f "$REPORT_DIR/junit.xml" ]; then
    echo -e "${GREEN}✓ JUnit 报告已生成:${NC} $REPORT_DIR/junit.xml"
fi

echo ""
echo -e "  总用例数: ${YELLOW}$TOTAL${NC}"
echo -e "  通过:     ${GREEN}$PASSED${NC}"
echo -e "  失败:     ${RED}$FAILED${NC}"
echo ""

# 保存摘要
{
    echo "语音输入法 - 测试报告"
    echo "生成时间: $(date)"
    echo "================================"
    echo "总用例数: $TOTAL"
    echo "通过: $PASSED"
    echo "失败: $FAILED"
    echo "结果: $([ "$FAILED" = "0" ] && echo "全部通过" || echo "有失败")"
} > "$SUMMARY_FILE"

# 结果显示
if [ "$EXIT_CODE" -eq 0 ]; then
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  ✅ 所有测试通过!${NC}"
    echo -e "${GREEN}============================================${NC}"
else
    echo -e "${RED}============================================${NC}"
    echo -e "${RED}  ❌ 部分测试失败 (exit code: $EXIT_CODE)${NC}"
    echo -e "${RED}============================================${NC}"
fi

echo ""
echo -e "${YELLOW}详细报告:${NC} $REPORT_FILE"
echo -e "${YELLOW}摘要:${NC}     $SUMMARY_FILE"
echo ""

exit $EXIT_CODE
