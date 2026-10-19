import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pinIcon = L.divIcon({
  className: 'mwa-map-pin mwa-map-pin--active',
  html: '<span class="mwa-map-pin-dot"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export interface PickedPoint {
  latitude: number;
  longitude: number;
}

/**
 * Mapa Leaflet con un pin arrastrable para que el cliente marque el domicilio
 * del trabajo. Devuelve las coordenadas elegidas. No usa geocodificación
 * externa (el CSP solo permite tiles OSM), así que el punto sale del pin.
 */
export function LocationPickerMap({
  value,
  onChange,
}: {
  value: PickedPoint;
  onChange: (point: PickedPoint) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const map = L.map(node, { zoomControl: true }).setView(
      [value.latitude, value.longitude],
      14,
    );
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const marker = L.marker([value.latitude, value.longitude], {
      icon: pinIcon,
      draggable: true,
    }).addTo(map);
    markerRef.current = marker;

    const emit = (lat: number, lng: number) =>
      onChangeRef.current({ latitude: lat, longitude: lng });

    marker.on('dragend', () => {
      const ll = marker.getLatLng();
      emit(ll.lat, ll.lng);
    });
    map.on('click', (event: L.LeafletMouseEvent) => {
      marker.setLatLng(event.latlng);
      emit(event.latlng.lat, event.latlng.lng);
    });

    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => {
      window.cancelAnimationFrame(frame);
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
    // Init once: later prop changes come from this same marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={host}
      className="quick-booking-map"
      role="region"
      aria-label="Elige la ubicación del trabajo en el mapa"
    />
  );
}
