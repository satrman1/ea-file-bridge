' Krok 0, test 2 (cast P2): COM attach na bezici EA z Windows Script Hostu.
' Spusteni: nejdriv otevrit EA s projektem, pak dvojklik na tento soubor.
' Okenko s cestou k repository = OK.
Option Explicit
On Error Resume Next

Dim ea
Set ea = GetObject(, "EA.App")
If Err.Number <> 0 Then
    MsgBox "NEPOVEDLO SE: EA nebezi, nebo COM pripojeni selhalo." & vbCrLf & vbCrLf & _
           "Chyba " & Err.Number & ": " & Err.Description, vbExclamation, "COM attach test"
    WScript.Quit
End If

Dim cs
cs = ea.Repository.ConnectionString
If Err.Number <> 0 Then
    MsgBox "EA bezi, ale nejde precist repository (neni otevreny projekt?)." & vbCrLf & vbCrLf & _
           "Chyba " & Err.Number & ": " & Err.Description, vbExclamation, "COM attach test"
Else
    MsgBox "COM attach OK" & vbCrLf & vbCrLf & "Repository: " & cs, vbInformation, "COM attach test"
End If
