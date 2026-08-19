# ============================================================================
# EA File Bridge - VRATNY (AI import rezim, iterace 4)
# Kanon = model AICodeBridge.FB_Gatekeeper; NIKDY nelezi na disku jako skript
# (launcher FB_GatekeeperLaunch materializuje inline do -EncodedCommand).
# Radky zacinajici # a prazdne radky launcher pri materializaci vypousti (W2).
# Parametry dosazuje launcher PRED tento kod: $RepoId, $BaseDir, $DlDir,
# $SessionInfo, $ReapTimeoutMin, $ReattachSec, $HealthSec, $ReapGraceSec, $StuckSec
# Bezi VYHRADNE ve Windows PowerShell 5.1 (powershell.exe, nikdy pwsh - I1).
# ============================================================================
$ErrorActionPreference='Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
# --- W3: single-instance mutex (drzi PROCES vratneho, ne EA; prezije restart EA) ---
$key=($RepoId.ToUpper() -replace '[^A-Z0-9]','_')
if($key.Length -gt 32){
$m5=[System.Security.Cryptography.MD5]::Create()
$key=([BitConverter]::ToString($m5.ComputeHash([Text.Encoding]::UTF8.GetBytes($RepoId.ToUpper()))) -replace '-','').Substring(0,8)
}
$mxN="Local\EAFB_Gatekeeper_v1_$key"
$mx=New-Object System.Threading.Mutex($false,$mxN)
$mxA=$false
$got=$false
try{$got=$mx.WaitOne(0)}
catch [System.Threading.AbandonedMutexException]{$got=$true;$mxA=$true}
if(-not $got){
[System.Windows.Forms.MessageBox]::Show("AI import rezim pro '$RepoId' uz bezi - druha instance se nespusti (exit 2).`nBezici rezim najdes podle stavoveho okna; po restartu EA se prisaje sam, znovu ho nezapinej.","EA File Bridge",'OK','Information')|Out-Null
exit 2
}
# --- slozky (souborovy kanon beze zmeny; pending\ = cekajici ELEVATED) ---
$REQ="$BaseDir\requests"
$RES="$BaseDir\responses"
$PEND="$REQ\pending"
$PROC="$REQ\processed"
$REJ="$REQ\rejected"
foreach($d in @($REQ,$RES,$PEND,$PROC,$REJ)){if(-not(Test-Path $d)){New-Item -ItemType Directory -Path $d|Out-Null}}
# --- stav ---
$script:repo=$null
$script:state='REATTACHING'
$script:detAt=Get-Date
$script:att=0
$script:lastTry=(Get-Date).AddYears(-1)
$script:lastHc=Get-Date
$script:reapAt=$null
$script:sem='WAIT'
$script:seen=@{}
$script:cIn=0
$script:cOk=0
$script:cErr=0
$script:cConf=0
$script:cDeny=0
$script:lastRes='-'
$script:busy=$false
$script:selfClip=$false
$script:clipOff=$false
$script:elapsed=0
$script:t0=Get-Date
$script:tick=0
$script:LogBuf=@()
$script:ended=$false
$script:quitCode=$null
$U8=New-Object System.Text.UTF8Encoding($false)
$SHA=[System.Security.Cryptography.SHA256]::Create()
function H($t){([BitConverter]::ToString($SHA.ComputeHash($U8.GetBytes($t))) -replace '-','').ToLower()}
function RN($n){if($n -match '^req'){return ($n -replace '^req','res')}return "res-$n"}
# --- clipboard listener (udalostni, ne polling - W1/R5 podminka) ---
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition 'using System;using System.Runtime.InteropServices;using System.Windows.Forms;public class EAFBClip:NativeWindow{[DllImport("user32.dll")]static extern bool AddClipboardFormatListener(IntPtr h);[DllImport("user32.dll")]static extern bool RemoveClipboardFormatListener(IntPtr h);public event EventHandler Update;public EAFBClip(IntPtr h){AssignHandle(h);AddClipboardFormatListener(h);}public void Stop(){try{RemoveClipboardFormatListener(Handle);}catch{}ReleaseHandle();}protected override void WndProc(ref Message m){if(m.Msg==0x031D){EventHandler u=Update;if(u!=null)u(this,EventArgs.Empty);}base.WndProc(ref m);}}'
# --- stavove okno ---
$f=New-Object System.Windows.Forms.Form
$f.Text="EA File Bridge - vratny [$RepoId]"
$f.TopMost=$true
$f.FormBorderStyle='FixedSingle'
$f.MaximizeBox=$false
$f.ClientSize=New-Object System.Drawing.Size(600,560)
$lS=New-Object System.Windows.Forms.Label
$lS.SetBounds(10,8,580,40)
$lS.Font=New-Object System.Drawing.Font('Segoe UI',11,[System.Drawing.FontStyle]::Bold)
$lS.Text='Startuji...'
$f.Controls.Add($lS)
$lI=New-Object System.Windows.Forms.Label
$lI.SetBounds(10,50,580,18)
$f.Controls.Add($lI)
$lQ=New-Object System.Windows.Forms.Label
$lQ.SetBounds(10,72,580,16)
$lQ.Text='Fronta a cekajici davky (vyber radek CEKA pro potvrzeni):'
$f.Controls.Add($lQ)
$lb=New-Object System.Windows.Forms.ListBox
$lb.SetBounds(10,90,580,92)
$f.Controls.Add($lb)
$tS=New-Object System.Windows.Forms.TextBox
$tS.SetBounds(10,186,580,128)
$tS.Multiline=$true
$tS.ReadOnly=$true
$tS.ScrollBars='Vertical'
$f.Controls.Add($tS)
$bA=New-Object System.Windows.Forms.Button
$bA.SetBounds(10,320,180,30)
$bA.Text='Provest (potvrdit)'
$bA.Enabled=$false
$f.Controls.Add($bA)
$bN=New-Object System.Windows.Forms.Button
$bN.SetBounds(200,320,180,30)
$bN.Text='Zamitnout'
$bN.Enabled=$false
$f.Controls.Add($bN)
$bQ=New-Object System.Windows.Forms.Button
$bQ.SetBounds(410,320,180,30)
$bQ.Text='Ukoncit rezim'
$f.Controls.Add($bQ)
$tL=New-Object System.Windows.Forms.TextBox
$tL.SetBounds(10,356,580,196)
$tL.Multiline=$true
$tL.ReadOnly=$true
$tL.ScrollBars='Vertical'
$f.Controls.Add($tL)
function Log($m){
$script:LogBuf+=("{0:HH:mm:ss} {1}" -f (Get-Date),$m)
if($script:LogBuf.Count -gt 200){$script:LogBuf=$script:LogBuf[-200..-1]}
$tL.Lines=$script:LogBuf
$tL.SelectionStart=$tL.Text.Length
$tL.ScrollToCaret()
}
function UpdUI(){
$pC=@(Get-ChildItem "$PEND\*.json" -File -ea 0).Count
if($script:state -eq 'ATTACHED'){
if($script:sem -eq 'BUSY'){$lS.Text='ZPRACOVAVAM - ted nekopiruj (kdyz EA ukaze dialog, odklikni ho)';$lS.ForeColor='DarkOrange'}
elseif($script:sem -eq 'ACK'){$lS.Text='ODPOVED VE SCHRANCE - Ctrl+V do Copilota'+$(if($pC -gt 0){" | $pC ceka na potvrzeni"});$lS.ForeColor='Green'}
elseif($pC -gt 0){$lS.Text="CEKA NA POTVRZENI ($pC) - vyber davku v seznamu a rozhodni";$lS.ForeColor='DarkOrange'}
else{$lS.Text='CEKAM NA DAVKU (Copy v Copilotu)';$lS.ForeColor='DarkGreen'}
}
elseif($script:state -eq 'REATTACHING'){
$rem=[int]($ReapTimeoutMin*60-((Get-Date)-$script:detAt).TotalSeconds)
if($rem -lt 0){$rem=0}
$lS.Text=('EA NEDOSTUPNA - pokus {0}, do ukonceni {1}:{2:d2}' -f $script:att,[int][math]::Floor($rem/60),($rem%60))
$lS.ForeColor='DarkOrange'
}
elseif($script:state -eq 'REAPING'){
$r2=0
if($script:reapAt){$r2=[int](($script:reapAt-(Get-Date)).TotalSeconds)}
if($r2 -lt 0){$r2=0}
$lS.Text="UKONCUJI - EA nedostupna $ReapTimeoutMin min (zavru se za $r2 s)"
$lS.ForeColor='Red'
}
$lI.Text="Prijato $($script:cIn) | OK $($script:cOk) | chyby $($script:cErr) | potvrzeno $($script:cConf) | zamitnuto $($script:cDeny) | posledni: $($script:lastRes)"
}
function RefreshQ(){
$it=New-Object System.Collections.ArrayList
Get-ChildItem "$PEND\*.json" -File -ea 0|Sort-Object Name|ForEach-Object{[void]$it.Add('CEKA: '+$_.Name)}
Get-ChildItem "$REQ\*.json" -File -ea 0|Sort-Object Name|ForEach-Object{[void]$it.Add('fronta: '+$_.Name)}
if(($lb.Items -join '|') -ne ($it -join '|')){
$sel=$lb.SelectedItem
$lb.Items.Clear()
$it|ForEach-Object{[void]$lb.Items.Add($_)}
if($sel -and $lb.Items.Contains($sel)){$lb.SelectedItem=$sel}
}
}
function ShowSum(){
$i=[string]$lb.SelectedItem
if($i -like 'CEKA: *'){
$n=$i.Substring(6)
$cs="$RES\"+((RN $n) -replace '\.json$','.confirm.txt')
if(Test-Path $cs){$tS.Text=[IO.File]::ReadAllText($cs)}else{$tS.Text="(souhrn davky nenalezen: $cs)"}
$bA.Enabled=$true
$bN.Enabled=$true
}
else{
$tS.Text=''
$bA.Enabled=$false
$bN.Enabled=$false
}
}
function Alive(){try{$null=$script:repo.ConnectionString;return $true}catch{return $false}}
function LostEA(){
$script:repo=$null
$script:state='REATTACHING'
$script:detAt=Get-Date
$script:att=0
Log 'ztrata spojeni s EA - prechazim do re-attach smycky'
UpdUI
}
function Poke($term,$what){
if($script:state -ne 'ATTACHED' -or $null -eq $script:repo){Log "EA neni pripojena - $what pocka ve fronte";return $false}
$script:busy=$true
$script:sem='BUSY'
UpdUI
$f.Refresh()
$ok=$false
$t=Get-Date
try{$null=$script:repo.GetElementsByQuery('FB_Process',$term);$ok=$true}
catch{
Log ('stouchnuti selhalo: '+$_.Exception.Message)
if(-not(Alive)){LostEA}
}
$script:elapsed=((Get-Date)-$t).TotalSeconds
$script:busy=$false
return $ok
}
function TryAttach(){
$script:att++
$a=$null
try{$a=[Runtime.InteropServices.Marshal]::GetActiveObject('EA.App')}catch{return $false}
$r=$null
try{$r=$a.Repository}catch{return $false}
if($null -eq $r){return $false}
$tok=Get-Date -Format 'HHmmssfff'
try{$null=$r.GetElementsByQuery('FB_Process',"ping|$tok")}
catch{Log ('ping selhal: '+$_.Exception.Message+' (je v EA zalozene hledani FB_Process?)');return $false}
$pf="$RES\gk-ping-$tok.json"
if(-not(Test-Path $pf)){Log 'ping bez odpovedi (gk-ping soubor nevznikl) - zkontroluj Add-in Search FB_Process';return $false}
$pj=$null
try{$pj=([IO.File]::ReadAllText($pf)|ConvertFrom-Json)}catch{}
Remove-Item $pf -Force -ea 0
if($null -eq $pj -or "$($pj.repository)" -ne $RepoId){Log ('pripojena EA ma jine repo - neprisavam se (W3 par. 3.3): '+"$($pj.repository)");return $false}
$script:repo=$r
return $true
}
function Mater($t,$src){
# druha obrana B1: nonce/payloadHash nemaji v davce zadne legitimni uziti
if($t -match '"(nonce|payloadHash|confirmNonce|confirmHash|confirmChannel|confirmedBy)"\s*:'){
Log "ODMITNUTO ($src): obsah nese potvrzovaci pole - nematerializuje se (druha obrana B1; prvni = executor E_RISK_CONFIRM)"
return 'forbid'
}
$id='noid-'+(Get-Date -Format 'yyyyMMddHHmmssfff')
if($t -match '"id"\s*:\s*"([^"]{1,80})"'){$id=$Matches[1]}
$id2=($id -replace '[^0-9A-Za-z_.-]','_')
$dk=$id2+'|'+(H $t)
if($script:seen.ContainsKey($dk)){Log "preskoceno ($src): davka $id2 uz byla v teto session prijata (dedup W5)";return 'dup'}
if((Test-Path "$REQ\req-$id2.json") -or (Test-Path "$PEND\req-$id2.json")){Log "preskoceno ($src): req-$id2.json uz je ve fronte nebo ceka na potvrzeni";return 'dup'}
[IO.File]::WriteAllText("$REQ\req-$id2.json",$t,$U8)
$script:seen[$dk]=1
$script:cIn++
Log "prijata davka $id2 ($src) - zarazena do fronty"
RefreshQ
UpdUI
if($script:state -eq 'ATTACHED' -and -not $script:busy){ProcOne}
return 'ok'
}
function AfterRes($n,$mode){
$rp="$RES\"+(RN $n)
if(-not(Test-Path $rp)){
Log "res soubor nevznikl ($n) - zkontroluj responses\gk-error-*.txt"
$script:cErr++
$script:sem='WAIT'
return
}
$raw=[IO.File]::ReadAllText($rp)
$st='?'
if($raw -match '"status"\s*:\s*"([a-z_]+)"'){$st=$Matches[1]}
$code=''
if($raw -match '"code"\s*:\s*"([A-Z_]+)"'){$code=$Matches[1]}
$script:lastRes=(RN $n)+" ($st"+$(if($code){' '+$code})+')'
if($st -eq 'confirm_required'){
Log "davka $n je ELEVATED - ceka na tvoje potvrzeni (viz seznam CEKA)"
$script:sem='CONF'
}
elseif($st -eq 'done'){
if($mode -eq 'confirm'){$script:cConf++}else{$script:cOk++}
$script:sem='ACK'
}
elseif($st -eq 'rejected' -or $code -eq 'E_RISK_REJECTED'){
$script:cDeny++
$script:sem='ACK'
}
else{
$script:cErr++
$script:sem='ACK'
}
# chat verze do schranky (par. 3.3) - executor ji rendruje bez nonce/plneho hashe
$cp=($rp -replace '\.json$','.chat.txt')
$chat=$null
if(Test-Path $cp){$chat=[IO.File]::ReadAllText($cp)}
if($null -eq $chat -or $chat -eq ''){$chat="EAFB $st $code - plna odpoved v "+(RN $n)}
if($script:elapsed -gt $StuckSec){$chat=$chat+"`r`nPOZOR: volani viselo $([int]$script:elapsed) s (EA cekala na lidsky zasah) - vysledek muze byt degradovany (falesne rowCount:0), over kontrolnim ctenim (protokol par. 5a/5)."}
$script:selfClip=$true
try{[System.Windows.Forms.Clipboard]::SetText($chat)}catch{Log 'zapis ACK do schranky selhal'}
UpdUI
}
function ProcOne(){
$q=Get-ChildItem "$REQ\*.json" -File -ea 0|Sort-Object Name|Select-Object -First 1
if($null -eq $q){return}
if(((Get-Date)-$q.LastWriteTime).TotalSeconds -lt 1){return}
$n=$q.Name
Log "zpracovavam $n"
if(Poke ('req|'+$q.FullName) "davka $n"){AfterRes $n 'auto'}
RefreshQ
UpdUI
}
function DoConfirm($approve){
$i=[string]$lb.SelectedItem
if($i -notlike 'CEKA: *'){return}
$n=$i.Substring(6)
$pp="$PEND\$n"
$rp="$RES\"+(RN $n)
if(-not(Test-Path $pp)){Log "davka uz v pending\ neni ($n)";RefreshQ;return}
if(-not(Test-Path $rp)){Log "res soubor chybi - nelze potvrdit ($n), vyres rucne";return}
$r=$null
try{$r=([IO.File]::ReadAllText($rp)|ConvertFrom-Json)}catch{}
if($null -eq $r -or "$($r.status)" -ne 'confirm_required' -or $null -eq $r.confirm -or -not $r.confirm.nonce){Log "res neni confirm_required s nonce - nelze potvrdit ($n)";return}
$act='reject'
if($approve){$act='approve'}
Log "$act -> $n (kanal okno)"
if(Poke ('confirm|'+$act+'|'+$pp+'|'+$r.confirm.nonce+'|'+$r.confirm.payloadHash) "potvrzeni $n"){AfterRes $n 'confirm'}
RefreshQ
ShowSum
UpdUI
}
function ScanDl(){
if(-not $DlDir -or -not(Test-Path $DlDir)){return}
Get-ChildItem "$DlDir\ea-req-*.json" -File -ea 0|ForEach-Object{
if(((Get-Date)-$_.LastWriteTime).TotalSeconds -lt 2){return}
$t=$null
try{$t=[IO.File]::ReadAllText($_.FullName)}catch{return}
if($t -notmatch '"protocol"\s*:\s*"eafb/'){return}
$v=Mater $t 'Downloads'
if($v -eq 'forbid'){Move-Item $_.FullName ("$REJ\dl-"+$_.Name+'.'+(Get-Date -Format 'yyyyMMdd-HHmmss')) -Force -ea 0}
else{Remove-Item $_.FullName -Force -ea 0}
}
}
function DoEnd($code){
if($script:ended){return}
$script:ended=$true
try{$tim.Stop()}catch{}
try{if(-not $script:clipOff){$script:clip.Stop();$script:clipOff=$true}}catch{}
$pC=@(Get-ChildItem "$PEND\*.json" -File -ea 0).Count
$qC=@(Get-ChildItem "$REQ\*.json" -File -ea 0).Count
$dur=[int]((Get-Date)-$script:t0).TotalMinutes
$reason='ukonceno rucne (tlacitko Ukoncit / zavreni okna)'
if($code -eq 3){$reason="REAP: EA nedostupna $ReapTimeoutMin min - vratny se ukoncil sam (exit 3)"}
$sum=@('# EA File Bridge - vratny: zaverecny souhrn','',"- Repozitar: $RepoId","- Zacatek: $($script:t0.ToString('yyyy-MM-dd HH:mm:ss')), konec: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss')) ($dur min)","- Otevreni session (W8): $SessionInfo","- Prijato davek: $($script:cIn) | provedeno OK: $($script:cOk) | chyb: $($script:cErr) | potvrzeno ELEVATED: $($script:cConf) | zamitnuto: $($script:cDeny)","- Posledni response: $($script:lastRes)","- Zbyva ve fronte requests\: $qC | ceka na potvrzeni v pending\: $pC (novy vratny je po startu nabidne)","- Duvod konce: $reason")
if($mxA){$sum+='- Mutex prevzat po necistem konci predchozi instance (W3/H6)'}
$txt=($sum -join "`r`n")
try{[IO.File]::WriteAllText("$BaseDir\session-log-"+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.md',$txt,$U8)}catch{}
if($code -eq 0){
# reap NIKDY nesaha na schranku (W3 par. 3.4) - souhrn jen pri rucnim konci
$script:selfClip=$true
try{[System.Windows.Forms.Clipboard]::SetText($txt)}catch{}
}
$script:quitCode=$code
}
function Quit($code){DoEnd $code;$f.Close()}
# --- udalosti ---
$lb.add_SelectedIndexChanged({ShowSum})
$bA.add_Click({DoConfirm $true})
$bN.add_Click({DoConfirm $false})
$bQ.add_Click({Quit 0})
$f.add_FormClosing({DoEnd 0})
$tim=New-Object System.Windows.Forms.Timer
$tim.Interval=1000
$tim.add_Tick({
if($script:busy -or $script:ended){return}
$script:tick++
if($script:state -eq 'REATTACHING'){
if(((Get-Date)-$script:lastTry).TotalSeconds -ge $ReattachSec){
$script:lastTry=Get-Date
if(TryAttach){
$script:state='ATTACHED'
$script:sem='WAIT'
$script:detAt=$null
Log "pripojeno k EA (pokus $($script:att)) - fronta se zpracuje standardne"
}
elseif((((Get-Date)-$script:detAt).TotalMinutes) -ge $ReapTimeoutMin){
$script:state='REAPING'
$script:reapAt=(Get-Date).AddSeconds($ReapGraceSec)
try{if(-not $script:clipOff){$script:clip.Stop();$script:clipOff=$true}}catch{}
Log 'EA se nevratila v limitu - REAP odpocet (schranka se uz necte, do schranky se nic nepise)'
}
}
}
elseif($script:state -eq 'REAPING'){
if((Get-Date) -ge $script:reapAt){Quit 3;return}
}
elseif($script:state -eq 'ATTACHED'){
if(((Get-Date)-$script:lastHc).TotalSeconds -ge $HealthSec){
$script:lastHc=Get-Date
if(-not(Alive)){LostEA;return}
}
ProcOne
}
if($script:state -ne 'REAPING' -and ($script:tick%3) -eq 0){ScanDl}
UpdUI
})
$f.add_Shown({
$f.Activate()
try{
$script:clip=New-Object EAFBClip($f.Handle)
$script:clip.add_Update({
if($script:clipOff -or $script:ended){return}
if($script:selfClip){$script:selfClip=$false;return}
$t=$null
try{if([System.Windows.Forms.Clipboard]::ContainsText()){$t=[System.Windows.Forms.Clipboard]::GetText()}}catch{return}
if($null -eq $t -or $t -notmatch '"protocol"\s*:\s*"eafb/'){return}
$null=Mater $t 'schranka'
})
}
catch{Log ('clipboard listener selhal: '+$_.Exception.Message)}
Log "vratny start | repo $RepoId | mutex $mxN"
if($mxA){Log 'mutex prevzat po necistem konci predchozi instance (W3/H6)'}
Log "base $BaseDir | downloads $DlDir | reap ${ReapTimeoutMin}m/att ${ReattachSec}s/hc ${HealthSec}s/grace ${ReapGraceSec}s/stuck ${StuckSec}s"
Log "session: $SessionInfo"
RefreshQ
UpdUI
$tim.Start()
})
[System.Windows.Forms.Application]::Run($f)
try{$mx.ReleaseMutex()}catch{}
$mx.Dispose()
if($null -eq $script:quitCode){$script:quitCode=0}
exit $script:quitCode
