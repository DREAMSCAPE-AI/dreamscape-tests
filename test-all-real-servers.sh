#!/bin/bash
# Script pour tester tous les services en temps réel

echo "🧪 Test de tous les services DreamScape en temps réel..."
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier que les services sont démarrés
echo "📡 Vérification des services..."

services=(
  "Auth:3001"
  "User:3002"
  "Voyage:3003"
  "AI:3004"
)

all_running=true

for service in "${services[@]}"; do
  IFS=':' read -r name port <<< "$service"
  if curl -s "http://localhost:$port" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} $name (port $port) : EN LIGNE"
  else
    echo -e "${RED}❌${NC} $name (port $port) : HORS LIGNE"
    all_running=false
  fi
done

echo ""

if [ "$all_running" = false ]; then
  echo -e "${RED}⚠️  Certains services ne sont pas démarrés !${NC}"
  echo "Démarrez-les avec : cd ../dreamscape-services && ./start-all-services.ps1"
  exit 1
fi

echo "🚀 Exécution des tests..."
echo ""

npx jest --config=jest.config.realdb.js integration/health/*-real.test.ts --verbose

echo ""
echo "✅ Tests terminés !"
