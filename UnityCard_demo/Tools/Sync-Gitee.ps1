[CmdletBinding()]
param([ValidateSet('Update', 'Publish')][string]$Mode = 'Update')

# ASCII source intentionally supports Windows PowerShell 5.1 without a UTF-8 BOM.
# The Gitee repository contains ONLY UnityCard_demo, at its repository root.
$ErrorActionPreference = 'Stop'
$giteeUrl = 'https://gitee.com/damou_0912_0/unity-card-demo.git'
$unityRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\', '/')

function Invoke-Git([string[]]$GitArguments) {
    & git @GitArguments
    if ($LASTEXITCODE -ne 0) { throw "Git failed (exit $LASTEXITCODE). No reset/force/clean was attempted." }
}

function Get-GitText([string[]]$GitArguments) {
    $output = & git @GitArguments
    if ($LASTEXITCODE -ne 0) { throw 'Git check failed. Verify repository access and sign-in.' }
    return (($output | ForEach-Object { [string]$_ }) -join "`n").Trim()
}

function Assert-Clean([string]$Repo, [string[]]$Paths = @()) {
    $arguments = @('-C', $Repo, 'status', '--porcelain=v1', '--untracked-files=normal')
    if ($Paths.Count -gt 0) { $arguments += '--'; $arguments += $Paths }
    $changes = Get-GitText $arguments
    if ($changes) {
        Write-Host $changes
        throw 'Local changes found. Save/commit them first. This tool never overwrites or auto-stashes your work.'
    }
}

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git for Windows is required: https://git-scm.com/downloads/win' }
    if (-not (Test-Path -LiteralPath (Join-Path $unityRoot 'ProjectSettings/ProjectVersion.txt'))) { throw 'This script must stay in UnityCard_demo/Tools (or the Gitee project Tools folder).' }
    if (Test-Path -LiteralPath (Join-Path $unityRoot 'Library/UnityLockfile')) { throw 'Close this project in Unity before synchronizing. UnityLockfile is present.' }
    $repoRoot = [IO.Path]::GetFullPath((Get-GitText @('-C', $unityRoot, 'rev-parse', '--show-toplevel'))).TrimEnd('\', '/')
    $branch = Get-GitText @('-C', $repoRoot, 'symbolic-ref', '--quiet', '--short', 'HEAD')
    if ($branch -ne 'main') { throw "Expected branch main, found $branch. No branch was changed." }
    $standalone = [string]::Equals($repoRoot, $unityRoot, [StringComparison]::OrdinalIgnoreCase)
    if (-not $standalone -and -not [string]::Equals((Join-Path $repoRoot 'UnityCard_demo'), $unityRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Unknown repository layout. Refusing to synchronize an unrelated parent repository.'
    }
    if ($Mode -eq 'Update' -and -not $standalone) {
        throw 'This is the GitHub monorepo. Do NOT pull the Unity-only Gitee branch into it. Use Download-Gitee.cmd outside this checkout, or ask the maintainer to import Gitee changes.'
    }
    if ($standalone) { Assert-Clean $repoRoot }
    else { Assert-Clean $repoRoot @('UnityCard_demo') }

    $remoteNames = @(Invoke-Git @('-C', $repoRoot, 'remote'))
    if ($remoteNames -contains 'gitee') {
        $fetchUrls = @(Invoke-Git @('-C', $repoRoot, 'remote', 'get-url', '--all', 'gitee'))
        $pushUrls = @(Invoke-Git @('-C', $repoRoot, 'remote', 'get-url', '--push', '--all', 'gitee'))
        if ($fetchUrls.Count -ne 1 -or $pushUrls.Count -ne 1 -or $fetchUrls[0] -ne $giteeUrl -or $pushUrls[0] -ne $giteeUrl) {
            throw 'Remote gitee points somewhere else. No URL was changed; ask the maintainer to inspect it.'
        }
    }
    else { Invoke-Git @('-C', $repoRoot, 'remote', 'add', 'gitee', $giteeUrl) }

    Write-Host 'Authentication is handled by Git Credential Manager. Never send passwords or tokens in chat.'
    if ($Mode -eq 'Update') {
        Invoke-Git @('-C', $repoRoot, 'fetch', '--no-tags', 'gitee', 'refs/heads/main')
        # Check again after network access. Unity/user edits during fetch must not be overwritten.
        Assert-Clean $repoRoot
        & git -C $repoRoot merge-base --is-ancestor HEAD FETCH_HEAD
        if ($LASTEXITCODE -ne 0) { throw 'Local history is ahead or diverged. No merge was attempted; commit/publish or ask for help.' }
        Invoke-Git @('-C', $repoRoot, 'merge', '--ff-only', 'FETCH_HEAD')
        Write-Host 'Update complete. Open this project in Unity Hub.' -ForegroundColor Green
    }
    else {
        if ($standalone) {
            # Only existing commits are published. Nothing is automatically staged or committed.
            Invoke-Git @('-C', $repoRoot, 'push', 'gitee', 'HEAD:refs/heads/main')
        }
        else {
            # Preserve ancestry for incremental sync; never push the whole web repository to Gitee.
            $splitOutput = @(Invoke-Git @('-C', $repoRoot, 'subtree', 'split', '--prefix=UnityCard_demo', 'HEAD'))
            $splitCommit = ($splitOutput | Where-Object { $_ -match '^[a-f0-9]{40}$' } | Select-Object -Last 1)
            if (-not $splitCommit) { throw 'Could not determine the Unity-only commit.' }
            Assert-Clean $repoRoot @('UnityCard_demo')
            Invoke-Git @('-C', $repoRoot, 'push', 'gitee', ($splitCommit + ':refs/heads/main'))
        }
        Write-Host 'Gitee main published. GitHub origin was not changed.' -ForegroundColor Green
    }
    Write-Host ('Project: ' + $unityRoot)
    exit 0
}
catch {
    Write-Host ('STOPPED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Existing files/branches were not reset or deleted. For private repos, finish Gitee sign-in in the Git window.'
    exit 1
}
