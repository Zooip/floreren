#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Create / list / remove isolated git worktrees so multiple agents can work in
  parallel without sharing one working folder. See docs/agents/how-we-work.md (§4).

.DESCRIPTION
  Each worktree lives inside the repo in the git-ignored .worktrees folder (e.g.
  .worktrees/floreren-13), checked out on its own branch off the latest origin/master.
  Agents work there and ship via a PR. Never create worktrees as sibling folders.

.EXAMPLE
  ./scripts/agent-worktree.ps1 new 13 map-sun-cells
  # -> .worktrees/floreren-13 on branch fix/13-map-sun-cells (off latest origin/master)

.EXAMPLE
  ./scripts/agent-worktree.ps1 list

.EXAMPLE
  ./scripts/agent-worktree.ps1 remove 13
  # -> removes the .worktrees/floreren-13 folder (the branch is kept; delete it with
  #    'git branch -D fix/13-...' once it's merged)
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('new', 'list', 'remove')]
  [string]$Action,

  [string]$Issue,   # issue number, e.g. 13
  [string]$Slug     # short description, e.g. map-sun-cells (only for 'new')
)

$ErrorActionPreference = 'Stop'

# Always operate from the main checkout, even when run from inside another worktree.
$repo = Split-Path (git rev-parse --path-format=absolute --git-common-dir).Trim() -Parent
Set-Location $repo
$parent = Join-Path $repo '.worktrees'
$base = 'floreren'   # worktree folders are named <base>-<issue>

function Get-WorktreeDir([string]$issue) { Join-Path $parent "$base-$issue" }

switch ($Action) {
  'new' {
    if (-not $Issue) { throw "Usage: agent-worktree.ps1 new <issue> <slug>" }
    $branch = if ($Slug) { "fix/$Issue-$Slug" } else { "fix/$Issue" }
    $dir = Get-WorktreeDir $Issue
    if (Test-Path $dir) { throw "Folder already exists: $dir" }

    New-Item -ItemType Directory -Force $parent | Out-Null
    git fetch origin master
    git worktree add $dir -b $branch origin/master
    Write-Host ""
    Write-Host "✓ Worktree ready" -ForegroundColor Green
    Write-Host "  folder: $dir"
    Write-Host "  branch: $branch (off origin/master)"
    Write-Host "  next:   cd `"$dir`"  install deps (frontend: npm install; backend: uv venv --python 3.12 + requirements.txt), work, test, open a PR."
  }
  'list' {
    git worktree list
  }
  'remove' {
    if (-not $Issue) { throw "Usage: agent-worktree.ps1 remove <issue>" }
    $dir = Get-WorktreeDir $Issue
    git worktree remove $dir
    Write-Host "✓ Removed worktree: $dir" -ForegroundColor Green
    Write-Host "  (the branch is kept — 'git branch -D fix/$Issue-...' to delete it once merged)"
  }
}
