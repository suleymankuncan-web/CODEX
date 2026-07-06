# Pilot Roster Reconciliation Dry-Run Evidence - 2026-07-06

## Scope

This dry-run reads pilot roster and target workbooks into a single analysis shape.
It does not insert, update, or delete product table rows.

## Inputs

- current_roster -: yeni.xlsx
- dealer_roster -: lis.xlsx
- target 2026-01: Ocak Ayı Peronel Hedefleri.xlsx
- target 2026-02: Şubat Ayı Peronel Hedefleri.xlsx
- target 2026-03: Mart Ayı Peronel Hedefleri.xlsx
- target 2026-04: Nisan Ayı Peronel Hedefleri.xlsx
- target 2026-05: Mayıs Ayı Peronel Hedefleri.xlsx
- target 2026-06: HaziranAyı Peronel Hedefleri.xlsx
- sales_kpi 2026-01: ocak personel.xlsx
- sales_kpi 2026-02: şubat personel.xlsx
- sales_kpi 2026-03: mart personel verileri.xlsx
- sales_kpi 2026-04: nisan personel.xlsx
- sales_kpi 2026-05: mayis personel.xlsx
- sales_kpi 2026-06: haziran personel.xlsx

## Totals

| Metric | Count |
| --- | ---: |
| Rows | 20100 |
| Active company roster | 159 |
| Dealer reference rows | 825 |
| Target rows | 761 |
| Sales/KPI rows | 18355 |
| Store managers | 149 |
| Cashiers | 7 |
| Monthly leaver candidates | 961 |
| Matched targets | 446 |
| Unmatched targets | 315 |
| Missing store candidates | 17544 |
| Risky matches | 1221 |

## Sections

### Active Company Roster

- - | ALANYA AKDENİZ PARK AVM | ÖNDER SAĞIROĞLU | MAĞAZA MÜDÜRÜ | - | matched | -
- - | ALANYA AKDENİZ PARK AVM | ZİNET YAĞMUR | MODA DANIŞMANI | - | matched | -
- - | ALANYA AKDENİZ PARK AVM | ELANUR UYSAL | MODA DANIŞMANI | - | matched | -
- - | ALANYA AKDENİZ PARK AVM | MELİSA BOYBEYİ | MODA DANIŞMANI | - | matched | -
- - | GORDİON | MURAT DÖNMEZ | MAĞAZA MÜDÜR YARDIMCISI | - | matched | -
- - | GORDİON | AKIŞ ARIKIZ | MAĞAZA MÜDÜRÜ | - | matched | -
- - | GORDİON | BİROL TOKLUCU | MODA DANIŞMANI | - | matched | -
- - | GORDİON | FERİDE NURAY BARANLI | MODA DANIŞMANI | - | matched | -

### Missing Stores

- 2026-01 | İZMİR MAVİBAHÇE | KAAN SAPÇI | - | target=500000 | matched | -
- 2026-01 | İZMİR MAVİBAHÇE | DİLAN BEKTAŞ | - | target=500000 | matched | -
- 2026-01 | İZMİR MAVİBAHÇE | GÖZDE ZENGİN | - | target=500000 | matched | -
- 2026-01 | İZMİR MAVİBAHÇE | HÜSEYİN ÖZCAN | - | target=500000 | matched | -
- 2026-01 | İzmir Westpark | EMRAH GÜLER | - | target=967000 | matched | -
- 2026-01 | İzmir Westpark | HATİCE HİLAL GÖKÇE | - | target=966000 | matched | -
- 2026-01 | İzmir Westpark | SİMGE ELİBOL | - | target=967000 | matched | -
- 2026-01 | Ankara Armada | EBRU DİNÇ | - | target=800000 | matched | -

### External Map Candidates

- 2026-01 | İZMİR MAVİBAHÇE | KAAN SAPÇI | - | target=500000 | matched | -
- 2026-01 | İZMİR MAVİBAHÇE | DİLAN BEKTAŞ | - | target=500000 | matched | -
- 2026-01 | İZMİR MAVİBAHÇE | GÖZDE ZENGİN | - | target=500000 | matched | -
- 2026-01 | İZMİR MAVİBAHÇE | HÜSEYİN ÖZCAN | - | target=500000 | matched | -
- 2026-01 | İzmir Westpark | EMRAH GÜLER | - | target=967000 | matched | -
- 2026-01 | İzmir Westpark | HATİCE HİLAL GÖKÇE | - | target=966000 | matched | -
- 2026-01 | İzmir Westpark | SİMGE ELİBOL | - | target=967000 | matched | -
- 2026-01 | Ankara Armada | EBRU DİNÇ | - | target=800000 | matched | -

### Monthly Leavers

- 2026-01 | Antalya Gazipaşa Gazipark Avm | VOLKAN DEMİR | - | sales=208068.4 | matched | -
- 2026-01 | Balıkesir 10 Burda AVM | GÜRKAN ÇAKAR | - | sales=218353.41 | matched | -
- 2026-01 | Çanakkale 17 Burda Avm | SENA DAL | - | sales=703035.21 | matched | -
- 2026-01 | İstanbul Havalimanı İç Hatlar | EZGİ KÖYLÜ | - | sales=416122.94 | matched | -
- 2026-01 | Antalya Havalimanı İç Hatlar | NURULLAH MUHAMMED BALCI | - | sales=121234.14 | matched | -
- 2026-01 | Balıkesir 10 Burda AVM | GÖKHAN AYDIN | - | sales=430021.88 | matched | -
- 2026-01 | İzmir Novada Menemen Avm | BAVER ALTAY | - | sales=450467.04 | matched | -
- 2026-01 | Eskişehir Vega Avm | KAAN ANIK | - | sales=656636.44 | matched | -

### Target Matches

- 2026-01 | İZMİR MAVİBAHÇE | KAAN SAPÇI | - | target=500000 | matched | -
- 2026-01 | İZMİR MAVİBAHÇE | HÜSEYİN ÖZCAN | - | target=500000 | matched | -
- 2026-01 | İzmir Westpark | EMRAH GÜLER | - | target=967000 | matched | -
- 2026-01 | Ankara Armada | MUSTAFA BÜYÜKEL | - | target=800000 | matched | -
- 2026-01 | Balıkesir 10 Burda Avm | EMİNE ÇAVUŞ | - | target=717000 | matched | -
- 2026-01 | Balıkesir 10 Burda Avm | SİNEM TEKKURT | - | target=717000 | matched | -
- 2026-01 | Diyarbakır Ninova | ÖMER ALTIN | - | target=700000 | matched | -
- 2026-01 | Torium | MESUT KOCAMAN | - | target=100000 | matched | -

### Unmatched Targets

- 2026-01 | İZMİR MAVİBAHÇE | DİLAN BEKTAŞ | - | target=500000 | matched | -
- 2026-01 | İZMİR MAVİBAHÇE | GÖZDE ZENGİN | - | target=500000 | matched | -
- 2026-01 | İzmir Westpark | HATİCE HİLAL GÖKÇE | - | target=966000 | matched | -
- 2026-01 | İzmir Westpark | SİMGE ELİBOL | - | target=967000 | matched | -
- 2026-01 | Ankara Armada | EBRU DİNÇ | - | target=800000 | matched | -
- 2026-01 | Ankara Armada | GÜL KAZAK | - | target=800000 | matched | -
- 2026-01 | Viaport | MELİKE SÜMBÜL | - | target=1259000 | matched | -
- 2026-01 | Viaport | MUHAMMED AKKAYA | - | target=1561000 | matched | -

### Cashiers

- - | MARMARA PARK | AYLİN DEMİR | KASİYER | - | matched | -
- - | SAMSUN PİAZZA AVM | ELİF GÜLTEKİN | KASİYER | - | matched | -
- - | ORDU CADDE | SİNEM ŞAHİN | KASA SORUMLUSU | - | matched | -
- - | GAZİANTEP FORUM AVM | YAĞMUR MERCAN | KASA SORUMLUSU | - | matched | -
- - | GAZİANTEP PRIMEMALL AVM | DUYGU GÜNDÜZ | KASA DANIŞMANI | - | review_required | dealer_file_non_fm_code
- - | İSTANBUL MARMARAFORUM AVM | TUĞBA SAYALGI | KASİYER | - | review_required | dealer_file_non_fm_code
- - | İSTANBUL MARMARAPARK AVM | AYLİN DEMİR | KASİYER | - | review_required | dealer_file_non_fm_code

### Store Managers

- - | ALANYA AKDENİZ PARK AVM | ÖNDER SAĞIROĞLU | MAĞAZA MÜDÜRÜ | - | matched | -
- - | GORDİON | AKIŞ ARIKIZ | MAĞAZA MÜDÜRÜ | - | matched | -
- - | ANKARA ARMADA AVM | BAHRİ KOÇ | MAĞAZA MÜDÜRÜ | - | matched | -
- - | ANKARA ARMADA AVM | SAMİ DEMİRTAŞ | MAĞAZA MÜDÜRÜ | - | matched | -
- - | ANTALYA HAVALİMANI İÇ HATLAR | KÜBRA ESAR | MAĞAZA MÜDÜRÜ | - | matched | -
- - | AYDIN OPS MALL AVM | KENAN KAYİŞ | MAĞAZA MÜDÜRÜ | - | matched | -
- - | AYDIN SÖKE NOVADA OUTLET | YAŞAR KINAK | MAĞAZA MÜDÜRÜ | - | matched | -
- - | BALIKESİR 10 BURDA AVM | MERT ALCAN | MAĞAZA MÜDÜRÜ | - | matched | -

### Risky Matches

- - | EYÜP AXİS POP UP | RIFAT YILMAZ | MODA DANIŞMANI | - | review_required | temporary_store:pop_up
- - | EYÜP AXİS POP UP | SERHAN ÖZÇEKİCİ | MODA DANIŞMANI | - | review_required | temporary_store:pop_up
- - | EYÜP AXİS POP UP | MEHMET PARLAK | MAĞAZA MÜDÜRÜ | - | review_required | temporary_store:pop_up
- - | EYÜP AXİS POP UP | SEMİH ORHAN | MAĞAZA MÜDÜRÜ | - | review_required | temporary_store:pop_up
- - | EYÜP AXİS POP UP | ELA SERRA ÖZATA | MODA DANIŞMANI | - | review_required | temporary_store:pop_up
- - | İSTANBUL PALLADİUM AVM | HASAN MALKOÇ | MAĞAZA MÜDÜRÜ | - | review_required | dealer_file_non_fm_code
- - | SAMSUN YEŞİLYURT AVM | ÖZTÜRK MEYDAN | MAĞAZA MÜDÜRÜ | - | review_required | dealer_file_non_fm_code
- - | AKSARAY NORA CİTY AVM | ADİLE ÖZDEMİR | SATIŞ DANIŞMANI | - | review_required | dealer_file_non_fm_code

## Guardrail

No normalized product table was mutated by this script. PR2 must consume only an approved dry-run output.
