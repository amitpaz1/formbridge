#!/bin/bash
# FormBridge Demo Recording Script
# Run: TERM=xterm-256color asciinema rec --command="bash demo/record-demo.sh" /tmp/formbridge-demo.cast

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

type_slow() {
  local text="$1"
  for ((i=0; i<${#text}; i++)); do
    echo -n "${text:$i:1}"
    sleep 0.03
  done
  echo
}

pause() { sleep "${1:-1.5}"; }

clear
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  📋 FormBridge — Forms for AI Agents + Humans${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
pause 2

echo
echo -e "${GREEN}# 1. Define a form schema${NC}"
pause
type_slow 'cat schema.json'
pause 0.5
echo -e "${CYAN}"
cat << 'EOF'
{
  "title": "New Customer Onboarding",
  "fields": {
    "company":  { "type": "string", "required": true },
    "email":    { "type": "string", "format": "email" },
    "plan":     { "type": "string", "enum": ["starter","pro","enterprise"] },
    "notes":    { "type": "string", "ui": "textarea" }
  }
}
EOF
echo -e "${NC}"
pause 2

echo -e "${GREEN}# 2. AI agent fills what it knows${NC}"
pause
type_slow 'curl -s -X POST http://localhost:3000/api/submit \'
type_slow '  -H "Authorization: Bearer fbk_demo_key" \'
type_slow '  -H "Content-Type: application/json" \'
type_slow '  -d '\''{"intakeId":"onboarding","fields":{"company":"Acme Corp","email":"cto@acme.com","plan":"enterprise"},"source":"ai-agent"}'\'''
pause
echo
echo -e "${YELLOW}{\"id\":\"sub_7f3k9x\",\"status\":\"partial\",\"resumeToken\":\"rt_abc123\",\"filledBy\":\"ai-agent\",\"missing\":[\"notes\"]}${NC}"
pause 2

echo
echo -e "${GREEN}# 3. Human completes the rest via resume link${NC}"
pause
type_slow 'echo "→ https://forms.example.com/resume/rt_abc123"'
pause 1
echo
echo -e "   ${CYAN}┌─────────────────────────────────┐${NC}"
echo -e "   ${CYAN}│  New Customer Onboarding        │${NC}"
echo -e "   ${CYAN}│                                 │${NC}"
echo -e "   ${CYAN}│  Company: Acme Corp      ✅ AI  │${NC}"
echo -e "   ${CYAN}│  Email:   cto@acme.com   ✅ AI  │${NC}"
echo -e "   ${CYAN}│  Plan:    Enterprise      ✅ AI  │${NC}"
echo -e "   ${CYAN}│  Notes:   [___________]  ✏️  You │${NC}"
echo -e "   ${CYAN}│                                 │${NC}"
echo -e "   ${CYAN}│         [ Submit ]              │${NC}"
echo -e "   ${CYAN}└─────────────────────────────────┘${NC}"
pause 3

echo
echo -e "${GREEN}# 4. Submission complete — full audit trail${NC}"
pause
type_slow 'curl -s http://localhost:3000/api/submissions/sub_7f3k9x | jq .'
pause
echo -e "${YELLOW}"
cat << 'EOF'
{
  "id": "sub_7f3k9x",
  "status": "completed",
  "fields": {
    "company": { "value": "Acme Corp", "source": "ai-agent" },
    "email":   { "value": "cto@acme.com", "source": "ai-agent" },
    "plan":    { "value": "enterprise", "source": "ai-agent" },
    "notes":   { "value": "Fast-track onboarding", "source": "human" }
  },
  "completedAt": "2026-02-06T16:58:00Z"
}
EOF
echo -e "${NC}"
pause 2

echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  AI fills what it knows. Humans finish the rest.${NC}"
echo -e "${BLUE}  → github.com/amitpaz1/formbridge${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
pause 3
