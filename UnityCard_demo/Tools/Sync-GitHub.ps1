[CmdletBinding()]
param([ValidateSet('Update', 'Publish')][string]$Mode = 'Update')

# ASCII source supports Windows PowerShell 5.1 without a UTF-8 BOM.
# GitHub uses the full repository, with the Unity project under UnityCard_demo/.
$ErrorActionPreference = 'Stop'
$githubUrl = 'https://github.com/damou0912/Card_web_demo.git'
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

function Assert-Ready([string]$Repo) {
    if (Test-Path -LiteralPath (Join-Path $unityRoot 'Library/UnityLockfile')) {
        throw 'Close this project in Unity before synchronizing. UnityLockfile is present.'
    }
    $branch = Get-GitText @('-C', $Repo, 'symbolic-ref', '--quiet', '--short', 'HEAD')
    if ($branch -ne 'main') { throw "Expected branch main, found $branch. No branch was changed." }
    foreach ($operation in @('MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply')) {
        $operationPath = Get-GitText @('-C', $Repo, 'rev-parse', '--path-format=absolute', '--git-path', $operation)
        if (Test-Path -LiteralPath $operationPath) { throw 'A Git merge/rebase/cherry-pick is in progress. Finish or cancel it before syncing.' }
    }
    $changes = Get-GitText @('-C', $Repo, 'status', '--porcelain=v1', '--untracked-files=normal')
    if ($changes) {
        Write-Host $changes
        throw 'Local changes found. Save/commit them first. This tool never overwrites or auto-stashes your work.'
    }
}

function Assert-Origin([string]$Repo) {
    $fetchUrls = @(Invoke-Git @('-C', $Repo, 'remote', 'get-url', '--all', 'origin'))
    $pushUrls = @(Invoke-Git @('-C', $Repo, 'remote', 'get-url', '--push', '--all', 'origin'))
    if ($fetchUrls.Count -ne 1 -or $pushUrls.Count -ne 1 -or $fetchUrls[0] -ne $githubUrl -or $pushUrls[0] -ne $githubUrl) {
        throw 'Remote origin does not match the expected GitHub URL. No URL was changed; ask the maintainer to inspect it.'
    }
}

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git for Windows is required: https://git-scm.com/downloads/win' }
    if (-not (Test-Path -LiteralPath (Join-Path $unityRoot 'ProjectSettings/ProjectVersion.txt'))) { throw 'Keep this script in UnityCard_demo/Tools.' }
    $repoRoot = [IO.Path]::GetFullPath((Get-GitText @('-C', $unityRoot, 'rev-parse', '--show-toplevel'))).TrimEnd('\', '/')
    if (-not [string]::Equals((Join-Path $repoRoot 'UnityCard_demo'), $unityRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Expected the GitHub repository with a UnityCard_demo subfolder. A standalone or former mirror checkout cannot be updated in place. Clone a separate GitHub copy; preserve your old files.'
    }
    $null = Get-GitText @('-C', $repoRoot, 'cat-file', '-t', 'HEAD:UnityCard_demo/ProjectSettings/ProjectVersion.txt')
    Assert-Ready $repoRoot
    Assert-Origin $repoRoot
    $startingHead = Get-GitText @('-C', $repoRoot, 'rev-parse', 'HEAD')
    Write-Host 'GitHub only. Authentication is handled by Git Credential Manager; do not send credentials in chat.'

    if ($Mode -eq 'Update') {
        Invoke-Git @('-C', $repoRoot, 'fetch', '--no-tags', 'origin', 'refs/heads/main')
        $remoteCommit = Get-GitText @('-C', $repoRoot, 'rev-parse', 'FETCH_HEAD^{commit}')
        # Protect edits and branch changes made while the network request was running.
        Assert-Ready $repoRoot
        Assert-Origin $repoRoot
        if ((Get-GitText @('-C', $repoRoot, 'rev-parse', 'HEAD')) -ne $startingHead) { throw 'Local HEAD changed during fetch. Run again after checking your repository.' }
        & git -C $repoRoot merge-base --is-ancestor HEAD $remoteCommit
        if ($LASTEXITCODE -ne 0) { throw 'Local history is ahead or diverged. No merge was attempted; publish or ask for help.' }
        Invoke-Git @('-C', $repoRoot, '-c', 'merge.autostash=false', 'merge', '--ff-only', $remoteCommit)
        Write-Host 'GitHub update complete. Open the UnityCard_demo subfolder in Unity Hub.' -ForegroundColor Green
    }
    else {
        Write-Host 'Publishing existing commits for the ENTIRE repository, including committed web changes. Nothing is auto-staged or committed.'
        # Explicit commit and ref; never mirror, force, publish tags or split directory history.
        Invoke-Git @('-C', $repoRoot, 'push', 'origin', ($startingHead + ':refs/heads/main'))
        Write-Host 'GitHub main published.' -ForegroundColor Green
    }
    Write-Host ('Project: ' + $unityRoot)
    exit 0
}
catch {
    Write-Host ('STOPPED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'No automatic reset, delete, force-push or stash was attempted. Check the message above before retrying.'
    exit 1
}
