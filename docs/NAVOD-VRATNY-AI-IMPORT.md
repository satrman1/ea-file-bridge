# AI import režim (vrátný) — návod

Tenhle režim umí jedno: zapneš ho jedním kliknutím v EA a od té chvíle stačí v Copilotu kliknout **Copy** na vygenerovanou dávku — a ona se sama zapíše do modelu. Odpověď ti přistane do schránky, vložíš ji zpět do Copilota (Ctrl+V). Žádné ruční ukládání souborů, žádná spuštěná pumpa.

Mezi dávkami je EA normálně použitelná — zamrzne jen na pár sekund, když zrovna zpracovává dávku.

---

## Co si připravit jednou (a máš na pořád)

Tohle stačí udělat jedinkrát; po restartu EA už se to neztratí.

**1. Nahrát nový kód do modelu.** Spusť pumpu (dvojklik na `pump.wsf`) a přes Copilota (nebo ručně do složky `requests`) pošli dávku `docs\e2e-iterace4\req-20260820-00-deploy.json`. V konzoli pumpy uvidíš, že se nahrálo šest nových věcí (`FB_Gatekeeper`, `FB_GatekeeperLaunch`, `FB_Process`, `FB_ChatRender`, `FB_QcRun`, `FB_QcConfig`) a přepsaly tři.

**2. Zavřít a znovu otevřít EA** (úplně celé, ne jen projekt — jinak se nový kód a nové menu neprojeví).

**3. Založit vyhledávání „FB_Process".** Tohle je ten prvek, přes který vrátný „ťukne" do EA:
- Otevři **Find in Project** (lupa / Ctrl+F v modelu).
- Vlevo nahoře u výběru hledání dej **New Search** (nebo ozubené kolečko → Manage Searches).
- **Search Type / Group Type = Search**.
- Do pole **Add-in Name and method** napiš přesně: `AICodeBridge.FB_Process`
  — **tečka**, ne lomítko. (S lomítkem se nic nestane a nikde to nehlásí — klasická past.)
- Ulož pod názvem **FB_Process**.

Tím máš hotovo napořád.

---

## Každodenní použití

### Zapnutí

V EA: **Specialize → AI Bridge → Zapnout AI import režim (vratny)**.

Objeví se malé **stavové okno** (drží se navrchu). Nahoře svítí zelené **ČEKAM NA DAVKU**. To je celé — režim běží.

> Pumpu přitom **nespouštěj** — vrátný a pumpa by si přetahovaly stejné dávky. Buď jedno, nebo druhé.

### Práce

1. V Copilotu si nech vygenerovat dávku a **přečti si ji** (to je ta chvíle, kdy máš poslední slovo — když je něco špatně, prostě nekopíruj).
2. Klikni **Copy** na code blocku.
3. Okno na chvíli zoranžoví na **ZPRACOVAVAM** — v tu chvíli **nekopíruj nic dalšího** (přepsal bys odpověď, kterou ti vrátný právě chystá).
4. Okno zezelená na **ODPOVED VE SCHRANCE**. Přepni do Copilota a dej **Ctrl+V** — vložíš krátkou odpověď (např. „EAFB OK … 3/3 ops | QC ciste").

Čítače v okně (Prijato / OK / chyby / potvrzeno / zamítnuto) ukazují, co se za session událo.

### Když dávka něco maže, klonuje nebo hromadně přepisuje

Takové dávky režim **sám neprovede** — počká na tvoje svolení. V okně se objeví řádek **CEKA: req-…** a nahoře „CEKA NA POTVRZENI".

- Klikni na ten řádek — dole se ukáže **souhrn konkrétní dávky**: co chce udělat, kterých prvků a balíčků se to týká a proč je označená jako riziková.
- **Provest** = dávka se provede. **Zamitnout** = zahodí se, nic se nestane.
- Když nerozhodneš, dávka **klidně čeká dál** — nikam nezmizí. Můžeš ji potvrdit i za hodinu, nebo po restartu EA (režim si ji pamatuje).
- Čeká-li víc takových dávek, jsou v seznamu všechny — vyřídíš je jednu po druhé.

Do Copilota se nikdy neposílá tajný kód potvrzení — jen krátký „otisk" (pár znaků). Potvrzení je vždycky tvoje kliknutí v okně, nikdy nic z chatu.

### Vypnutí

Klikni **Ukoncit rezim** (nebo zavři okno). Do schránky ti spadne **závěrečný souhrn** session (kolik dávek, co se stalo) — můžeš ho vložit do Copilota, mailu nebo JIRA. Vedle pumpy se navíc uloží soubor `session-log-…md`. Okno zmizí, režim skončil.

---

## Když něco nehraje

**Antivirus (Norton) zablokoval spuštění.** Když se místo okna objeví „CHYBA launcheru vrátného" nebo Norton hlásí `powershell` jako hrozbu (`IDP.HELU.CMD.*`, `CMD:Powershell-AP [Drp]` / „Dropper"), antivirus zablokoval spuštění PowerShellu z EA. To je očekávané téma — vrátný je dlouhoběžící PowerShell hlídající schránku, což antivirus vidí jako podezřelé chování (to samé riziko „AI spouští procesy", které řešíme s bezpečností pro banku). Pokud to Norton blokuje, **neper se s ním výjimkami** — použij místo vrátného **ruční režim ze schránky** (viz níže), který PowerShell vůbec nepotřebuje. A dej mi vědět, že to Norton blokuje — je to důležitý údaj pro bezpečnostní schválení (R5), ne jen domácí potíž.

## Když antivirus blokuje vrátného: ruční režim ze schránky (bez PowerShellu)

Pokud nechceš (nebo nemůžeš kvůli antiviru) používat automatický režim, máš v tomtéž menu položku **Zpracuj dávku ze schránky (File Bridge)**. Funguje celá uvnitř EA, nic nespouští:

1. V Copilotu klikni **Copy** na dávce.
2. V EA: **Specialize → AI Bridge → Zpracuj dávku ze schránky (File Bridge)**.
3. EA si samo přečte dávku ze schránky, zpracuje ji a **odpověď ti vloží zpět do schránky** (a ukáže ji v okně). Přepni do Copilota, **Ctrl+V**.
4. U mazání/klonování se objeví dialog **Ano / Ne / Storno** — stejné potvrzení jako u automatického režimu, jen jako okénko EA.

Rozdíl proti automatickému režimu: musíš na každou dávku kliknout do menu (není to samočinné). Zato to antivirus neřeší, protože se nespouští žádný PowerShell. Úplně stejně funguje i **Process requests (File Bridge)** — jen tam dávku místo Copy uložíš jako soubor do složky `requests`.

**Okno se vůbec neobjevilo (a antivirus mlčí).** Zkus zapnout režim s viditelnou konzolí: vytvoř vedle pumpy soubor `gk-config.json` s obsahem `{ "debug": true }` a zapni režim znovu — otevře se černé okno PowerShellu, kde uvidíš, kde se to zaseklo. (Pošli mi ten výpis.)

**Okno svítí „EA NEDOSTUPNA", i když EA běží.** Nejčastěji je EA spuštěná „jako správce" a vrátný ne (nebo naopak) — musí být oba stejně. Zavři obojí a spusť EA normálně.

**Kliknul jsem Zapnout dvakrát.** Nevadí — druhé okno se slušně odmítne („už běží"). Vždycky běží jen jeden vrátný. Po restartu EA se sám znovu napojí, nemusíš ho zapínat znovu.

**Odpověď říká „0 řádků".** To znamená jen „dotaz nic nevrátil", **ne** „data neexistují" — zvlášť když těsně předtím EA na chvíli zamrzla na nějakém dialogu. Radši si to ověř ještě jednou kontrolním dotazem.

**Dávku jsem zkopíroval dvakrát (nebo přišla i přes Downloads).** Provede se **jen jednou** — vrátný si pamatuje, co už viděl.
