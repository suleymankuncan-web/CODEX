# Prim Excel'inin İK'ya gönderimi

Gönderim, şirket kapsamında kişisel final prim onay yetkisi verilmiş Rapor
Görüntüleyici tarafından başlatılır. Dönemin müdür atamasına bağlı tüm paketleri onaylandıktan
sonra **İK’ya gönder** ile özet açılır; **Onayla** ile Excel e-postaya eklenir.
Sayfadaki görünüm ve arama filtreleri gönderim kapsamını daraltmaz.
Yeni prim paketinin kimliği şirket, dönem ve atanmış bölge müdürünün kullanıcı
kimliğidir. Coğrafi `region_id` paket anahtarı değildir; yalnızca mağaza
metaverisinde ve eski paket kayıtlarında korunur.

## SMTP ayarları

Backend ortamına aşağıdaki değerleri tanımlayın; gerçek şifreleri depoya yazmayın.
Docker kullanırken değerlerin API konteynerinin `environment` veya `env_file`
ayarına aktarılması gerekir. Frontend `VITE_*` değişkenlerine eklemeyin.

| Değişken | Anlamı |
|---|---|
| `INCENTIVE_HR_SMTP_HOST` | Kurumsal SMTP sunucusu |
| `INCENTIVE_HR_SMTP_PORT` | Varsayılan 587 (STARTTLS); 465 doğrudan TLS |
| `INCENTIVE_HR_SMTP_FROM` | Gönderici e-posta adresi |
| `INCENTIVE_HR_SMTP_USER` | SMTP kullanıcı adı; kimlik doğrulamasız kurumsal relay için boş |
| `INCENTIVE_HR_SMTP_PASSWORD` | SMTP parolası; kullanıcı adı tanımlıysa zorunlu |
| `INCENTIVE_HR_SMTP_PASSWORD_FILE` | Parola yerine secret dosyası yolu |
| `INCENTIVE_HR_RECIPIENTS_JSON` | Şirket UUID'sinden İK alıcılarına eşleme |

Alıcı eşlemesi örneği (örnek adreslerdir):

```json
{"00000000-0000-4000-8000-000000000001":["ik@example.test","bordro@example.test"]}
```

Şirket başına en fazla 20 alıcı desteklenir. Sunucu sertifikası doğrulanır;
STARTTLS/TLS zorunludur. SMTP veya alıcı ayarı eksikse özet açılır, gönderim
onayı kapalı kalır. Ayarların var olması posta sunucusuna bağlantının doğrulandığı
anlamına gelmez; gerçek hesap bağlandıktan sonra kontrollü teslim testi gerekir.

## Excel ve kapsam

Her şirket kendi dosyasını ve kendi alıcı listesini kullanır. Dosyada **Müdür
Özeti** ve **Personel Primleri** sayfaları bulunur. Kaynak, onaylı paketin
mağaza/snapshot kümesi ve onaylı düzeltmelerdir. Personel satırları isim,
pozisyon, hedef, satış, HG, hesaplama oranı, hesaplanan/final prim ve düzeltme
notunu içerir. Onay penceresinden sonra tutar veya alıcı değişirse gönderim
engellenir; özet tekrar açılmalıdır.

## Gönderim kaydı ve belirsiz sonuç

`083_incentive_manager_assignment_packages.sql` ve `084_incentive_hr_email_handoff.sql` migration'ları gerekir. Şirket + dönem için
tek `ops.incentive_hr_delivery` kaydı oluşturulur; eşzamanlı istekler aynı maili
iki kez gönderemez. Kayıt, aktörü, alıcıları, Excel SHA-256 değerini, başlangıç
zamanını ve SMTP message ID'sini tutar. `sent`, bütün alıcıların SMTP tarafından
kabul edildiğini belirtir; alıcı gelen kutusuna teslim garantisi değildir.

Bağlantı kesilmesi, kısmi kabul veya sonucu kaydedememe durumunda otomatik tekrar
gönderim yapılmaz. `uncertain` veya işlem kesildiyse `sending` durumu, operatör
incelemesi gerektirir. Posta sunucusunda
`<incentive-DELIVERY_UUID@gönderici-alanı>` message ID'sini arayın. Gerçek teslim
durumunu doğrulamadan kaydı silmeyin, yeniden gönderim açmayın. Bu sürüm manuel
yeniden gönderim komutu sunmaz.

Migration geri alınırken dolu gönderim tablosunun silinmesi engellenir; denetim
izini koruyun. Yerel doğrulamalarda hiçbir gerçek adrese e-posta gönderilmedi.
