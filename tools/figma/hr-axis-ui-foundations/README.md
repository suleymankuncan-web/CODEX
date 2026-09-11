# HR Axis UI Foundations — local Figma plugin

This development plugin builds the editable HR Axis design-system file without
using the Figma MCP quota. The component catalog mirrors the project's installed
`radix-nova` shadcn/ui source files, Tailwind v4 semantic tokens, and Lucide icon
conventions. It does not import an unrelated visual library or invent a parallel API.

## Senin yapacağın tek işlem

> Figma Desktop'ta **HR Axis UI Foundations** dosyasını aç; **Plugins →
> Development → Import plugin from manifest…** yolundan bu klasördeki
> `manifest.json` dosyasını seç ve açılan panelde **Sistemi oluştur / güncelle**
> butonuna bas.

Manifest yolu:

```text
tools/figma/hr-axis-ui-foundations/manifest.json
```

Plugin çalışınca aşağıdaki düzenlenebilir Figma sayfalarını oluşturur:

- `00 Cover`
- `01 Foundations`
- `02 Components`

Kullanım örnekleri Starter planın üç sayfa sınırını aşmamak için `02 Components`
sayfasında, bileşen kataloğunun sağında yer alır.

Katalog kapsamı: Accordion, Alert, Alert Dialog, Avatar, Badge, Breadcrumb,
Button, Calendar, Card, Chart, Checkbox, Collapsible, Combobox, Command,
Date Picker, Dialog, Drawer, Dropdown Menu, Empty, Field, Input Group, Input,
Label, Pagination, Popover, Progress, Radio Group, Scroll Area, Select,
Separator, Sheet, Skeleton, Sonner, Spinner, Status Badge, Switch, Table, Tabs,
Textarea, Toggle, Toggle Group ve Tooltip. Her bölüm ilgili
`admin-web/src/components/ui` kaynak yolunu ve shadcn anatomy bilgisini taşır.

`Patterns` alanı sayfa başlığı, KPI özeti, filtre araç çubuğu, gelişmiş tablo,
detay paneli, form, dashboard, inbox, boş/yükleniyor/hata/yetki durumları,
onay, responsive filtre ve command palette kompozisyonlarını içerir. Ayrıca
mevcut HR Axis kabuklarının içine yerleşmek üzere dört gerçek instance tabanlı
sayfa şablonu üretir: `List / Management`, `Dashboard`, `Detail / Audit` ve
`Form / Settings`.

## Güvenli tekrar çalıştırma

Plugin tokenları isim bazlı ve eklemeli yönetir. Katalog sürümü değiştiğinde
yalnızca plugin tarafından üretilen `HR Axis / Generated / Components` ve
`HR Axis / Generated / Patterns` çerçevelerini yeniden kurar. Aynı sürümü tekrar
çalıştırmak mevcut component kimliklerini korur.

## Geliştirme

Kaynaklar `src/` altındadır. Harici bağımlılık veya ağ erişimi yoktur.
`scripts/generate-catalog-manifest.mjs`, build sırasında `components.json`,
shadcn Tailwind tokenları, uygulamanın varsayılan fontu ve kurulu UI dosyalarını
okuyarak `src/catalog-manifest.generated.js` dosyasını üretir. Üretilen dosya
elle düzenlenmez.

```powershell
npm.cmd run build
npm.cmd test
```

`dist/code.js` kullanıma hazır olarak repoda tutulur; Figma'yı çalıştırmak için
Node.js veya npm gerekmez.
