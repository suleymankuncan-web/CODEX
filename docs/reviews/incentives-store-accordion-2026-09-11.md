# Prim mağaza akordiyonu — 2026-09-11

Kapsam: Bölge Müdürü ve Report Viewer prim listelerinde mağaza → personel → prim drawer akışı. Root tarafından uygulama ve öz inceleme; bağımsız agent incelemesi değildir.

## Sonuç

- Her iki rol aynı shadcn Collapsible tabanlı mağaza akordiyonunu kullanır. Mağaza Detay butonu ve eski mağaza drawer bileşeni kaldırıldı. Personel adına basmak doğrudan personelin drawer'ını açar.
- Mağaza ve personel listeleri hesaplanan prim ile Final Prim'i ayrı gösterir. Değişiklik varsa final tutarın altında işaretli fark gösterilir: artış yeşil, azalış kırmızı. Fark mevcut hassas ondalık toplama yardımcısıyla hesaplanır; prim hesaplama kuralı değişmedi.
- Report Viewer dizininde yalnızca müdür adı ve mağaza sayısı bulunur. Seçilen bölgenin Prim Onayı paneli mağaza listesinin üstündedir.
- Report Viewer düzeltmesi olmayan personelin de tutarlarını, hesaplama oranlarını ve not durumunu inceleyebilir. Bölge müdürünün düzeltme, dönem kapanışı, kontrol, bekleyen istek ve gönderim yetki kuralları korunur. Düzenlemeye kapalı personel drawer'ı salt okunurdur.
- Drawer kapanınca odak personel adına döner; mağaza akordiyonu açık kalır. Mobil görünümde de aynı etkileşim vardır.

## Doğrulama

- Frontend build:e2e ve lint geçti; son kaynak değişikliği sonrası ilgili dizin lint kontrolü de geçti.
- Dört Playwright dosyası: 52/52 test geçti. Kontroller; 1440/1024/390/320 px, taşma, erişilebilirlik, akordiyon aç/kapat, drawer odak dönüşü, pozitif/negatif final farkı, oran/not kaydetme ve hata geri alma, dönem kilidi, salt okunur rol, final onay yetkisi ve seçili bölge kapsamını içerir.
- İlk koşuda bir eski personel butonu seçicisi müdür adıyla çakıştı; tam ad eşleşmesiyle düzeltildi. Bir test boş ilk yüklemede zaman aşımına uğradı; son tam koşuda aynı senaryo ve diğer 51 test geçti.
- Yerel 5181 ve 5183 üzerinde sentetik verilerle mağaza akordiyonları açıldı; personel drawer ve sade müdür dizini incelendi. Test ekran görüntülerinde masaüstü tablo ve 320 px personel drawer'ı ayrıca gözden geçirildi.
- Kapsamlı diff whitespace kontrolü geçti. Bu kanıt yerel UI doğrulamasıdır; tam proje release/CI kanıtı değildir.

Bu görevde veri, onay yetkisi veya onay durumu yazılmadı; PR/push yapılmadı. Önceki çalışma değişiklikleri korundu. Görev başı yedeği ve test logları: `C:/Users/suley/.codex/tmp/prim-accordion-20260911/`.

Yerel bağlantılar: Bölge Müdürü `http://localhost:5181/store/incentives`, Report Viewer `http://localhost:5183/store/incentives`.
