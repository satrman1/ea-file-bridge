## Jmenné konvence pro operace

| ID      | Pravidlo                     | Popis                                                                                                                                                                               |
| ------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N-OPR01 | Jazyk                        | Standardním jazykem pro pojmenovávání operací je angličtina.                                                                                                                        |
| N-OPR02 | Formát                       | Velikost písmen se řídí Pascalovou notací (každé slovo začíná velkým písmenem), povoleny jsou jen znaky anglické abecedy a čísla, bez mezer.                                        |
| N-OPR03 | Aktivita bez business entity | Služba je pojmenovaná podle činnosti, kterou implementuje. **Příklad:**  Služba pro notifikace se jmenuje `Notify`.                                                                 |
| N-OPR04 | Aktivita s business entitou  | Název operace svázané s entitou je determinován názvem entity + slovesem. Viz **Tabulka CRUD operací níže**.                                                                        |
| N-OPR05 | Operace s pořadím v procesu  | U procesů závislých na pořadí volání se používají slovesa `Start`, `Confirm`, `Continue`, `Finish`. **Příklad:** `ChangeUsername`, `ConfirmUsernameChange`, `FinishUsernameChange`. |
| N-OPR06 | REST stereotyp               | U REST služeb stereotypy: `<<REST>>`, nebo `<<REST(GET)>>`, `<<REST(PUT)>>` apod. Vyhnout se stereotypům bez slova REST.                                                            |
| N-OPR07 | REST alias                   | Alias operace obsahuje relativní URL k endpointu včetně jeho operace, např. `"GET /v1/documents"`.                                                                                  |

|     | Typ operace                               | Obecné příklady                                                                     | Příklady pro REST rozhraní*                          |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| C   | Vytvoření                                 | CreateEntity:<br>-`CreateCurrentAccount`<br>-`CreateStandingPaymentOrder`           | POST:<br>-`AddDocument`<br>-`StoreDocument`          |
| R   | Čtení/čtení seznamu                       | `Get_Entity`, `Get_Entity_List`<br>-`GetAccountBalance`, <br>-`GetCorporateAccount` | GET<br>-`GetDocument`<br>-`GetDocumentList`          |
| U   | Modifikace, popř. založení pokud existuje | `ModifyEntity`/`WriteEntity`<br>-`ModifyCashProducts`<br>-`WriteFullClient`         | PUT/PATCH**:<br>-`SetDocument`<br>-`SetDocumentList` |
| D   | Smazání                                   | `Delete_Entity`<br>-`DeleteStandingPaymentOrder`                                    | DELETE:<br>-`DeleteDocument`<br>-`DelDocument`       |
|     | Vyhodnocení pravidel                      | `Check_Entity`<br>-`ValidateAccount`                                                |                                                      |
`*Pro REST je doporučené zachovat objektový přístup i v názvu operace a CRUD prefix tzn. že provádíme operace nad zdrojem. Zároveň je třeba zohlednit případnou práci s kolekcí "zdrojů". Toto je možné například postfixem "List".`

`**PUT- aktualizuje celý resource, PATCH - aktualizuje jen vybrané atributy resource (request obsahuje pouze tyto atributy)`
