#!/usr/bin/env bash
# OpenClaw 环境探针
# 用途：在已经跑着 openclaw 的 VPS / Mac 上跑一遍，把输出粘回 v0 / Issue，
#      用来对齐 Bridge Agent 与真实 openclaw 的命令、字段、端口。
#
# 使用：
#   curl -fsSL https://raw.githubusercontent.com/Tangsheng9999/Open-Claw-Mobile/main/agent/scripts/probe.sh | bash
#   或：bash agent/scripts/probe.sh
#
# 安全：
#   - 全部为只读命令，不会改你的系统
#   - 不会读取 / 上传任何 .env / token / 私钥
#   - 不会自动外发，只把结果打印到 stdout，由你自己复制粘贴

# 注意：探针场景下不开 set -u / set -e —— 任何一条探测命令失败都不应中断后续节
LC_ALL=C
export LANG=C

# ---- 输出工具 ----
HR='----------------------------------------------------------------'
section() { printf '\n%s\n# %s\n%s\n' "$HR" "$1" "$HR"; }
run() {
  local label="$1"; shift
  printf '\n$ %s\n' "$label"
  # shellcheck disable=SC2068
  ( "$@" ) 2>&1 | head -60 || true
}
runs() {
  # run "string" — 直接执行字符串，便于使用 pipe / redirect
  local cmd="$1"
  printf '\n$ %s\n' "$cmd"
  bash -c "$cmd" 2>&1 | head -60 || true
}
have() { command -v "$1" >/dev/null 2>&1; }

# ---- 头部 ----
section "00 · 探针元信息"
echo "probe-version : 1.0"
echo "generated-at  : $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "hostname      : $(hostname 2>/dev/null || echo n/a)"

# ---- 系统 ----
section "01 · 系统"
runs "uname -a"
runs "cat /etc/os-release 2>/dev/null | head -8"
runs "sw_vers 2>/dev/null"
runs "uptime"
runs "whoami"
runs "id"
runs 'echo "shell=$SHELL  path=$PATH" | tr ":" "\n" | head -20'

# ---- 资源 ----
section "02 · 资源"
runs "nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null"
runs "free -h 2>/dev/null || vm_stat 2>/dev/null | head -10"
runs "df -h / 2>/dev/null"
runs 'cat /proc/loadavg 2>/dev/null || sysctl -n vm.loadavg 2>/dev/null || true'

# ---- openclaw 二进制 ----
section "03 · openclaw 二进制定位"
for cmd in openclaw open-claw oc claw openclawd; do
  if have "$cmd"; then
    echo "found: $cmd -> $(command -v "$cmd")"
  fi
done
runs 'ls -la /usr/local/bin/ 2>/dev/null | grep -iE "claw|oc " || true'
runs 'ls -la /opt 2>/dev/null | grep -i claw || true'
runs 'ls -la $HOME/.local/bin 2>/dev/null | grep -i claw || true'
runs 'find / -maxdepth 4 -type f -iname "*openclaw*" 2>/dev/null | head -20'

# ---- 版本 / 帮助 ----
section "04 · openclaw --version / --help"
if have openclaw; then
  run "openclaw --version" openclaw --version
  run "openclaw -v" openclaw -v
  run "openclaw version" openclaw version
  run "openclaw --help" openclaw --help
  run "openclaw help" openclaw help
else
  echo "openclaw 不在 PATH，跳过版本探测"
fi

# ---- 子命令探测 ----
section "05 · 子命令探测（status / models / projects / sessions）"
if have openclaw; then
  for sub in status info config server gateway models model projects project session sessions chat run pull list ps logs; do
    out=$(timeout 5 openclaw "$sub" --help 2>&1 | head -3)
    if [ -n "$out" ] && ! echo "$out" | grep -qiE "unknown|not found|invalid|usage:"; then
      printf '\n[ openclaw %s --help ]\n%s\n' "$sub" "$out"
    fi
  done
  run "openclaw status" timeout 5 openclaw status
  run "openclaw status --json" timeout 5 openclaw status --json
  run "openclaw status -o json" timeout 5 openclaw status -o json
  run "openclaw model list" timeout 5 openclaw model list
  run "openclaw models list" timeout 5 openclaw models list
  run "openclaw models" timeout 5 openclaw models
  run "openclaw projects" timeout 5 openclaw projects
  run "openclaw sessions" timeout 5 openclaw sessions
  run "openclaw ps" timeout 5 openclaw ps
fi

# ---- 进程 / 端口 ----
section "06 · 进程 / 端口"
runs 'ps -eo pid,ppid,user,etime,pcpu,pmem,command 2>/dev/null | grep -iE "claw|gateway|llm|ollama|llama" | grep -v grep | head -20'
if have ss; then
  runs 'ss -tlnp 2>/dev/null | head -30'
elif have netstat; then
  runs 'netstat -tlnp 2>/dev/null | head -30'
elif have lsof; then
  runs 'lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | head -30'
fi

# ---- 服务管理 ----
section "07 · 服务管理（systemd / launchd）"
if have systemctl; then
  runs 'systemctl list-units --type=service --all 2>/dev/null | grep -iE "claw|gateway" | head -10'
  for svc in openclaw openclawd open-claw claw openclaw-gateway; do
    if systemctl status "$svc" >/dev/null 2>&1; then
      run "systemctl status $svc" systemctl status --no-pager "$svc"
      run "systemctl cat $svc" systemctl cat "$svc"
    fi
  done
fi
if have launchctl; then
  runs 'launchctl list 2>/dev/null | grep -iE "claw|gateway" | head -10'
fi

# ---- 配置 / 数据目录 ----
section "08 · 配置 / 数据目录（不会读取 .env / token）"
for d in "$HOME/.openclaw" "$HOME/.config/openclaw" "$HOME/Library/Application Support/openclaw" \
         "/etc/openclaw" "/opt/openclaw" "/var/lib/openclaw" "/var/log/openclaw"; do
  if [ -e "$d" ]; then
    printf '\n[ %s ]\n' "$d"
    ls -la "$d" 2>/dev/null | head -20
  fi
done
# 列出常见配置文件名（只列文件名，不输出内容）
runs 'find $HOME/.openclaw $HOME/.config/openclaw /etc/openclaw 2>/dev/null \
        \( -name "*.toml" -o -name "*.yaml" -o -name "*.yml" -o -name "*.json" -o -name "*.conf" \) \
        -not -name "*.env*" -not -name "*token*" -not -name "*key*" -not -name "*secret*" \
        2>/dev/null | head -20'

# ---- 日志样本 ----
section "09 · 日志样本（最后 5 行）"
if have journalctl; then
  for svc in openclaw openclawd openclaw-gateway claw; do
    out=$(timeout 3 journalctl -u "$svc" -n 5 --no-pager 2>/dev/null | tail -5)
    [ -n "$out" ] && printf '\n[ journalctl -u %s ]\n%s\n' "$svc" "$out"
  done
fi
for f in /var/log/openclaw.log /var/log/openclaw/*.log "$HOME/.openclaw/logs/"*.log; do
  if [ -f "$f" ]; then
    printf '\n[ tail -n 5 %s ]\n' "$f"
    tail -n 5 "$f" 2>/dev/null
  fi
done

# ---- HTTP API 探测 ----
section "10 · 本地 HTTP API 探测"
if have curl; then
  for port in 8000 8080 8787 3000 4000 5000 7860 11434; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:$port/" 2>/dev/null || echo 000)
    if [ "$code" != "000" ] && [ "$code" != "" ]; then
      echo "127.0.0.1:$port  →  HTTP $code"
    fi
  done
  # 常见的 OpenAI 兼容端点
  for ep in /v1/models /api/models /api/tags /status /healthz /health /api/status /api/v1/status; do
    for port in 8000 8080 8787 3000 11434; do
      code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:$port$ep" 2>/dev/null || echo 000)
      if [ "$code" = "200" ]; then
        echo
        echo "[ 200 OK: http://127.0.0.1:$port$ep ]"
        curl -s --max-time 2 "http://127.0.0.1:$port$ep" 2>/dev/null | head -20
      fi
    done
  done
fi

# ---- Node / 包管理 ----
section "11 · 运行时（Node / Python / Go）"
runs 'node --version 2>&1'
runs 'pnpm --version 2>&1'
runs 'npm --version 2>&1'
runs 'python3 --version 2>&1'
runs 'pip3 --version 2>&1'
runs 'go version 2>&1'
# 全局 npm / pipx 包名里带 claw 的
runs 'npm list -g --depth=0 2>/dev/null | grep -iE "claw|oc-" | head -10'
runs 'pipx list 2>/dev/null | grep -iE "claw" | head -10'

# ---- 网络出站 ----
section "12 · 出站连通性（PWA → 这台机器）"
runs 'curl -fsS --max-time 3 ifconfig.me 2>/dev/null && echo'
runs 'curl -fsS --max-time 3 ipinfo.io/ip 2>/dev/null && echo'

# ---- 结尾 ----
section "99 · 结束"
echo "完成。请把上面的全部输出复制粘贴回来。"
echo "提示：脚本中标记 [ token / key / secret ] 的字段不会读取，但请你再扫一眼，"
echo "      手动打码 IP / 域名 / hostname 等敏感信息后再粘贴。"
