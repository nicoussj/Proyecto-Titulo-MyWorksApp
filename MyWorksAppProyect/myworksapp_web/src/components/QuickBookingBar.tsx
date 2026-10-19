import { useState } from 'react';
import { visitSlotIso } from '@myworksapp/shared';
import { Calendar, MapPin, X } from 'lucide-react';
import { LocationPickerMap, type PickedPoint } from './LocationPickerMap';

// Centro por defecto del mapa cuando el profesional no trae coordenadas.
const DEFAULT_CENTER: PickedPoint = { latitude: -41.4717, longitude: -72.9369 };

interface QuickBookingBarProps {
  workerName: string;
  profession: string;
  pricePerHour: number;
  defaultLatitude?: number | null;
  defaultLongitude?: number | null;
  onContinue: (
    scheduledAt: string,
    address: string,
    latitude: number,
    longitude: number,
  ) => void;
  onClose: () => void;
}

export function QuickBookingBar({
  workerName,
  profession,
  pricePerHour,
  defaultLatitude,
  defaultLongitude,
  onContinue,
  onClose,
}: QuickBookingBarProps) {
  const now = new Date();
  const friday = new Date(now);
  friday.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7));

  const dateLabel = friday.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const [hour, setHour] = useState<'10' | '14' | '18'>('10');
  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<PickedPoint>(
    typeof defaultLatitude === 'number' && typeof defaultLongitude === 'number'
      ? { latitude: defaultLatitude, longitude: defaultLongitude }
      : DEFAULT_CENTER,
  );
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    if (!address.trim()) {
      setError('Ingresa la dirección donde necesitas el servicio.');
      return;
    }
    setError(null);
    onContinue(visitSlotIso(hour), address.trim(), point.latitude, point.longitude);
  };

  return (
    <div className="quick-booking-bar modal-rise" role="region" aria-label="Reserva rápida">
      <button type="button" className="quick-booking-close" onClick={onClose} aria-label="Cerrar">
        <X size={18} />
      </button>

      <div className="quick-booking-inner">
        <div className="quick-booking-copy">
          <p className="quick-booking-kicker">RESERVA RÁPIDA</p>
          <h3>¿Cuándo necesitas el servicio?</h3>
          <p className="quick-booking-hint">Elige fecha y hora para continuar.</p>
        </div>

        <div className="quick-booking-datetime">
          <Calendar size={18} className="quick-booking-cal-icon" aria-hidden />
          <select
            className="quick-booking-select"
            value={hour}
            aria-label="Fecha y hora"
            onChange={(event) => setHour(event.target.value as '10' | '14' | '18')}
          >
            <option value="10">{dateLabel} | 10:00</option>
            <option value="14">{dateLabel} | 14:00</option>
            <option value="18">{dateLabel} | 18:00</option>
          </select>
        </div>

        <div className="quick-booking-datetime">
          <MapPin size={18} className="quick-booking-cal-icon" aria-hidden />
          <input
            className="quick-booking-select"
            value={address}
            aria-label="Dirección del trabajo"
            placeholder="Dirección: calle, número, comuna"
            autoComplete="street-address"
            onChange={(event) => {
              setAddress(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleContinue();
            }}
          />
        </div>

        <p className="quick-booking-hint">Arrastra el pin hasta tu domicilio exacto.</p>
        <LocationPickerMap value={point} onChange={setPoint} />

        <div className="quick-booking-worker">
          <strong>{workerName}</strong>
          <span>{profession}</span>
          <span className="quick-booking-price">${pricePerHour.toLocaleString('es-CL')} / visita</span>
        </div>

        {error ? (
          <p className="toast-error" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="btn-primary quick-booking-cta"
          onClick={handleContinue}
        >
          Continuar con la reserva →
        </button>
      </div>
    </div>
  );
}
