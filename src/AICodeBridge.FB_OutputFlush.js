// AICodeBridge.FB_OutputFlush(Repository)
// FB-PU-34 (v0.19, Z261004b-6): zobrazi Output tab "AI Bridge" JEDNOU na konci
// davky, pokud do nej davka neco napsala (Log nastavil pending) a pokud to
// konfigurace nevypina (FB_Config.outputShow: false). Vola finishM ve FB_Main
// u kazdeho navratu; mezipamet davky (this._fbOutputBatch) tim zanika, takze
// Log mimo davku (menu, start session) ukazuje tab hned jako driv.
// Nikdy nevyhazuje - Output je jen popisek.
var ob = this._fbOutputBatch;
this._fbOutputBatch = null;
if (!ob || typeof ob != "object") { return false; }
if (!ob.pending || ob.show === false || ob.shown) { return false; }
try { Repository.EnsureOutputVisible("AI Bridge"); ob.shown = true; return true; } catch (e) { return false; }
