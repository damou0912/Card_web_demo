; -*- coding: utf-8 -*-
Unicode True
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
!include "WinVer.nsh"

!ifndef RELEASE_DIR
  !error "Specify /DRELEASE_DIR=..."
!endif
!ifndef SETUP_OUTPUT
  !error "Specify /DSETUP_OUTPUT=..."
!endif

!define PRODUCT "GitHub 中文同步助手"
!define APP_FILE "GitHub中文同步助手.exe"
!define PRODUCT_ID "GitHubSyncZh-25e541b8-3ee1-4fd8-b106-08312eeec426"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\GitHubSyncZh"

Name "${PRODUCT}"
OutFile "${SETUP_OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\GitHubSyncZh"
InstallDirRegKey HKCU "${UNINSTALL_KEY}" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 16
SetDatablockOptimize on
ManifestDPIAware true
BrandingText "中文界面 · 多电脑同步"
ShowInstDetails show
ShowUninstDetails show
VIProductVersion "1.0.0.0"
VIAddVersionKey /LANG=2052 "ProductName" "${PRODUCT}"
VIAddVersionKey /LANG=2052 "FileDescription" "GitHub 中文同步助手安装程序"
VIAddVersionKey /LANG=2052 "FileVersion" "1.0.0"
VIAddVersionKey /LANG=2052 "ProductVersion" "1.0.0"
VIAddVersionKey /LANG=2052 "LegalCopyright" "独立开发的中文 Git 客户端"

Var TestMode
Var StartMenuFolder
Var DesktopShortcut

!define MUI_ICON "build\app.ico"
!define MUI_UNICON "build\app.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "欢迎安装 GitHub 中文同步助手"
!define MUI_WELCOMEPAGE_TEXT "在多台电脑之间上传、下载和检查项目改动。$\r$\n$\r$\n安装包已包含 Git 和登录组件，无需另外安装 GitHub Desktop。$\r$\n$\r$\n程序安装到当前用户目录，并创建桌面和开始菜单快捷方式。$\r$\n$\r$\n点击“下一步”继续。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "安装完成"
!define MUI_FINISHPAGE_TEXT "GitHub 中文同步助手已经安装。$\r$\n$\r$\n你可以从桌面或开始菜单打开程序。首次运行需要解压内置 Git；首次上传时，请按提示登录 GitHub。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_FILE}"
!define MUI_FINISHPAGE_RUN_TEXT "现在打开 GitHub 中文同步助手"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!insertmacro MUI_PAGE_FINISH

!define MUI_UNCONFIRMPAGE_TEXT_TOP "卸载程序及其快捷方式。项目文件、GitHub 登录凭据和用户配置会保留。"
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "SimpChinese"

Function .onInit
  SetShellVarContext current
  SetRegView 64
  StrCpy $TestMode "0"
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/TEST" $1
  ${IfNot} ${Errors}
    StrCpy $TestMode "1"
  ${EndIf}
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "此程序需要 64 位 Windows 10 或 Windows 11。" /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "此程序需要 Windows 10 或 Windows 11。" /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" "Release"
  ${If} $0 < 528040
    MessageBox MB_OK|MB_ICONSTOP "系统缺少 .NET Framework 4.8。请先通过 Windows 更新安装该组件，再重新运行本安装包。" /SD IDOK
    SetErrorLevel 2
    Abort
  ${EndIf}
  ; Match InstallDirRegKey's default view for per-user uninstall registration.
  SetRegView 32
FunctionEnd

Function .onVerifyInstDir
  IfFileExists "$INSTDIR\*.*" 0 ValidDirectory
  ReadINIStr $0 "$INSTDIR\.githubsynczh-install.ini" "Install" "ProductId"
  ${If} $0 != "${PRODUCT_ID}"
    Abort
  ${EndIf}
  ValidDirectory:
FunctionEnd

Section "安装程序" MainSection
  ; Also validate in silent mode. Do not install into an unrelated nonempty folder.
  IfFileExists "$INSTDIR\*.*" 0 WriteFiles
  ReadINIStr $0 "$INSTDIR\.githubsynczh-install.ini" "Install" "ProductId"
  ${If} $0 != "${PRODUCT_ID}"
    MessageBox MB_OK|MB_ICONSTOP "请选择一个空文件夹，或本程序原来的安装目录。" /SD IDOK
    SetErrorLevel 3
    Abort
  ${EndIf}
  WriteFiles:
  SetOutPath "$INSTDIR"
  SetOverwrite on
  File "${RELEASE_DIR}\${APP_FILE}"
  File "${RELEASE_DIR}\使用说明.md"
  File "${RELEASE_DIR}\Git-LICENSE.txt"
  File /oname=NSIS-LICENSE.txt "${NSISDIR}\COPYING"
  WriteUninstaller "$INSTDIR\卸载.exe"
  WriteINIStr "$INSTDIR\.githubsynczh-install.ini" "Install" "ProductId" "${PRODUCT_ID}"
  WriteINIStr "$INSTDIR\.githubsynczh-install.ini" "Install" "TestMode" "$TestMode"

  ${If} $TestMode == "1"
    ; Test mode exercises the same file and shortcut code inside the test directory,
    ; without touching the user's desktop, start menu, or uninstall registry.
    StrCpy $StartMenuFolder "$INSTDIR\test-shortcuts\StartMenu"
    StrCpy $DesktopShortcut "$INSTDIR\test-shortcuts\桌面快捷方式.lnk"
  ${Else}
    StrCpy $StartMenuFolder "$SMPROGRAMS\${PRODUCT}"
    StrCpy $DesktopShortcut "$DESKTOP\${PRODUCT}.lnk"
  ${EndIf}
  CreateDirectory "$StartMenuFolder"
  CreateShortcut "$StartMenuFolder\${PRODUCT}.lnk" "$INSTDIR\${APP_FILE}"
  CreateShortcut "$StartMenuFolder\使用说明.lnk" "$INSTDIR\使用说明.md"
  CreateShortcut "$StartMenuFolder\卸载.lnk" "$INSTDIR\卸载.exe"
  CreateShortcut "$DesktopShortcut" "$INSTDIR\${APP_FILE}"
  ${If} $TestMode != "1"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${PRODUCT}"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "1.0.0"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\${APP_FILE},0"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\卸载.exe"'
    WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\卸载.exe" /S'
    WriteRegDWORD HKCU "${UNINSTALL_KEY}" "EstimatedSize" 48900
    WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
    WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
  ${EndIf}
SectionEnd

Function un.onInit
  SetShellVarContext current
  SetRegView 32
  ReadINIStr $0 "$INSTDIR\.githubsynczh-install.ini" "Install" "ProductId"
  ${If} $0 != "${PRODUCT_ID}"
    MessageBox MB_OK|MB_ICONSTOP "未找到正确的安装记录。为保护文件，卸载已停止。" /SD IDOK
    SetErrorLevel 3
    Abort
  ${EndIf}
  ReadINIStr $TestMode "$INSTDIR\.githubsynczh-install.ini" "Install" "TestMode"
FunctionEnd

Section "Uninstall"
  ; Delete only the files owned by this installer. Never recursively delete $INSTDIR.
  ClearErrors
  Delete "$INSTDIR\${APP_FILE}"
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "请先关闭 GitHub 中文同步助手，再重新卸载。" /SD IDOK
    SetErrorLevel 4
    Abort
  ${EndIf}
  ${If} $TestMode == "1"
    StrCpy $StartMenuFolder "$INSTDIR\test-shortcuts\StartMenu"
    StrCpy $DesktopShortcut "$INSTDIR\test-shortcuts\桌面快捷方式.lnk"
  ${Else}
    StrCpy $StartMenuFolder "$SMPROGRAMS\${PRODUCT}"
    StrCpy $DesktopShortcut "$DESKTOP\${PRODUCT}.lnk"
  ${EndIf}
  Delete "$DesktopShortcut"
  Delete "$StartMenuFolder\${PRODUCT}.lnk"
  Delete "$StartMenuFolder\使用说明.lnk"
  Delete "$StartMenuFolder\卸载.lnk"
  RMDir "$StartMenuFolder"
  ${If} $TestMode == "1"
    RMDir "$INSTDIR\test-shortcuts"
  ${Else}
    ; If a second installation owns the registry entry, leave that entry intact.
    ReadRegStr $0 HKCU "${UNINSTALL_KEY}" "InstallLocation"
    ${If} $0 == $INSTDIR
      DeleteRegKey HKCU "${UNINSTALL_KEY}"
    ${EndIf}
  ${EndIf}
  Delete "$INSTDIR\使用说明.md"
  Delete "$INSTDIR\Git-LICENSE.txt"
  Delete "$INSTDIR\NSIS-LICENSE.txt"
  Delete "$INSTDIR\.githubsynczh-install.ini"
  Delete "$INSTDIR\卸载.exe"
  SetOutPath "$TEMP"
  RMDir "$INSTDIR"
SectionEnd
