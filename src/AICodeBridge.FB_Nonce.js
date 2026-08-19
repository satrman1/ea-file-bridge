// AICodeBridge.FB_Nonce(seedExtra)
// Jednorazovy autorizacni token confirm okruhu (iterace 4b V2, oprava B2:
// token NENI hash payloadu - hash si autor davky dopocita z vlastniho
// plaintextu). JScript ES3 nema crypto -> nonce kombinuje VICE zdroju
// entropie a prozene je pres FB_Sha256:
//   1. cas pred a po spin-loopu (ms),
//   2. pocet iteraci spin-loopu za ~3 ms (jitter CPU/planovace),
//   3. 4x Math.random() (stav PRNG procesu pumpy/EA - autor davky ho nezna),
//   4. 2x FSO.GetTempName() (nezavisly generator Windows),
//   5. seedExtra (payloadHash + id davky + identita repozitare),
//   6. inkrementalni in-memory citac (unikatnost v ramci session).
// Vysledek: 64 hex znaku. Zije VYHRADNE v res-*.json (par. 6.1, 6.3);
// pri kazdem dalsim kroku (potvrzeni/zamitnuti/re-klasifikace) se res
// prepise -> nonce je jednorazovy. Obrana nestoji na kryptograficke
// dokonalosti, ale na tom, ze hodnota neni odvoditelna z plaintextu davky
// (B2) a executor prijima potvrzeni jen z lokalniho vyvolani, nikdy
// z obsahu davky (B1, vynucuje FB_Main).
var t1 = new Date().getTime();
var spin = 0;
while (new Date().getTime() - t1 < 3) { spin++; }
var t2 = new Date().getTime();
var tmp1 = "", tmp2 = "";
try {
    var fso = this.FB_ComObj("Scripting.FileSystemObject");
    tmp1 = "" + fso.GetTempName();
    tmp2 = "" + fso.GetTempName();
} catch (e) { }
this._fbNonceCtr = (typeof this._fbNonceCtr == "number") ? this._fbNonceCtr + 1 : 1;
var seed = t1 + "|" + t2 + "|" + spin
    + "|" + Math.random() + "|" + Math.random() + "|" + Math.random() + "|" + Math.random()
    + "|" + tmp1 + "|" + tmp2
    + "|" + this._fbNonceCtr + "|" + ("" + seedExtra);
return "" + this.FB_Sha256(seed);
