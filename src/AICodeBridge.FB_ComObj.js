// AICodeBridge.FB_ComObj(progId)
// Engine-agnosticke vytvoreni COM objektu. Pumpa (WSH JScript) ma
// ActiveXObject; in-model add-in runtime EA (JavaScript/Mozilla engine)
// ma COMObject. Kod, ktery muze bezet v OBOU runtime (GUI fallback,
// linked docs), MUSI tvorit COM objekty vyhradne pres tuto operaci.
// LEKCE (20260817, GUI fallback): new ActiveXObject v EA runtime hodi
// ReferenceError a tise shodi cely EA_MenuClick - u uzivatele to vypada,
// ze klik "nic neudelal".
try { return new ActiveXObject(progId); } catch (e) { }
return new COMObject(progId);
