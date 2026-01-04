/**
 * Clixer - Geographic API
 * Türkiye il, ilçe, mahalle koordinat lookup servisi
 */

import api from './api';

// Types
export interface GeoLocation {
  id: string;
  location_type: 'CITY' | 'DISTRICT' | 'NEIGHBORHOOD';
  city_code: string;
  city_name: string;
  district_name?: string;
  neighborhood_name?: string;
  latitude: number;
  longitude: number;
  population?: number;
  name_ascii?: string;
  region_code?: string;
  region_name?: string;
}

export interface GeoCity extends GeoLocation {
  districts?: GeoDistrict[];
}

export interface GeoDistrict {
  id: string;
  district_name: string;
  latitude: number;
  longitude: number;
  population?: number;
  name_ascii?: string;
}

export interface GeoRegion {
  region_code: string;
  region_name: string;
  city_count: number;
  total_population: number;
}

export interface LookupRequest {
  name?: string;
  city?: string;
  district?: string;
  neighborhood?: string;
}

export interface LookupResult {
  input: LookupRequest;
  found: boolean;
  latitude: number | null;
  longitude: number | null;
  matched_name: string | null;
  match_level: 'CITY' | 'DISTRICT' | 'NEIGHBORHOOD' | null;
}

// API Functions

/**
 * Tüm illeri listele
 */
export async function getCities(regionCode?: string): Promise<GeoLocation[]> {
  const params = regionCode ? { region: regionCode } : {};
  const response = await api.get('/core/geographic/cities', { params });
  return response.data.data || [];
}

/**
 * İl detayı ve ilçeleri
 */
export async function getCityDetails(cityCode: string): Promise<GeoCity> {
  const response = await api.get(`/core/geographic/cities/${cityCode}`);
  return response.data.data;
}

/**
 * İlçe detayı ve mahalleleri
 */
export async function getDistrictDetails(cityCode: string, districtName: string): Promise<GeoLocation> {
  const response = await api.get(`/core/geographic/cities/${cityCode}/districts/${districtName}`);
  return response.data.data;
}

/**
 * Lokasyon ara (fuzzy search)
 */
export async function searchLocations(query: string, limit = 20): Promise<GeoLocation[]> {
  if (!query || query.length < 2) return [];
  const response = await api.get('/core/geographic/search', { params: { q: query, limit } });
  return response.data.data || [];
}

/**
 * Koordinat lookup - İsimlerden koordinat bul
 */
export async function lookupCoordinates(locations: LookupRequest[]): Promise<LookupResult[]> {
  if (!locations || locations.length === 0) return [];
  const response = await api.post('/core/geographic/lookup', { locations });
  return response.data.data || [];
}

/**
 * Coğrafi bölgeleri listele (7 bölge)
 */
export async function getRegions(): Promise<GeoRegion[]> {
  const response = await api.get('/core/geographic/regions');
  return response.data.data || [];
}

/**
 * İstatistikler
 */
export async function getGeoStats(): Promise<{ location_type: string; count: number; total_population: number }[]> {
  const response = await api.get('/core/geographic/stats');
  return response.data.data || [];
}

// ============================================
// HELPER: Türkiye İl Koordinatları (Offline Cache)
// ============================================

// Hızlı lookup için sabit koordinat haritası (API'ye gerek kalmadan kullanılabilir)
export const TURKEY_CITY_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  // Plaka koduna göre
  '01': { lat: 37.0000, lng: 35.3213, name: 'Adana' },
  '02': { lat: 37.7648, lng: 38.2786, name: 'Adıyaman' },
  '03': { lat: 38.7507, lng: 30.5567, name: 'Afyonkarahisar' },
  '04': { lat: 39.7191, lng: 43.0503, name: 'Ağrı' },
  '05': { lat: 40.6499, lng: 35.8353, name: 'Amasya' },
  '06': { lat: 39.9334, lng: 32.8597, name: 'Ankara' },
  '07': { lat: 36.8969, lng: 30.7133, name: 'Antalya' },
  '08': { lat: 41.1828, lng: 41.8183, name: 'Artvin' },
  '09': { lat: 37.8560, lng: 27.8416, name: 'Aydın' },
  '10': { lat: 39.6484, lng: 27.8826, name: 'Balıkesir' },
  '11': { lat: 40.0567, lng: 30.0665, name: 'Bilecik' },
  '12': { lat: 38.8855, lng: 40.4966, name: 'Bingöl' },
  '13': { lat: 38.3938, lng: 42.1232, name: 'Bitlis' },
  '14': { lat: 40.7356, lng: 31.6061, name: 'Bolu' },
  '15': { lat: 37.4613, lng: 30.0665, name: 'Burdur' },
  '16': { lat: 40.1885, lng: 29.0610, name: 'Bursa' },
  '17': { lat: 40.1553, lng: 26.4142, name: 'Çanakkale' },
  '18': { lat: 40.6013, lng: 33.6134, name: 'Çankırı' },
  '19': { lat: 40.5506, lng: 34.9556, name: 'Çorum' },
  '20': { lat: 37.7765, lng: 29.0864, name: 'Denizli' },
  '21': { lat: 37.9144, lng: 40.2306, name: 'Diyarbakır' },
  '22': { lat: 41.6771, lng: 26.5557, name: 'Edirne' },
  '23': { lat: 38.6810, lng: 39.2264, name: 'Elazığ' },
  '24': { lat: 39.7500, lng: 39.5000, name: 'Erzincan' },
  '25': { lat: 39.9000, lng: 41.2700, name: 'Erzurum' },
  '26': { lat: 39.7767, lng: 30.5206, name: 'Eskişehir' },
  '27': { lat: 37.0662, lng: 37.3833, name: 'Gaziantep' },
  '28': { lat: 40.9128, lng: 38.3895, name: 'Giresun' },
  '29': { lat: 40.4386, lng: 39.5086, name: 'Gümüşhane' },
  '30': { lat: 37.5833, lng: 43.7333, name: 'Hakkari' },
  '31': { lat: 36.2028, lng: 36.1600, name: 'Hatay' },
  '32': { lat: 37.7648, lng: 30.5566, name: 'Isparta' },
  '33': { lat: 36.8121, lng: 34.6415, name: 'Mersin' },
  '34': { lat: 41.0082, lng: 28.9784, name: 'İstanbul' },
  '35': { lat: 38.4237, lng: 27.1428, name: 'İzmir' },
  '36': { lat: 40.6167, lng: 43.1000, name: 'Kars' },
  '37': { lat: 41.3887, lng: 33.7827, name: 'Kastamonu' },
  '38': { lat: 38.7225, lng: 35.4875, name: 'Kayseri' },
  '39': { lat: 41.7333, lng: 27.2167, name: 'Kırklareli' },
  '40': { lat: 39.1500, lng: 34.1667, name: 'Kırşehir' },
  '41': { lat: 40.8533, lng: 29.8815, name: 'Kocaeli' },
  '42': { lat: 37.8667, lng: 32.4833, name: 'Konya' },
  '43': { lat: 39.4167, lng: 29.9833, name: 'Kütahya' },
  '44': { lat: 38.3552, lng: 38.3095, name: 'Malatya' },
  '45': { lat: 38.6191, lng: 27.4289, name: 'Manisa' },
  '46': { lat: 37.5858, lng: 36.9371, name: 'Kahramanmaraş' },
  '47': { lat: 37.3212, lng: 40.7245, name: 'Mardin' },
  '48': { lat: 37.2153, lng: 28.3636, name: 'Muğla' },
  '49': { lat: 38.7432, lng: 41.5064, name: 'Muş' },
  '50': { lat: 38.6244, lng: 34.7239, name: 'Nevşehir' },
  '51': { lat: 37.9667, lng: 34.6833, name: 'Niğde' },
  '52': { lat: 40.9839, lng: 37.8764, name: 'Ordu' },
  '53': { lat: 41.0201, lng: 40.5234, name: 'Rize' },
  '54': { lat: 40.7569, lng: 30.3781, name: 'Sakarya' },
  '55': { lat: 41.2867, lng: 36.3300, name: 'Samsun' },
  '56': { lat: 37.9333, lng: 41.9500, name: 'Siirt' },
  '57': { lat: 42.0231, lng: 35.1531, name: 'Sinop' },
  '58': { lat: 39.7477, lng: 37.0179, name: 'Sivas' },
  '59': { lat: 40.9833, lng: 27.5167, name: 'Tekirdağ' },
  '60': { lat: 40.3167, lng: 36.5500, name: 'Tokat' },
  '61': { lat: 41.0027, lng: 39.7168, name: 'Trabzon' },
  '62': { lat: 39.1079, lng: 39.5401, name: 'Tunceli' },
  '63': { lat: 37.1591, lng: 38.7969, name: 'Şanlıurfa' },
  '64': { lat: 38.6823, lng: 29.4082, name: 'Uşak' },
  '65': { lat: 38.5012, lng: 43.4089, name: 'Van' },
  '66': { lat: 39.8181, lng: 34.8147, name: 'Yozgat' },
  '67': { lat: 41.4564, lng: 31.7987, name: 'Zonguldak' },
  '68': { lat: 38.3725, lng: 34.0250, name: 'Aksaray' },
  '69': { lat: 40.2552, lng: 40.2249, name: 'Bayburt' },
  '70': { lat: 37.1759, lng: 33.2287, name: 'Karaman' },
  '71': { lat: 39.8468, lng: 33.5153, name: 'Kırıkkale' },
  '72': { lat: 37.8812, lng: 41.1351, name: 'Batman' },
  '73': { lat: 37.4187, lng: 42.4918, name: 'Şırnak' },
  '74': { lat: 41.6344, lng: 32.3375, name: 'Bartın' },
  '75': { lat: 41.1105, lng: 42.7022, name: 'Ardahan' },
  '76': { lat: 39.9237, lng: 44.0450, name: 'Iğdır' },
  '77': { lat: 40.6500, lng: 29.2667, name: 'Yalova' },
  '78': { lat: 41.2061, lng: 32.6204, name: 'Karabük' },
  '79': { lat: 36.7184, lng: 37.1212, name: 'Kilis' },
  '80': { lat: 37.0742, lng: 36.2478, name: 'Osmaniye' },
  '81': { lat: 40.8438, lng: 31.1565, name: 'Düzce' },
};

// İsim bazlı lookup (Türkçe karakter normalize)
export const TURKEY_CITY_BY_NAME: Record<string, { lat: number; lng: number; code: string }> = {};

// İsimleri normalize et ve map'e ekle
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c')
    .trim();
};

// Map'i doldur
Object.entries(TURKEY_CITY_COORDS).forEach(([code, data]) => {
  const normalizedName = normalizeText(data.name);
  TURKEY_CITY_BY_NAME[normalizedName] = { lat: data.lat, lng: data.lng, code };
  // Orijinal ismi de ekle
  TURKEY_CITY_BY_NAME[data.name.toLowerCase()] = { lat: data.lat, lng: data.lng, code };
});

/**
 * Offline koordinat lookup - API'ye ihtiyaç duymaz
 * @param locationName İl veya ilçe adı
 * @returns Koordinatlar veya null
 */
export function getCoordinatesOffline(locationName: string): { lat: number; lng: number } | null {
  if (!locationName) return null;
  
  const normalized = normalizeText(locationName);
  
  // Direkt eşleşme
  if (TURKEY_CITY_BY_NAME[normalized]) {
    return { lat: TURKEY_CITY_BY_NAME[normalized].lat, lng: TURKEY_CITY_BY_NAME[normalized].lng };
  }
  
  // Plaka kodu ile arama
  if (TURKEY_CITY_COORDS[locationName]) {
    return { lat: TURKEY_CITY_COORDS[locationName].lat, lng: TURKEY_CITY_COORDS[locationName].lng };
  }
  
  // Kısmi eşleşme (içeriyorsa)
  for (const [name, data] of Object.entries(TURKEY_CITY_BY_NAME)) {
    if (normalized.includes(name) || name.includes(normalized)) {
      return { lat: data.lat, lng: data.lng };
    }
  }
  
  return null;
}

/**
 * Harita verisi için koordinat zenginleştirme
 * @param data Orijinal veri (city, il, sehir, store_name vb. kolonlar içerebilir)
 * @returns Koordinat eklenmiş veri
 */
export function enrichWithCoordinates<T extends Record<string, any>>(data: T[]): (T & { lat?: number; lng?: number })[] {
  return data.map(item => {
    // Zaten koordinat varsa dokunma
    if (item.lat && item.lng) {
      return item;
    }
    if (item.latitude && item.longitude) {
      return { ...item, lat: item.latitude, lng: item.longitude };
    }
    if (item.enlem && item.boylam) {
      return { ...item, lat: item.enlem, lng: item.boylam };
    }
    
    // Koordinat yok, lokasyon kolonlarından bulmaya çalış
    // ÖNEMLİ: 'name' kolonu da dahil - SQL sorgularında genellikle 'SELECT il as name' kullanılıyor
    const locationColumns = ['name', 'city', 'il', 'sehir', 'city_name', 'il_adi', 'store_city', 'location', 'district', 'ilce'];
    
    for (const col of locationColumns) {
      if (item[col]) {
        const coords = getCoordinatesOffline(String(item[col]));
        if (coords) {
          return { ...item, lat: coords.lat, lng: coords.lng };
        }
      }
    }
    
    // Hiçbir şey bulunamadı - varsayılan Türkiye merkezi
    return { ...item, lat: 39.0, lng: 35.0 };
  });
}

