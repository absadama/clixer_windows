/**
 * Clixer - MapChart Component
 * Leaflet tabanlı harita görselleştirmesi
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet default icon fix for webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export interface MapDataPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  value: number;
  category?: string;
  color?: string;
}

interface MapChartProps {
  data: MapDataPoint[];
  height?: number; // undefined = container'a tam uyum
  center?: [number, number];
  zoom?: number;
  showMarkers?: boolean; // Pin göster
  showCircles?: boolean; // Değere göre daire göster
  minCircleRadius?: number;
  maxCircleRadius?: number;
  color?: string;
  onMarkerClick?: (point: MapDataPoint) => void;
}

export default function MapChart({
  data,
  height, // undefined = 100% container height
  center,
  zoom = 6,
  showMarkers = false,
  showCircles = true,
  minCircleRadius = 5,
  maxCircleRadius = 30,
  color = '#3B82F6',
  onMarkerClick
}: MapChartProps) {
  
  // Merkez hesapla (data'dan veya Türkiye merkezi)
  const mapCenter = useMemo<[number, number]>(() => {
    if (center) return center;
    if (data.length === 0) return [39.0, 35.0]; // Türkiye merkezi
    
    const avgLat = data.reduce((sum, d) => sum + d.lat, 0) / data.length;
    const avgLng = data.reduce((sum, d) => sum + d.lng, 0) / data.length;
    return [avgLat, avgLng];
  }, [data, center]);
  
  // Değere göre radius hesapla
  const getRadius = useMemo(() => {
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;
    
    return (value: number) => {
      const normalized = (value - minValue) / range;
      return minCircleRadius + normalized * (maxCircleRadius - minCircleRadius);
    };
  }, [data, minCircleRadius, maxCircleRadius]);
  
  // Değeri formatla
  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString('tr-TR');
  };
  
  // Haritanın mount durumunu takip et
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Her mount'ta yeni key oluştur - Leaflet container re-init sorununu çözer
  const [mapKey, setMapKey] = useState(() => `map-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  
  // Mount sonrası haritayı göster - Leaflet DOM hazır olana kadar bekle
  useEffect(() => {
    setIsMounted(true);
    
    // 100ms sonra haritayı göster (DOM'un hazır olması için)
    timeoutRef.current = setTimeout(() => {
      setMapKey(`map-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      setIsVisible(true);
    }, 100);
    
    return () => {
      // Unmount - haritayı gizle
      setIsVisible(false);
      setIsMounted(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  // Resize event handler
  useEffect(() => {
    if (!isMounted) return;
    
    const handleResize = () => {
      setIsVisible(false);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        setMapKey(`map-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        setIsVisible(true);
      }, 300);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isMounted]);
  
  // Height değeri: undefined ise '100%', sayı ise px olarak kullan
  const containerHeight = height ? `${height}px` : '100%';
  const minHeight = height ? `${height}px` : '200px'; // Minimum yükseklik
  
  if (data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-slate-800/50 rounded-lg"
        style={{ height: containerHeight, minHeight }}
      >
        <p className="text-slate-400">Harita verisi yok</p>
      </div>
    );
  }
  
  // Resize sırasında haritayı gizle - Leaflet container sorunu önlenir
  if (!isVisible) {
    return (
      <div 
        className="flex items-center justify-center bg-slate-800/50 rounded-lg animate-pulse"
        style={{ height: containerHeight, minHeight }}
      >
        <p className="text-slate-400">Harita yeniden yükleniyor...</p>
      </div>
    );
  }
  
  return (
    <div style={{ height: containerHeight, minHeight, width: '100%' }} className="rounded-lg overflow-hidden">
      <MapContainer
        key={mapKey}
        center={mapCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        {/* OpenStreetMap tile layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Dark mode tile layer alternatifi */}
        {/* <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        /> */}
        
        {/* Daire gösterimi */}
        {showCircles && data.map(point => (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lng]}
            radius={getRadius(point.value)}
            pathOptions={{
              color: point.color || color,
              fillColor: point.color || color,
              fillOpacity: 0.6,
              weight: 2
            }}
            eventHandlers={{
              click: () => onMarkerClick?.(point)
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              <div className="text-sm">
                <strong>{point.name}</strong>
                <br />
                <span className="text-emerald-600 font-semibold">
                  {formatValue(point.value)}
                </span>
                {point.category && (
                  <>
                    <br />
                    <span className="text-slate-500">{point.category}</span>
                  </>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
        
        {/* Pin marker gösterimi */}
        {showMarkers && data.map(point => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            eventHandlers={{
              click: () => onMarkerClick?.(point)
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{point.name}</strong>
                <br />
                <span className="text-emerald-600 font-semibold">
                  {formatValue(point.value)}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

