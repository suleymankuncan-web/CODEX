# Position To Role Matrix

## Purpose
Netlestir:
- is pozisyonu nedir
- sistem rolu nedir
- hangi yuzleri gorur
- hangi aksiyonlari yapar
- hangi KPI dilinin sahibi olur

## Core Rule
- `STORE_MANAGER` ve `STORE_PERSONNEL` ayni shell ailesinde olabilir
- ama ayni urun personası degildir
- store manager magazayi yonetir
- store personnel kendi hesabini ve bireysel performansini yonetir

## Matrix

### 1. Genel Mudur Yardimcisi
- is pozisyonu: genel mudur yardimcisi
- sistem rolu: `DEPUTY_GM`
- gorur:
  - sirket KPI ozeti
  - bolge karsilastirmalari
  - magaza karsilastirmalari
  - trend ve yonetim ozetleri
- yapar:
  - izleme
  - yonsel karar
- yapmaz:
  - gunluk operasyonel is akisi

### 2. Bolge Muduru
- is pozisyonu: bolge muduru
- sistem rolu: `REGION_MANAGER`
- gorur:
  - kendi bolgesindeki magazalar
  - magaza KPI'lari
  - checklist sonuclari
  - hedef dagitim talepleri
  - KPI exception'lar
- yapar:
  - target distribution onayi
  - bolge bazli follow-up
  - KPI exception review
- atama kurali:
  - ileride bolge mudurune bagli magazalar secilerek atanabilmeli
  - tek store degil, 20-25 magazalik secilebilir liste desteklenmeli
  - final model sadece genel region scope'a degil, secili store setine de izin vermeli

### 3. Magaza Muduru
- is pozisyonu: magaza muduru
- sistem rolu: `STORE_MANAGER`
- gorur:
  - magazanin KPI ve score gorunumu
  - magazadaki personel performansi
  - checklist receipt ve acknowledgement isleri
  - hedef dagitim talepleri
  - store shared inbox
- yapar:
  - personele hedef dagitir
  - hedef revize talebi acar
  - checklist kabul/goruldu aksiyonu verir
  - magazaya ait operasyonel aksiyon alir

### 4. Magaza Personeli
- is pozisyonu: magaza personeli
- sistem rolu: `STORE_PERSONNEL`
- gorur:
  - kendi bireysel KPI'lari
  - kendi hedefi
  - kendi ATV / UPT / hedef gerceklestirme orani
  - kendi performans skoru
  - Turkiye siralamasi
  - varsa challenge / puan / odul durumu
- yapar:
  - kendi hesabini ve bireysel performansini gorur
  - kendi gelisim yonunu izler
  - ileride challenge / sosyal alan etkileşimi yapabilir
- yapmaz:
  - magaza geneli KPI yonetimi
  - baskasina hedef dagitimi
  - approval verme

## Product Consequence
- `STORE_PERSONNEL` store manager'in kucultulmus kopyasi degil
- bu persona icin ayri bir self-service yuzey gerekir
- onerilen ilk yuz:
  - `Benim Performansim`

Bu yuzde ileride su alanlar acilabilir:
- bireysel KPI kartlari
- bireysel score
- magaza ici siralama
- Turkiye siralamasi
- challenge / puan / odul ozeti

## Design Guardrail
- store shell altinda ayni route ailesi kullanilabilir
- ama manager ve personnel ayni ekranlari gormemeli
- routing ve component secimi persona bazli olmali

## Recommended Next Step
- `STORE_PERSONNEL` icin ayri bir phase ac
- ilk iterasyonda yalnizca read-only self-performance surface ac
- manager workflow'larini personel tarafina tasima
