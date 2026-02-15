!macro customInit
  IfSilent done

  StrCpy $0 ""
  StrCpy $1 ""
  StrCpy $2 ""

  ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ReadRegStr $1 HKCU "${UNINSTALL_REGISTRY_KEY}" "UninstallString"

  StrCmp $0 "" 0 has_install
  StrCmp $1 "" 0 has_install

  ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ReadRegStr $1 HKLM "${UNINSTALL_REGISTRY_KEY}" "UninstallString"

  StrCmp $0 "" 0 has_install
  StrCmp $1 "" done has_install

has_install:
  StrCmp $0 "" 0 +2
  StrCpy $0 "(unknown)"

  StrCmp $LANGUAGE "2052" set_zh_cn
  StrCmp $LANGUAGE "1028" set_zh_tw
  Goto set_en

set_zh_cn:
  StrCpy $2 "检测到已安装 AinoldMarkdown，路径：$0$\n$\n是否继续并覆盖安装？"
  Goto ask_confirm

set_zh_tw:
  StrCpy $2 "檢測到已安裝 AinoldMarkdown，路徑：$0$\n$\n是否繼續並覆蓋安裝？"
  Goto ask_confirm

set_en:
  StrCpy $2 "Detected existing AinoldMarkdown installation path: $0$\n$\nContinue and overwrite existing installation?"

ask_confirm:
  MessageBox MB_ICONQUESTION|MB_YESNO "$2" IDYES done
  Quit

done:
!macroend
