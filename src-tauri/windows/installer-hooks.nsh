; Hooks for the Windows installer Tauri generates (#81, docs/PACKAGING.md).
;
; Uninstalling removes V2's browser registrations: the keys below HKEY_CURRENT_USER that the app's
; Settings, Browser writes (crates/velocity-core/src/browser/registration.rs). Each is named after
; V2's release native-messaging host, so V1's (com.velocity.download_manager) is never touched. A
; test in src-tauri checks these names against branding.json.
;
; An upgrade runs the old uninstaller with /UPDATE ($UpdateMode = 1); the keys stay then, so the
; browsers keep working with the new version. The manifests they point to live in V2's data folder,
; which the uninstaller removes only when the user ticks "Delete the application data".

; The 0.1.x releases were named "Velocity Download Manager V2" (ADR-0016), and Tauri names the
; install folder, the Apps & features key and the shortcuts after the product name. Installing
; Apollo Download Manager over 0.1.x would leave that install and its entry behind (ADR-0018, #347),
; so the install first runs the old uninstaller as an update: it removes the old programs and the
; old Apps & features key, and keeps the data, the settings and the browser registrations, whose
; manifests the app points at the new native host on its next start. The update leaves the old
; shortcuts, so they are removed here, but only when they point into the old install folder.
; The names are checked by a test in src-tauri.

!define OLD_PRODUCTNAME "Velocity Download Manager V2"
!define OLD_UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${OLD_PRODUCTNAME}"
!define OLD_MANUPRODUCTKEY "Software\Velocity Project\${OLD_PRODUCTNAME}"

!macro RemoveOldShortcut shortcut target
  !insertmacro IsShortcutTarget "${shortcut}" "${target}"
  Pop $0
  ${If} $0 = 1
    !insertmacro UnpinShortcut "${shortcut}"
    Delete "${shortcut}"
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  ; InstallLocation is written in quotes.
  ReadRegStr $R0 HKCU "${OLD_UNINSTKEY}" "InstallLocation"
  StrCpy $R1 $R0 1
  ${If} $R1 == '"'
    StrCpy $R0 $R0 "" 1
    StrCpy $R0 $R0 -1
  ${EndIf}
  ${If} $R0 != ""
  ${AndIf} ${FileExists} "$R0\uninstall.exe"
    DetailPrint "Removing ${OLD_PRODUCTNAME} from $R0, keeping its data"
    ; _?= runs the uninstaller in place and waits for it; it then can't delete itself.
    ExecWait '"$R0\uninstall.exe" /S /UPDATE _?=$R0' $R2
    ${If} $R2 = 0
      Delete "$R0\uninstall.exe"
      RMDir "$R0"
      !insertmacro RemoveOldShortcut "$SMPROGRAMS\${OLD_PRODUCTNAME}.lnk" "$R0\${MAINBINARYNAME}.exe"
      !insertmacro RemoveOldShortcut "$DESKTOP\${OLD_PRODUCTNAME}.lnk" "$R0\${MAINBINARYNAME}.exe"
      DeleteRegKey HKCU "${OLD_MANUPRODUCTKEY}"
      DeleteRegKey /ifempty HKCU "Software\Velocity Project"
    ${Else}
      ; The old install stays, with its entry, rather than half removed.
      DetailPrint "The ${OLD_PRODUCTNAME} uninstaller failed ($R2); it stays installed"
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\com.velocity.download_manager_v2"
    DeleteRegKey HKCU "Software\Chromium\NativeMessagingHosts\com.velocity.download_manager_v2"
    DeleteRegKey HKCU "Software\Microsoft\Edge\NativeMessagingHosts\com.velocity.download_manager_v2"
    DeleteRegKey HKCU "Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.velocity.download_manager_v2"
    DeleteRegKey HKCU "Software\Mozilla\NativeMessagingHosts\com.velocity.download_manager_v2"
  ${EndIf}
!macroend
