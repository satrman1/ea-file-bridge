// Krok 0, test 1 (P1): overeni, ze Windows Script Host neni blokovan.
// Spusteni: dvojklik. Kdyz Windows nabidne "Vyberte aplikaci",
// zvolit "Microsoft (R) Windows Based Script Host" (bez zaskrtnuti "Vzdy").
// Okenko "funguje" = OK. Hlaska o zasadach organizace = AppLocker blokuje.
WScript.Echo("funguje");
