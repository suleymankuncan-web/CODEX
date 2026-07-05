# Pilot Personel Kadro Mutabakatı Kontratı V1

Durum: active  
Okuyucu: pilot öncesi veri hazırlığı yapan mühendis, veri operatörü veya gelecek oturumdaki ajan.  
Okuduktan sonra yapılacak iş: şirket mağazaları için güncel personel kadrosunu, geçmiş hedef/satış/KPI verisini ve turnover çıktısını güvenli bir dry-run raporuna dönüştürmek.

## Amaç

Ocak, Şubat, Mart, Nisan, Mayıs ve Haziran dönemleri için personel hedefleri, satış/KPI snapshotları ve güncel personel listesi aynı iş kuralına göre hizalanacak.

Pilot sunumunda sistem eski Mart kadrosu gibi görünmemeli. Güncel aktif kadro Haziran şirket mağazası personeline göre kurulmalı; geçmiş aylarda çalışıp ayrılan kişiler ise geçmiş performans ve turnover hesabı için korunmalı.

## Kaynak Kararı

| Kaynak | Kullanım |
| --- | --- |
| `yeni.xlsx` | Şirket mağazaları için güncel aktif personel kaynağı. |
| `lis.xlsx` | Bayi ve işletme mağazaları için referans kaynak. İçinde şirket mağazaları bulunsa bile şirket mağazası personel kaynağı olarak kullanılmaz. |
| Ocak-Haziran personel hedef dosyaları | Aylık personel hedef referansları için kullanılır. |
| Ocak-Haziran satış/KPI snapshotları | Aylık performans, satış, ranking, prim ve turnover mutabakatı için kullanılır. |

## Temel Kurallar

1. Haziran aktif şirket mağazası kadrosu `yeni.xlsx` üzerinden belirlenir.
2. Güncel aktif listede olmayan ama ilgili ayın satış/KPI snapshotında satışı bulunan kişi, o ay içinde çalışmış ve aynı ay içinde ayrılmış kabul edilir.
3. Ayrılış günü pilot için kritik değildir. Ay seviyesi yeterlidir.
4. Ay içinde ayrılmış kabul edilen kişi aktif ekranlarda görünmez; geçmiş rapor, KPI, ranking, prim ve turnover hesaplarında korunur.
5. Eski çalışan kayıtları fiziksel olarak silinmez.
6. Kasiyer aktif personel olarak görünür ve pozisyonu kasiyer olarak kalır.
7. Kasiyer şimdilik hedef dağıtımı, prim ve resmi satış personeli ranking kurallarına dahil edilmez.
8. Mağaza müdürleri aktif kadroda görünür, fakat personel hedef dağıtımına ve resmi personel rankingine dahil edilmez. Mağaza müdürünün hedefi mağaza hedefidir.

## Personel Kodu Kararı

| Kod Yapısı | Anlam |
| --- | --- |
| `FM...` | Bayi personel sicil yapısı. |
| `DNMSL...` veya numerik kod | Şirket mağazası ve işletme tarafında kullanılan personel sicil yapısı. |

Bu nedenle `lis.xlsx` ve `yeni.xlsx` personel kodları birbirine doğrudan join edilmez. Kod aileleri farklıdır. Mağaza ve personel eşleşmesinde kaynak tipine göre ayrı kural çalışır.

## Mağaza Eşleşme Kararı

Şirket mağazalarında mağaza eşleşmesi için öncelik şirket mağaza kodudur. `yeni.xlsx` içindeki şirket mağazası kodu, mağaza adı eşleşmesine göre daha güvenilir kabul edilir.

Bayi ve işletme tarafında mağaza kodları eksik olabilir. İşletme mağazalarının kodları netleşene kadar işletme mağazası personel eşleşmeleri otomatik ve agresif yapılmaz. Net eşleşmeyen satırlar rapora alınır.

## Staging Tek Tablo Kararı

Excel dosyaları doğrudan ürün tablolarına yazılmaz. Önce tek bir staging çalışma tablosuna alınır.

Önerilen tablo:

`stg.roster_reconciliation_input`

Bu tablo kalıcı ürün veri modeli değildir. Görevi, farklı Excel kaynaklarını aynı analiz yüzeyinde toplamak ve dry-run raporu üretmektir.

Minimum kolon ailesi:

| Alan | Amaç |
| --- | --- |
| `source_file` | Satırın geldiği dosya. |
| `source_sheet` | Excel sheet adı. |
| `source_period` | `2026-01` gibi dönem. |
| `source_kind` | `current_roster`, `target`, `sales_kpi`, `dealer_roster` gibi kaynak türü. |
| `raw_store_name` | Dosyadaki mağaza adı. |
| `raw_store_code` | Dosyada varsa mağaza kodu. |
| `raw_employee_code` | Personel sicil/kod alanı. |
| `raw_employee_name` | Dosyadaki personel adı. |
| `raw_position_name` | Dosyadaki pozisyon. |
| `raw_payload` | Kaynak satırın JSONB ham hali. |
| `normalized_store_key` | Temizlenmiş mağaza eşleşme anahtarı. |
| `normalized_employee_key` | Temizlenmiş personel eşleşme anahtarı. |
| `match_status` | `matched`, `missing_store`, `missing_employee`, `ambiguous`, `ignored` gibi sonuç. |
| `match_notes` | Neden eşleşti/eşleşmedi açıklaması. |

Bu tek tablo analiz ve mutabakat içindir. Uygulama ekranları bu tabloyu okumaz.

## Normalize Dağıtım Kararı

Staging tablo analizinden sonra kabul edilen veriler mevcut normalize ürün tablolarına dağıtılır:

| Hedef | Ne yazılır |
| --- | --- |
| `ops.store` | Eksik ama kabul edilen mağaza master kayıtları. |
| `stg.external_id_map` | Power BI, hedef dosyası ve diğer dış kaynak mağaza/personel eşleşmeleri. |
| `ops.employee` | Eksik personel master kayıtları ve aktif/pasif durumları. |
| Assignment tabloları | Personelin mağaza/pozisyon geçmişi ve BM mağaza kapsamı. |
| Hedef tabloları | Ocak-Haziran kişi/mağaza hedef referansları. |
| KPI/satış actual tabloları | Yeniden import veya yeniden hesap sonrası kabul edilen performans gerçekleri. |
| Snapshot tabloları | Dönem kapama ve raporlama için yeniden üretilen sonuç katmanı. |

Tek staging tablo, normalize yapının yerine geçmez. Sadece güvenli analiz ve idempotent veri hazırlığı sağlar.

## İdempotent SQL Uygulama Kararı

Mutabakat SQL’i tekrar çalıştırılabilir olmalıdır.

Kurallar:

1. Var olan mağaza/personel duplicate üretilmez.
2. `store_code`, dış kaynak mağaza adı ve personel kodu için `on conflict` veya `where not exists` yaklaşımı kullanılır.
3. Mevcut kayıt varsa statü, bölge, dış map ve assignment kontrollü update edilir.
4. Silme yapılmaz; kapanış/pasiflik tarih aralığıyla tutulur.
5. Aynı dönem/personel için hedef ve turnover kaydı ikinci kez üretilmez.
6. Her çalıştırma sonunda inserted/updated/skipped/review_required sayıları raporlanır.

## Netleşen Mağaza Master Notları

Bu kararlar staging mutabakatına girdi kabul edilir:

| Mağaza | Bölge | Tip | Not |
| --- | --- | --- | --- |
| Düzce Dmall Avm | Eda Doğanay Bölgesi | Şirket mağazası | Store master ve Power BI map oluşturuldu. |
| İstanbul Eyüp Axis Pop Up | Eyüp Büyükyılmaz Bölgesi | Şirket mağazası | Store master ve Power BI map oluşturuldu. |

Bu mağazaların geçmiş import batchlerine otomatik geriye dönük etkisi yoktur. İlgili dönem verilerinin akması için dosya yeniden import edilmeli veya kabul edilen staging satırlarından normalize import akışı tekrar çalıştırılmalıdır.

## Pop Up / Garaj / Çadır Mağaza Kararı

Haziran personel dosyasında mağaza KPI dosyasında olmayan bazı operasyon adları görülebilir.

Örnek sınıflar:

- Pop Up
- Garaj
- Çadır

Bu kayıtlar otomatik mağaza master’a açılmaz. Önce şu sınıflandırma yapılır:

| Sınıf | İşlem |
| --- | --- |
| Kalıcı mağaza | `ops.store` kaydı açılır, external map eklenir, bölge/BM assignment yapılır. |
| Geçici operasyon | Ayrı mağaza mı, bağlı olduğu ana mağaza mı netleştirilir. |
| Sadece satış noktası alias’ı | `stg.external_id_map` ile mevcut mağazaya maplenir. |
| Ignore edilecek satır | Dry-run raporunda gerekçesiyle gösterilir. |

Bölge, mağaza tipi veya ana mağaza ilişkisi net değilse işlem durur ve kullanıcı kararı beklenir.

## Güncel Aktif Kadro Kuralı

Güncel aktif kadro şu şekilde hesaplanır:

1. `yeni.xlsx` içinden şirket mağazası personelleri çıkarılır.
2. Haziran sonu itibarıyla aktif kabul edilecek kişiler işaretlenir.
3. Bu kişiler sistemde aktif çalışan olarak kalır.
4. Sistemde aktif görünüp `yeni.xlsx` güncel şirket kadrosunda olmayan kişiler doğrudan silinmez.
5. Bu kişiler Ocak-Haziran satış/KPI snapshotlarında aranır.
6. Satışı/KPI verisi varsa, ilgili ay için geçmiş çalışan olarak korunur ve ayrılık olayı üretilir.
7. Satışı/KPI verisi yoksa pasifleştirme adayı olarak raporlanır; otomatik işlem yapılmaz.

## Ay İçinde Ayrılmış Personel Kuralı

Bir kişi ilgili ayda satış/KPI snapshotında görünüyorsa fakat güncel Haziran aktif kadrosunda yoksa:

- kişi o ay içinde çalışmış kabul edilir,
- kişi aynı ay içinde ayrılmış kabul edilir,
- ayrılış günü pilot için ayın son günü olarak temsil edilebilir,
- bu kayıt turnover üretiminde kullanılır,
- kişi güncel aktif personel listelerinde gösterilmez.

Bu kural HR kesin ayrılış tarihinin yerine geçmez. Pilot veri hazırlığında ay seviyesinde doğru raporlama üretmek için kullanılır.

## Turnover Kuralı

Turnover için kaynak olay, geçmiş satış/KPI varlığı ile güncel aktif kadro dışı kalma durumunun birleşimidir.

Örnek:

- Personel Mayıs satış snapshotında var.
- Haziran güncel aktif şirket kadrosunda yok.
- Bu kişi Mayıs içinde çalışmış ve Mayıs içinde ayrılmış kabul edilir.
- Mayıs için turnover olayı üretilir.

Eğer aynı kişi Haziran satış snapshotında da görünüyorsa:

- Haziran içinde çalışmış kabul edilir,
- Haziran turnover hesabına girer.

## Hedef Verisi Kuralı

Ocak-Haziran personel hedef dosyaları aylık hedef referansına çevrilir.

1. Güncel aktif personellerin Ocak-Haziran hedefleri işlenir.
2. Ay içinde ayrılmış kabul edilen ve ilgili ayda satış/KPI verisi olan kişilerin o ay hedefi varsa, geçmiş dönem doğruluğu için işlenebilir.
3. Mağaza müdürleri personel hedef dağılımına dahil edilmez.
4. Kasiyer hedef dağılımına şimdilik dahil edilmez.
5. Eksik hedef, sıfır hedefe çevrilmez. Eksik veri olarak raporlanır.

## Snapshot Kuralı

Snapshot tabloları sonuç katmanıdır. Geçmiş snapshot kayıtları doğrudan elle güncellenmez.

Doğru işlem sırası:

1. Canlı master data ve kabul edilen KPI/hedef gerçekleri düzeltilir.
2. Gerekli dönemler için snapshot yeniden üretilir.
3. Eski ve yeni snapshot sonuçları karşılaştırılır.
4. Farklar raporlanır.

Bu yaklaşım ranking, Store Me, KPI, hedef, prim, norm kadro, turnover ve raporlar arasında tutarlı sonuç üretir.

## Dry-Run Raporu

DB değişikliği yapmadan önce şu rapor üretilmelidir:

| Bölüm | İçerik |
| --- | --- |
| Şirket aktif kadro | `yeni.xlsx` kaynaklı aktif kişi listesi, mağaza, pozisyon, personel kodu. |
| Bayi/işletme referansı | `lis.xlsx` kaynaklı mağaza/personel dağılımı, şirket mağazalarından ayrıştırılmış görünüm. |
| Tek staging tablo özeti | Kaynak dosya, dönem, satır sayısı, eşleşen/eşleşmeyen satır sayısı. |
| Eksik mağaza master | Store master’da olmayan mağaza adları ve önerilen aksiyon. |
| External map adayları | Mevcut mağazaya alias olarak bağlanabilecek dış kaynak adları. |
| Aktif eklenecekler | Sistemde eksik olup güncel şirket kadrosunda olan kişiler. |
| Pasife alınacaklar | Sistemde aktif olup güncel şirket kadrosunda olmayan kişiler. |
| Ay içinde ayrılanlar | Güncel kadroda olmayan ama ilgili ayda satış/KPI verisi olan kişiler. |
| Hedef eşleşmeleri | Ocak-Haziran hedefleri kişi/mağaza bazında eşleşen satırlar. |
| Eşleşmeyen hedefler | Personel veya mağaza eşleşmeyen hedef satırları. |
| Kasiyer kayıtları | Aktif kalacak ama hedef/prim/ranking dışı tutulacak kişiler. |
| Mağaza müdürleri | Aktif kalacak ama personel ranking/hedef dağıtımı dışında tutulacak kişiler. |
| Riskli eşleşmeler | Sadece isimle veya belirsiz mağaza adıyla eşleşebilen satırlar. |

## SQL Uygulama İlkeleri

1. Önce staging tabloya yükleme yapılır.
2. Staging üzerinden dry-run raporu üretilir.
3. Kullanıcı onayı gereken mağaza/personel sınıflandırmaları raporda ayrılır.
4. Toplu değişiklikler transaction içinde yapılır.
5. Fiziksel silme yapılmaz.
6. Aktif olmayan kişiler pasif/ayrılmış statüye alınır.
7. Assignment geçmişi tarih aralığıyla kapatılır.
8. Turnover olayları idempotent şekilde yazılır.
9. Hedef referansları aynı dönem ve kişi için duplicate üretmeyecek şekilde yazılır.
10. İşlem sonunda snapshot yeniden üretimi ve kontrol raporu alınır.

## Kabul Kriterleri

- Şirket mağazası aktif personel listesi Haziran güncel kadrosuyla uyumludur.
- İşten ayrılmış kişiler aktif ekranlarda görünmez.
- Geçmiş ay satış/KPI verisi olan ayrılmış kişiler geçmiş hesaplarda korunur.
- Turnover, ay içinde ayrılmış kabul edilen kişilerden beslenir.
- Kasiyer aktif görünür ama hedef/prim/resmi ranking dışında kalır.
- Mağaza müdürü aktif görünür ama personel hedef dağıtımı ve resmi personel ranking dışında kalır.
- Eksik hedef veya eksik satış sıfıra çevrilmez.
- Eşleşmeyen mağaza/personel satırları sessizce atlanmaz; raporlanır.
- Staging tablo normalize ürün tablolarının yerine kullanılmaz.
- Tekrar çalıştırılan SQL duplicate mağaza, personel, assignment, hedef veya turnover kaydı üretmez.
- Snapshot sonrası ranking, Store Me, KPI, prim, norm kadro ve raporlar aynı dönem/personel evrenini kullanır.

## Stop Kuralları

Şu durumlardan biri varsa uygulama durur:

- Şirket mağazası kodu ile sistem mağazası net eşleşmiyorsa.
- Aynı personel kodu birden fazla aktif kişiye gidiyorsa.
- Aynı kişi aynı ayda birden fazla mağazada satış yapmış ve mağaza geçişi açıklanamıyorsa.
- Hedef dosyasındaki kişi satış/KPI kaynağında farklı mağazada görünüyorsa.
- İşletme mağazası için mağaza kodu yoksa ve sadece isimle eşleşme gerekiyorsa.
- Pop Up, Garaj veya Çadır satırının bağlı olduğu ana mağaza/bölge net değilse.
- Dry-run raporunda yüksek etkili farklar kullanıcı onayı olmadan işlem gerektiriyorsa.

## Park Edilen Kararlar

- İşletme mağazalarının kesin mağaza kodları.
- Pop Up, Garaj ve Çadır operasyonlarının ayrı mağaza mı alias mı sayılacağı.
- Nebim entegrasyonunda günlük satış, fatura/adisyon ve günlük hacim alanlarının nihai kontratı.
- Kasiyer prim ve ranking kapsamı.
- Gerçek HR ayrılış tarihi geldiğinde ay sonu varsayımının nasıl düzeltileceği.
