# MAĞAZA UI PROBLEM ANALİZİ

**Tarih:** 12 Ocak 2026  
**Versiyon:** v4.26-stable-magaza → Bölge/Grup Multi-Select Geliştirmesi  
**Durum:** ⚠️ DEVAM EDİYOR - Mağaza Dropdown Sorunu

---

## 📋 ÖZET

Kullanıcı v4.26 stabil versiyonuna döndükten sonra, bölge ve grup için çoklu seçim (multi-select) özelliği eklenmek istendi. Backend başarıyla güncellendi ve test edildi. Ancak frontend değişiklikleri sırasında mağaza seçim UI'ı bozuldu.

**Ana Belirti:**
- Mağaza dropdown'ından bir mağaza seçildiğinde dropdown kayboluyor
- Veri tetikleme çalışıyor (API çağrısı yapılıyor)
- Sadece UI elementi (dropdown) kayboluyor

---

## 🔴 YAŞANAN HATALAR VE ÇÖZÜMLER

### HATA 1: TypeScript Build Hatası - showTypeDropdown

**Belirti:**
```
error TS2552: Cannot find name 'showTypeDropdown'. Did you mean 'showDateDropdown'?
error TS2552: Cannot find name 'setShowTypeDropdown'. Did you mean 'setShowDateDropdown'?
```

**Kök Neden:**
- Tek seçimli grup dropdown'ı (`showTypeDropdown`) çoklu seçimli (`showGroupDropdown`) ile değiştirildi
- Ancak kodun bazı yerlerinde eski referanslar kaldı

**Çözüm:**
- `FilterBar.tsx`'te `showTypeDropdown` → `showGroupDropdown` değiştirildi
- `setShowTypeDropdown` → `setShowGroupDropdown` değiştirildi

**Durum:** ✅ ÇÖZÜLDÜ

---

### HATA 2: Region UUID vs Code Uyumsuzluğu

**Belirti:**
- Bölge seçimi UI'dan yapılıyor ama veriler değişmiyor
- Backend `MainRegionID` olarak sayısal değer bekliyor (1, 2, 3...)
- Frontend `region.id` olarak UUID gönderiyordu

**Kök Neden:**
- `FilterBar.tsx`'te region seçimi yapılırken `region.id` (UUID) kullanılıyordu
- Backend `MainRegionID` Integer kolonu ile filtreleme yapıyor
- `regions` tablosundaki `code` değeri (1, 2, 3...) ile eşleşmesi gerekiyor

**Çözüm:**
- `FilterBar.tsx`'te tüm `region.id` referansları `region.code` ile değiştirildi:
  - `selectedRegionIds.includes(region.id)` → `selectedRegionIds.includes(region.code)`
  - `setRegions([...selectedRegionIds, region.id])` → `setRegions([...selectedRegionIds, region.code])`

**Durum:** ✅ ÇÖZÜLDÜ

---

### HATA 3: getFilteredStores Mağaza Listesini Filtreliyordu

**Belirti:**
- Mağaza dropdown'ı beklenen mağazaları göstermiyordu
- Bölge/grup seçimi mağaza listesini etkiliyordu (kullanıcı bunu istemedi)

**Kök Neden:**
- `filterStore.ts`'teki `getFilteredStores` fonksiyonu eski yapıda bölge/gruba göre filtreleme yapıyordu

**Çözüm:**
- `getFilteredStores` sadeleştirildi - tüm mağazaları döndürür:
```typescript
getFilteredStores: () => {
  const { stores } = get()
  return stores
}
```

**Durum:** ✅ ÇÖZÜLDÜ

---

### HATA 4: Mağaza Dropdown Seçim Sonrası Kayboluyor (DEVAM EDİYOR)

**Belirti:**
- Mağaza dropdown açılıyor ✅
- Scroll yapılabiliyor ✅
- Mağaza seçildiğinde veri tetikleniyor ✅
- Ancak dropdown seçim anında kayboluyor ❌
- v4.26'da bu sorun YOKTU

**Yapılan Karşılaştırmalar:**

1. **FilterBar.tsx Mağaza Checkbox Handler:**
   - v4.26 ve şu anki versiyon karşılaştırıldı
   - Kod birebir AYNI

2. **filterStore.ts setStores Fonksiyonu:**
   - v4.26 ve şu anki: AYNI

3. **Overlay Click Handler:**
   - Her iki versiyonda AYNI yapı

4. **useRef Kullanımı:**
   - Her iki versiyonda da FilterBar'da ref KULLANILMIYOR

5. **useFilterStore Destructuring:**
   - v4.26: `selectedRegionId, selectedStoreType, setRegion, setStoreType...`
   - Şu anki: `selectedRegionIds, selectedGroupIds, setRegions, setGroups...`
   - Değişiklikler var ama mağaza kısmı etkilenmemeli

**Şüpheli Alanlar:**
1. `setStoreType` fonksiyonu içinde `getFilteredStores()` çağrısı var
2. Yeni eklenen `setGroups` ve `setRegions` fonksiyonları state'i değiştiriyor olabilir
3. Zustand store reactive güncellemeleri

**Durum:** ⚠️ DEVAM EDİYOR - Daha fazla analiz gerekli

---

## 📁 DEĞİŞTİRİLEN DOSYALAR

| Dosya | Değişiklik | Durum |
|-------|------------|-------|
| `services/analytics-service/src/index.ts` | regionIds, groupIds filtreleme, cache key, LFL entegrasyonu | ✅ Tamamlandı |
| `frontend/src/stores/filterStore.ts` | Multi-select state, setRegions, setGroups, getFilteredStores sadeleştirildi | ✅ Tamamlandı |
| `frontend/src/stores/dashboardStore.ts` | regionIds, groupIds gönderimi | ✅ Tamamlandı |
| `frontend/src/pages/DashboardPage.tsx` | regionIdsKey, groupIdsKey dependency | ✅ Tamamlandı |
| `frontend/src/pages/AnalysisPage.tsx` | regionIds, groupIds gönderimi | ✅ Tamamlandı |
| `frontend/src/components/FilterBar.tsx` | Multi-select UI, region.code düzeltmesi | ⚠️ Mağaza sorunu devam ediyor |

---

## 🔍 YAPILAN ANALİZLER

### v4.26 Dosyaları Çıkarıldı
```bash
git show v4.26-stable-magaza:frontend/src/components/FilterBar.tsx > filterbar_v426.txt
git show v4.26-stable-magaza:frontend/src/stores/filterStore.ts > filterstore_v426.txt
```

### Grep ile Karşılaştırmalar
1. `showStoreDropdown|setShowStoreDropdown` - Her iki versiyonda aynı
2. `onClick.*setStores|toggleStore` - Aynı
3. `filteredStores|searchedStores` - Aynı
4. `useRef|storeRef|regionRef|dropdownRef` - Her ikisinde de yok
5. `Mağaza Seç|showStoreDropdown` - Overlay mantığı aynı
6. `fixed inset-0 z-40` - Overlay her ikisinde de var

### Read File ile Karşılaştırmalar
- Mağaza checkbox handler (satır 570-650) - BİREBİR AYNI
- Toggle button handler - AYNI
- Overlay click handler - AYNI

---

## 🎯 SONRAKİ ADIMLAR

1. **State Güncellemelerini İzle:**
   - React DevTools ile `showStoreDropdown` state'inin nasıl değiştiğini izle
   - Mağaza seçildiğinde hangi state'ler güncelleniyor?

2. **Console Log Ekle:**
   - `setStores` çağrıldığında log ekle
   - `showStoreDropdown` değiştiğinde log ekle

3. **setStoreType Fonksiyonunu İncele:**
   - İçinde `getFilteredStores()` çağrısı var
   - Bu dolaylı olarak bir sorun oluşturabilir mi?

4. **Zustand Store Reactive Güncellemelerini Kontrol Et:**
   - `selectedStoreIds` değiştiğinde tüm component yeniden render oluyor mu?
   - Bu render sırasında `showStoreDropdown` sıfırlanıyor olabilir mi?

---

## 🔴 KRİTİK KURAL İHLALİ

Kullanıcının açık isteği:
> "ben işlem yapmanı isteyene kadar buralara dokunma"
> "başka yerleri asla bozma"
> "neden çalışan yer bozuluyor"

Bu ihlal, bölge/grup için yapılan değişikliklerin mağaza seçim UI'ını bozması şeklinde gerçekleşti.

---

## 📊 BACKEND TEST SONUÇLARI (BAŞARILI)

Backend değişiklikleri başarıyla çalışıyor:

```bash
# MARMARA (regionIds=7)
"value":498172
"value":229777936.61

# TÜM BÖLGELER
"value":982337
"value":455175217.51

# MERKEZ (groupIds=MERKEZ)
"value":3689
"value":1454918.25

# FR (groupIds=FR)
"value":820437
"value":498111

# Çoklu Bölge (MARMARA + EGE)
"value":608193
"value":519369
```

Tüm backend filtreleme işlemleri doğru çalışıyor. Sorun SADECE frontend mağaza dropdown UI'ında.

---

## 🔗 İLGİLİ DOSYALAR

- `/filterbar_v426.txt` - v4.26 FilterBar.tsx yedeği
- `/filterstore_v426.txt` - v4.26 filterStore.ts yedeği
- `.cursorrules` - Bölge/Grup/Mağaza koruma kuralı eklendi

---

**Son Güncelleme:** 12 Ocak 2026
