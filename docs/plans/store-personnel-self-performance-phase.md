# Store Personnel Self Performance Phase

## Purpose
`STORE_PERSONNEL` personasini resmi olarak ayir ve manager ekranlarindan bagimsiz ilk self-service yuzeyi ac.

## Rule
- `STORE_PERSONNEL` manager'in kucultulmus kopyasi degildir
- ilk iterasyon read-only olur
- manager workflow'lari bu faza tasinmaz

## Phase 1
Goal:
- personel kullanicisi kendi hesabindan kendi performans yonunu gorebilsin

Includes:
- `Benim Performansim` yuzeyi
- personel KPI profile ozeti
- bireysel score dili
- Turkiye siralamasi icin placeholder/contract zemini
- challenge / odul alani icin yer ayrimi

## Phase 2
Goal:
- bireysel KPI verisini gercek okumaya bagla

Includes:
- target achievement
- ATV
- UPT
- person-level score hesaplama
- magaza ici ve Turkiye siralamasi

## Phase 3
Goal:
- bireysel performansi challenge ve odul katmanina bagla

Includes:
- challenge puan ozeti
- odul uygunlugu
- profil bazli ranking anlatimi

## Guardrail
- store manager ile store personnel ayni shell ailesinde olabilir
- ama ayni is akisi listesi ve ayni ana ekran kullanilmaz
