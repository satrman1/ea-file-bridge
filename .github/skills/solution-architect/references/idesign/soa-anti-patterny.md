# Pět SOA anti-patternů

Zdroj: díl 3 (SOA Anti-Patterns, 2011). Vyhýbání se jim je explicitní raison d'être Metody;
design review se na jejich náznaky přímo ptá.

## Čtyři diagnostické metriky (společné všem)

1. Přiměřený **počet služeb** (komponent).
2. Přiměřený **počet a hrubost operací**.
3. Množství **kódu vytlačeného do klienta**.
4. **Stupeň a typ couplingu.**

Extrémy metrik = extrémy U-křivky nákladů.

## Katalog

### 1. Object-centric („SO != OO")
Funkcionální dekompozice v převleku objektů; typický produkt **juniorů**. Symptomy:
proliferace drobných služeb, operace imitující properties, orchestrace v klientovi,
„Mound of Mud". Remedy: služby kompozovatelné, ne hierarchické; orchestraci
**internalizovat**; rozhraní hrubá.

### 2. Super-service-centric („Services are not general purpose")
Opačný pól; stavějí ho **senioři**. Symptomy: monolitická drahá služba, „context shims"
v klientovi, coupling kontextů a domén, **prefix/suffix smell** operací
(`ValidateMemberEntry` / `ValidateStaffEntry` / …), sdílené lifetimes. Remedy: segregovat
domény, kontexty, subsystémy — „seemingly similar workflows are not".

### 3. UI-centric
Funkcionální dekompozice podle obrazovek. Symptomy: form-centric služby, control-centric
operace, BL v klientovi, coupling na layouty. Remedy: business fokus od sběru požadavků;
„Screen shots good for UI guys, not for SOA"; doménoví experti.

### 4. Data-centric („services have nothing to do with data")
Symptomy: služba per tabulka, „schema as service", veřejné CRUD, lifetime svázaný se
zdrojem. Remedy: „**Always think business, not data**"; use cases informují tvar dat;
ResourceAccess abstrahuje zdroj; „Resist the RAD temptation! Especially for Read"
(RAD data-services „forfeit TCO for TTM").

### 5. Code-centric („forgotten truth: messages")
Spoléhání na frameworky zastírající messaging; služby jsou „a thin veil", skutečná síla
je „software in motion". Remedy: pamatovat na zprávy — nejvyšší úroveň decouplingu
(viz [messaging](messaging.md)).

## Triáda remedy (refrén všech náprav)

„**Domain informed, Context relative, Use case driven.**"
V Metodě se zrcadlí jako use-case-informed kontrakty a business verbs vs. CRUDS.

## Použití při review

Pro každý anti-pattern polož diagnostickou otázku: Kdo orchestruje? (klient = 1) Liší se
operace jen prefixem? (= 2) Jmenují se služby po obrazovkách? (= 3) Kopírují schéma? (= 4)
Ví někdo, jaké zprávy tečou systémem? (ne = 5). Nálezy vztáhni ke čtyřem metrikám.
