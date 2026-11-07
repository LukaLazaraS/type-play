# Samples one game-agent build on this PC over time (docs/research/build-capacity-2026-11-07.md): every second, the memory
# and CPU of every process under the build's root process (node run.mjs → Claude Code → the shell → check.mjs → Godot, Edge),
# grouped by kind. Windows numbers: the agent process's own memory and the build's timeline transfer to the server; the
# hidden browser's memory is measured on Linux instead (scripts/capacity/measure.mjs).
#   powershell -NoProfile -File scripts/capacity/build-sample.ps1 -RootPid <pid of node run.mjs> -Out <file.jsonl>
param([Parameter(Mandatory = $true)][int]$RootPid, [Parameter(Mandatory = $true)][string]$Out)
$ErrorActionPreference = 'SilentlyContinue'
(Get-Process -Id $PID).PriorityClass = 'BelowNormal'
$cmd = @{}
$prev = @{}
$t0 = Get-Date
function KindOf([string]$name, [string]$line) {
  if ($name -like 'Godot*') {
    if ($line -match '--import') { return 'godot:import' }
    if ($line -match '--export-release' -and $line -match '\.stress') { return 'godot:stress-export' }
    if ($line -match '--export-release') { return 'godot:export' }
    if ($line -match 'res://test/') { return 'godot:tests' }
    return 'godot:run'
  }
  if ($name -eq 'msedge.exe') { if ($line -match '--type=([a-z-]+)') { return "edge:$($Matches[1])" } return 'edge:browser' }
  if ($name -eq 'node.exe') {
    if ($line -match 'check\.mjs') { return 'node:check' }
    if ($line -match 'run\.mjs') { return 'node:run' }
    return 'node:other'
  }
  if ($name -eq 'claude.exe') { return 'claude' }
  return "other:$name"
}
while ($true) {
  $all = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, Name, WorkingSetSize, PrivatePageCount, KernelModeTime, UserModeTime
  if (-not ($all | Where-Object { $_.ProcessId -eq $RootPid })) { break }
  $children = @{}
  foreach ($p in $all) { if (-not $children.ContainsKey([int]$p.ParentProcessId)) { $children[[int]$p.ParentProcessId] = @() }; $children[[int]$p.ParentProcessId] += $p }
  $tree = @(); $queue = @($RootPid)
  $byId = @{}; foreach ($p in $all) { $byId[[int]$p.ProcessId] = $p }
  while ($queue.Count) {
    $id = $queue[0]; $queue = $queue[1..($queue.Count)]
    if ($byId.ContainsKey($id)) { $tree += $byId[$id] }
    if ($children.ContainsKey($id)) { foreach ($c in $children[$id]) { if ([int]$c.ProcessId -ne $id) { $queue += [int]$c.ProcessId } } }
  }
  $now = Get-Date
  $t = [math]::Round(($now - $t0).TotalSeconds, 1)
  $rows = @()
  foreach ($p in $tree) {
    $id = [int]$p.ProcessId
    if (-not $cmd.ContainsKey($id)) { $cmd[$id] = (Get-CimInstance Win32_Process -Filter "ProcessId=$id" -Property CommandLine).CommandLine }
    $cpu100ns = [double]$p.KernelModeTime + [double]$p.UserModeTime
    $cores = 0
    if ($prev.ContainsKey($id)) { $cores = [math]::Round(($cpu100ns - $prev[$id].cpu) / 1e7 / (($now - $prev[$id].at).TotalSeconds), 2) }
    $prev[$id] = @{ cpu = $cpu100ns; at = $now }
    $rows += [ordered]@{ pid = $id; kind = (KindOf $p.Name $cmd[$id]); ws = [int64]$p.WorkingSetSize; priv = [int64]$p.PrivatePageCount; cpu = $cores }
  }
  ([ordered]@{ t = $t; proc = $rows } | ConvertTo-Json -Compress -Depth 4) | Add-Content -Path $Out
  Start-Sleep -Milliseconds 1000
}
