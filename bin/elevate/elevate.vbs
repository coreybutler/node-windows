Set Shell = CreateObject("Shell.Application")
Set WShell = WScript.CreateObject("WScript.Shell")
Set ProcEnv = WShell.Environment("PROCESS")

cmd = ProcEnv("CMD")
app = ProcEnv("APP")
args= Right(cmd,(Len(cmd)-Len(app)))

If (WScript.Arguments.Count >= 1) Then
  Shell.ShellExecute app, args, "", "runas"
Else
  WScript.Quit
End If