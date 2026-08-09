

#+r::Reload
; ============================================================
; YOUR SCRIPT — WITH COMMENTS ONLY (NO CHANGES TO BEHAVIOR)
; ============================================================

; ------------------------------------------------------------
; Simple direct media remaps (AHK v2)
; These keys ALWAYS perform their media functions globally.
; ------------------------------------------------------------

F7:: {                         ; F7 → Play/Pause media
    Send "{Media_Play_Pause}"
}

F5:: {                         ; F5 → Previous track
    Send "{Media_Prev}"
}

F6:: {                         ; F6 → Next track
    Send "{Media_Next}"
}

F9:: {                         ; F9 → Mute/Unmute system volume
    Send "{Volume_Mute}"
}

F10:: {                        ; F10 → Volume Down
    Send "{Volume_Down}"
}

F11:: {                        ; F11 → Volume Up
    Send "{Volume_Up}"
}

F8:: {                         ; F8 → Stop media
    Send "{Media_Stop}"
}

; ------------------------------------------------------------
; App launchers (quick open)
; ------------------------------------------------------------

F3:: Run "C:\Users\Prisha\AppData\Roaming\Spotify\Spotify.exe"    ; F3 → Launch Spotify
F2:: Run "https://www.primevideo.com/"                            ; F2 → Open Prime Video website

; ------------------------------------------------------------
; Hotstring: #inc → full C++ template (instant expansion)
; Type "#inc" anywhere and it inserts your template.
; ------------------------------------------------------------

:*:#inc:: {
    ; Insert the full C++ boilerplate
    Send("{Text}#include <bits/stdc++.h>`n#define int long long`nusing namespace std;`n`nint32_t main(){`n    cin.tie(0);`n    ios::sync_with_stdio(0);`n`n    `n    return 0;`n}")
    
    ; Move cursor into the blank line inside main() for coding
    Send("{Up}{End}")
    Return
}

; AutoHotkey v2 script

; --- Volume with Alt + Mouse Wheel ---
LWin & WheelUp:: Send "{Volume_Up}"
LWin & WheelDown:: Send "{Volume_Down}"

; --- Media controls with Alt + mouse buttons ---
LWin & RButton:: Send "{Media_Next}"
LWin & MButton:: Send "{Media_Play_Pause}"
LWin & LButton:: Send "{Media_Prev}"

; --- Send Selected Text to ChatGPT Web ---
^+g:: {
    ; Copy current selection
    A_Clipboard := ""
    Send "^c"
    if !ClipWait(1) {
        MsgBox "No text selected!"
        return
    }

    query := A_Clipboard
    ; Clean for URL
    query := StrReplace(query, "`r", " ")
    query := StrReplace(query, "`n", " ")

    ; Encode for URL
    encoded := UriEncode(query)

    ; Open ChatGPT with query
    Run "https://chat.openai.com/?q=" . encoded
}

; --- URL Encode Function ---
UriEncode(str, encoding := "UTF-8") {
    out := ""
    Loop Regen := StrLen(str) {
        ch := SubStr(str, A_Index, 1)
        asc := Ord(ch)
        if (asc >= 48 && asc <= 57      ; 0-9
         || asc >= 65 && asc <= 90     ; A-Z
         || asc >= 97 && asc <= 122    ; a-z
         || asc = 45 || asc = 46 || asc = 95 || asc = 126) ; - . _ ~
            out .= ch
        else
            out .= "%" Format("{:02X}", asc)
    }
    return out
}

#Requires AutoHotkey v2.0

Persistent

ForceOneExplorerWindow()

class ForceOneExplorerWindow {

    static __New() {
        this.FirstWindow := 0
        this.hHook := 0
        this.pWinEventHook := CallbackCreate(ObjBindMethod(this, 'WinEventProc'),, 7)
        this.IgnoreWindows := Map()
        this.shellWindows := ComObject('Shell.Application').Windows
    }

    static Call() {
        this.MergeWindows()
        if !this.hHook {
            this.hHook := DllCall('SetWinEventHook', 'uint', 0x8000, 'uint', 0x8002, 'ptr', 0, 'ptr', this.pWinEventHook
                                , 'uint', 0, 'uint', 0, 'uint', 0x2, 'ptr')
        }
    }

    static GetPath(hwnd) {
        static IID_IShellBrowser := '{000214E2-0000-0000-C000-000000000046}'
        shellWindows := this.shellWindows
        this.WaitForSameWindowCount()
        try activeTab := ControlGetHwnd('ShellTabWindowClass1', hwnd)
        for w in shellWindows {
            if w.hwnd != hwnd
                continue
            if IsSet(activeTab) {
                shellBrowser := ComObjQuery(w, IID_IShellBrowser, IID_IShellBrowser)
                ComCall(3, shellBrowser, 'uint*', &thisTab:=0)
                if thisTab != activeTab
                    continue
            }
            return w.Document.Folder.Self.Path
        }
    }

    static MergeWindows() {
        windows := WinGetList('ahk_class CabinetWClass',,, 'Address: Control Panel')
        if windows.Length > 0 {
            this.FirstWindow := windows.RemoveAt(1)
            if WinGetTransparent(this.FirstWindow) = 0 {
                WinSetTransparent("Off", this.FirstWindow)
            }
        }
        firstWindow := this.FirstWindow
        shellWindows := this.shellWindows
        paths := []
        for w in shellWindows {
            if w.hwnd = firstWindow
                continue
            if InStr(WinGetText(w.hwnd), 'Address: Control Panel') {
                this.IgnoreWindows.Set(w.hwnd, 1)
                continue
            }
            paths.push(w.Document.Folder.Self.Path)
        }
        for hwnd in windows {
            PostMessage(0x0112, 0xF060,,, hwnd)  ; 0x0112 = WM_SYSCOMMAND, 0xF060 = SC_CLOSE
            WinWaitClose(hwnd)
        }
        for path in paths {
            this.OpenInNewTab(path)
        }
    }

    static WinEventProc(hWinEventHook, event, hwnd, idObject, idChild, idEventThread, dwmsEventTime) {
        Critical(-1)
        if !(idObject = 0 && idChild = 0) {
            return
        }
        switch event {
            case 0x8000:  ; EVENT_OBJECT_CREATE
                ancestor := DllCall('GetAncestor', 'ptr', hwnd, 'uint', 2, 'ptr')
                try {
                    if !this.IgnoreWindows.Has(ancestor) && WinExist(ancestor) && WinGetClass(ancestor) = 'CabinetWClass' {
                        if ancestor = this.FirstWindow
                            return
                        if WinGetTransparent(ancestor) = '' {
                            ; Hide window as early as possible
                            WinSetTransparent(0, ancestor)
                        }
                    }
                }
            case 0x8002:  ; EVENT_OBJECT_SHOW
                if WinExist(hwnd) && WinGetClass(hwnd) = 'CabinetWClass' {
                    if InStr(WinGetText(hwnd), 'Address: Control Panel') {
                        this.IgnoreWindows.Set(hwnd, 1)
                        WinSetTransparent('Off', hwnd)
                        return
                    }
                    if !WinExist(this.FirstWindow) {
                        this.FirstWindow := hwnd
                        WinSetTransparent('Off', hwnd)
                    }
                    if WinGetTransparent(hwnd) = 0 {
                        SetTimer(() => (
                            this.OpenInNewTab(this.GetPath(hwnd))
                            , WinClose(hwnd)
                            , WinGetMinMax(this.FirstWindow) = -1 && WinRestore(this.FirstWindow)
                        ), -1)
                    }
                }
            case 0x8001:  ; EVENT_OBJECT_DESTROY
                if this.IgnoreWindows.Has(hwnd)
                    this.IgnoreWindows.Delete(hwnd)
        }
    }

    static WaitForSameWindowCount() {
        shellWindows := this.shellWindows
        windowCount := 0
        for hwnd in WinGetList('ahk_class CabinetWClass') {
            for classNN in WinGetControls(hwnd) {
                if classNN ~= '^ShellTabWindowClass\d+'
                    windowCount++
            }
        }
        ; wait for window count to update
        timeout := A_TickCount + 3000
        while windowCount != shellWindows.Count() {
            sleep 50
            if A_TickCount > timeout
                break
        }
    }

    static OpenInNewTab(path) {
        this.WaitForSameWindowCount()
        hwnd := this.FirstWindow
        shellWindows := this.shellWindows
        Count := shellWindows.Count()
        ; open a new tab (https://stackoverflow.com/a/78502949)
        SendMessage(0x0111, 0xA21B, 0, 'ShellTabWindowClass1', hwnd)
        ; Wait for window count to change
        while shellWindows.Count() = Count {
            sleep 50
        }
        Item := shellWindows.Item(Count)
        if FileExist(path) {
            Item.Navigate2(Path)
        } else {
            ; matches a shell folder path such as ::{F874310E-B6B7-47DC-BC84-B9E6B38F5903}
            if path ~= 'i)^::{[0-9A-F-]+}$'
                path := 'shell:' path
            DllCall('shell32\SHParseDisplayName', 'wstr', path, 'ptr', 0, 'ptr*', &PIDL:=0, 'uint', 0, 'ptr', 0)
            byteCount := DllCall('shell32\ILGetSize', 'ptr', PIDL, 'uint')
            SAFEARRAY := Buffer(16 + 2 * A_PtrSize, 0)
            NumPut 'ushort', 1, SAFEARRAY, 0  ; cDims
            NumPut 'uint', 1, SAFEARRAY, 4  ; cbElements
            NumPut 'ptr', PIDL, SAFEARRAY, 8 + A_PtrSize  ; pvData
            NumPut 'uint', byteCount, SAFEARRAY, 8 + 2 * A_PtrSize  ; rgsabound[1].cElements
            try Item.Navigate2(ComValue(0x2011, SAFEARRAY.ptr))
            DllCall('ole32\CoTaskMemFree', 'ptr', PIDL)
            while Item.Busy {
                sleep 50
            }
        }
    }
}


#HotIf


; ===============================
; Time OSD — AHK v2 (FINAL)
; ===============================

TimeOSDInit() {
    global TimeOSDGui, TimeOSDLabel

    ; Create GUI
    TimeOSDGui := Gui("+AlwaysOnTop +ToolWindow -Caption")
    TimeOSDGui.SetFont("s18", "Calibri")
    TimeOSDGui.MarginX := 0
    TimeOSDGui.MarginY := 0

    TimeOSDLabel := TimeOSDGui.AddText(
        "cWhite w250 h36 Center",
        ""
    )
	
    TimeOSDLabel.OnEvent("Click", TimeOSDClose)

    ; Timer + immediate fire
    SetTimer(TimeOSDPulse, 1000)
   
}

TimeOSDPulse() {
    static lastTime := ""

    currTime := FormatTime(, "h:mm tt")

    ; Prevent repeat spam in same minute
    if (lastTime = currTime)
        return

    if RegExMatch(currTime, ":00")
        TimeOSDShow(currTime, "268BD2")
    else if RegExMatch(currTime, ":20")
        TimeOSDShow(currTime, "859900")
    else if RegExMatch(currTime, ":40")
        TimeOSDShow(currTime, "CB4B16")

    lastTime := currTime
}

TimeOSDShow(timeText, bg) {
    global TimeOSDGui, TimeOSDLabel

    TimeOSDGui.BackColor := bg
    TimeOSDLabel.Text := "It's " timeText " already!"
	SoundPlay("*48")  ;


    y := A_ScreenHeight - 120
    TimeOSDGui.Show("xCenter y" y " NoActivate")

    SetTimer(TimeOSDClose, -10000)
}

TimeOSDClose(*) {
    global TimeOSDGui
    TimeOSDGui.Hide()
}

; ===============================
; ACTUALLY START THE SCRIPT
; ===============================
TimeOSDInit()

TimeOSDShow("Script started", "444444")

~MButton::
{
    if (A_PriorHotkey = "~MButton" && A_TimeSincePriorHotkey < 300)
        Send("!{Tab}")
}
