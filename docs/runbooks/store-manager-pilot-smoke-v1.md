# Store Manager Pilot Smoke V1

## Amaç

Şirket mağazası Store Manager pilot hesabının canlı ortamda doğru rota, rol, güvenli oturum ve temel ürün sınırlarıyla açıldığını tekrar edilebilir şekilde doğrulamak.

## Gerekli ortam

Bu değerler yerel ortamda veya güvenli CI secret olarak bulunmalıdır. Değerleri loglama.

- `AUTH_SMOKE_EMAIL`
- `AUTH_SMOKE_PASSWORD`
- `AUTH_SMOKE_OTP_CODE`

## Komut

```powershell
npm.cmd --prefix admin-web run smoke:auth:staging:store-manager
```

## Beklenen sinyaller

- Landing route `/store/home`.
- Rol `STORE_MANAGER`.
- Atanmış mağaza kapsamı var.
- Browser session cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Uygulama bearer/id token değerleri local/session storage içinde yok.
- CSRF başlığı olmayan unsafe istek `403` döner.
- `/store/reports` Store Manager için gizli/kapalı kalır.
- `Primler` yalnızca şirket mağazası Store Manager kapsamında görünür.

## Ürün smoke kapsamı

Yerel e2e smoke için:

```powershell
npm.cmd --prefix admin-web run test:e2e:store-manager -- --workers=1
```

Bu test şunları kilitler:

- Store Manager sidebar rotaları.
- `/store/reports` deny davranışı.
- Checklist sonucu kabul akışı.
- Hedef dağıtımının Store Manager sekmesinde kalması.
- Primler sayfasında Region Manager onay/paket kontrollerinin görünmemesi.
- Norm Kadro sayfasında UUID fallback görünmemesi.
- Duyurular sayfasında gönderi oluşturma alanının Store Manager için kapalı kalması.

## Kaydedilmemesi gerekenler

- Şifre, OTP, raw cookie, bearer token, id token.
- Kimlik doğrulama ekranı veya credential içeren ekran görüntüsü.
- Kullanıcıya ait kişisel veri içeren geniş ekran çıktıları.

## Blokaj

OTP veya dış kimlik doğrulama tamamlanamazsa sonuç `blocked` sayılır. Bu durumda başarılı smoke kanıtı üretilmiş gibi raporlanmaz.
