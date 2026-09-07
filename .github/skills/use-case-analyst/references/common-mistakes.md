## Časté chyby

### Zanesení podmínek (IF) do scénáře

*Zdroj: Writing Effective Use Cases, Alistair Cockburn, 2000*

**Špatný příklad**
2. The system checks whether the password is correct
3. If it is, the system presents the available actions for the user.

**Dobrý příklad**
2. The system validates that the password is correct
3. The system presents the available actions for the user.

Notice that the writing in the second case describes the scenario succeeding. It also triggers the reader to ask at step 2, "But what if the password is not valid?" The reader will turn to the extensions section and look for the extension starting with "Password is not valid". It gives the use case a consistent rhythm that makes the use case easy to read and review.

### Use case scénář nahrazuje jiný artefakt

Na projektech často nastává situace, kdy je funkční analytik tlačen do popisu implementačního detailu a přitom nezná artefakt, do kterého tyto informace umístit. V oblasti UCs to pak vede ke dvěma častým chybám:

1. "Zašpinění" původně "čistých" scénářů implementačním detailem — **příklad:** UC-007 Modify Loyalty Account [DUCR] (všimněte si kroku 2 basic flow)
2. Vytvoření Use Case, který ve skutečnosti UC není — **příklad:** UC-110 System Interfaces Overview (zde se analytik pokusil identifikovat interfaces a nacpal je pod hlavičku UC)

### Scénář popisuje detailní chování GUI

*Zdroj: Writing Effective Use Cases, Alistair Cockburn, 2000*

**Špatný příklad**

Use Case: Buy Something
Scope: Purchasing application
Level: User goal
Primary Actor: Customer

1. System presents ID and Password screen.
2. Customer types id and password into system, clicks OK.
3. System validates user id and password, displays Personal Information Screen.
4. Customer types in first and last names, street address, city, state, zip code, phone number, and clicks OK.
5. System validates that user is a known user.
6. System presents available product list.
7. Customer clicks on pictures of items to be purchased, types in quantity next to each, clicks on DONE when finished.
8. System validates with the warehouse storage system that sufficient quantity of the requested product is in stock.
...etc.

**Dobrý příklad**

Use Case: Buy Something
Scope: Purchasing application
Level: User goal
Primary Actor: Customer

1. Customer accesses system with id and password.
2. System validates user.
3. Customer provides name, address, telephone number.
4. System validates that Customer is a known Customer.
5. Customer selects products and quantity.
6. System validates with the warehouse storage system that sufficient quantity of the requested product is in stock.

**Principy z knihy:**

In the requirements document, we are interested in the semantic description of the interface, one that announces the **intent** of the user, and gives just a **summary of the information that is passed** from one actor to another.

### Špatný příklad — scénář jako GUI specifikace

Níže je ukázka z reálného projektu (anonymizováno). Všimněte si, jak scénář popisuje konkrétní obrazovky, pole, tlačítka a jejich rozmístění — místo aby popisoval záměr aktéra a tok informací.

1. **Uživatel** otevře obrazovku se schránkou zpráv.
   Obrazovka je přístupná z více míst aplikace (dashboard, hlavní menu, odkaz z jiné obrazovky).

2. **Systém** zobrazí obrazovku dle wireframu *WF-101 Schránka se zprávami*.
   Pro každé vlákno se zobrazí:

   - **Pole:**
     - Datum a čas poslední zprávy ve vlákně
     - Odesílatel poslední zprávy
     - Předmět poslední zprávy
     - Téma vlákna
     - Příjemci poslední zprávy
     - Stav poslední zprávy
     - Typ poslední zprávy
     - Počet zpráv ve vlákně
     - Počet zpráv s připomínkou
     - Počet zpráv s přílohou
     - Počet nepřečtených zpráv
     - Počet označených zpráv
     - Počet konceptů ve vlákně

   - **Tlačítka:**
     - Smazat vlákno — smaže všechny zprávy ve vlákně
     - Přeposlat — otevře vlákno a zobrazí oblast pro přeposlání
     - Další tlačítka pro správu zobrazení (řazení, filtry, stránkování)
     - Checkbox — pro zahrnutí vlákna do hromadné operace

3. Vždy jsou zobrazena tlačítka:
   - Nová zpráva — popsáno v *UC-107 Vytvoření nové zprávy*
   - Nový požadavek na zpětné volání — popsáno v *UC-201 Požadavek na zpětné volání*
   - Nový požadavek na schůzku — popsáno v *UC-202 Požadavek na schůzku*
   - Nová žádost — popsáno v *UC-003 Nová žádost*

4. Lišta s tlačítky pro hromadné operace se zobrazí po výběru alespoň jednoho vlákna. Viditelnost každého tlačítka závisí na podmínce (zda operace může být provedena s alespoň jedním z vybraných vláken). Po kliknutí se akce provede se všemi vybranými vlákny. Tlačítka hromadných operací:
   - Smazat vlákno — zobrazeno, když je vlákno vybráno
   - Označit jako přečtené — zobrazeno, když alespoň jedno vybrané vlákno obsahuje nepřečtenou zprávu
   - Označit jako nepřečtené — zobrazeno, když alespoň jedno vybrané vlákno obsahuje přečtenou zprávu

5. Ve schránce se zobrazují pouze zprávy z aktuálně vybraného kontraktu.

6. Ve vláknech se zobrazují pouze nesmazané zprávy.

7. Pokud je schránka prázdná, zobrazí se varianta obrazovky *WF-100 Prázdná schránka*.

**Proč je to špatně:** Scénář detailně popisuje konkrétní GUI prvky (pole, tlačítka, wireframy), místo aby zachycoval záměr aktéra a tok informací na úrovni "co" a "proč" — nikoli "jak přesně vypadá obrazovka".
