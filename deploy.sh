#!/usr/bin/env bash
# 已废弃：根目录 deploy.sh 不再维护
#
# 请统一使用新版部署脚本：
#   cd tarot-server/deploy
#   ./deploy.sh init-env   # 首次：交互生成生产 .env
#   ./deploy.sh            # 一键部署
#
# 详见 DEPLOY.md 和 tarot-server/deploy/README.md

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}✗ 根目录 deploy.sh 已废弃，请不要继续使用。${NC}"
echo ""
echo -e "${YELLOW}请切换到新版部署脚本：${NC}"
echo "  cd tarot-server/deploy"
echo "  ./deploy.sh init-env   # 首次部署生成 .env"
echo "  ./deploy.sh            # 一键全流程部署"
echo ""
echo "详见 DEPLOY.md 和 tarot-server/deploy/README.md"
echo ""
exit 1
