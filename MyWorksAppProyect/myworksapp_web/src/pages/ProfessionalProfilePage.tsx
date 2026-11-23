import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EVENTOS_USO, profilePhotoOrInitials, type ProfesionalParecido } from '@myworksapp/shared';
import { registrarEventoUso } from '../analytics/registrarEvento';
import { SiteFooter } from '../components/SiteFooter';
import { StarScore } from '../components/StarScore';
import { leerProfesionalesParecidos, leerResumenResenas } from '../data/fichaPublica';
import { usePageMeta } from '../hooks/usePageMeta';
import { supabase } from '../supabaseClient';
import type { SearchWorker } from '../components/SearchResultsView';

type ProfileRow = {
  id_usuario: string;
  nombre: string | null;
  profesion: string | null;
  descripcion: string | null;
  zona_trabajo: string | null;
  radio_servicio_km: number | null;
  tarifa_visita: number | null;
  ruta_foto_perfil: string | null;
  verificado: boolean | null;
  calificacion: number | null;
  n_calificaciones: number | null;
  trabajos_completados: number | null;
  es_elite: boolean | null;
  categoria: string | null;
};

type Review = {
  nota: number;
  comentario: string | null;
  fecha: string | null;
  nombre_corto: string | null;
};

type Slot = { dia_semana: number; hora_inicio: string; hora_fin: string };
type WorkPhoto = { ruta_foto: string; descripcion: string | null; tipo_medio: string | null };

const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

type Loose = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

export function ProfessionalProfilePage({
  onReserve,
}: {
  onReserve: (worker: SearchWorker) => void;
}) {
  const { pathname } = useLocation();
  const id = decodeURIComponent(pathname.match(/^\/profesional\/([^/?#]+)/)?.[1] ?? '');
  const [row, setRow] = useState<ProfileRow | null>(null);
  const [hours, setHours] = useState<Slot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [works, setWorks] = useState<WorkPhoto[]>([]);
  const [resumen, setResumen] = useState<string | null>(null);
  const [parecidos, setParecidos] = useState<ProfesionalParecido[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setResumen(null);
    setParecidos([]);
    const db = supabase as unknown as Loose;
    void Promise.all([
      db.rpc('perfil_publico_profesional', { p_id: id }),
      db.rpc('horario_publico_profesional', { p_id: id }),
      db.rpc('resenas_publicas_profesional', { p_id: id }),
    ]).then(([profile, schedule, notes]) => {
      if (cancelled) return;
      if (profile.error || schedule.error || notes.error) {
        setStatus('error');
        return;
      }
      const found = Array.isArray(profile.data) ? profile.data[0] as ProfileRow | undefined : null;
      if (!found) {
        setRow(null);
        setStatus('empty');
        return;
      }
      setRow(found);
      setHours(Array.isArray(schedule.data) ? schedule.data as Slot[] : []);
      setReviews(Array.isArray(notes.data) ? notes.data as Review[] : []);
      setStatus('ready');
      void db.rpc('portafolio_publico_profesional', { p_id: id }).then((photos) => {
        if (cancelled || photos.error || !Array.isArray(photos.data)) return;
        setWorks(photos.data as WorkPhoto[]);
      });
      registrarEventoUso(EVENTOS_USO.vioFicha, { id_profesional: id });
      void Promise.all([leerResumenResenas(id), leerProfesionalesParecidos(id)]).then(([texto, lista]) => {
        if (cancelled) return;
        setResumen(texto);
        setParecidos(lista);
      });
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const name = row?.nombre?.trim() || 'Profesional';
  usePageMeta(
    status === 'ready' ? name : 'Profesional',
    status === 'ready'
      ? `${name}, ${row?.profesion || 'oficio'}.`
      : 'Ficha pública de un profesional de MyWorksApp.',
    status !== 'ready',
  );

  const reserve = () => {
    if (!row) return;
    onReserve({
      id: row.id_usuario,
      name,
      profession: row.profesion || 'Oficio',
      category: row.categoria || '',
      rating: Number(row.calificacion ?? 0),
      jobsDone: Number(row.trabajos_completados ?? 0),
      photoUrl: profilePhotoOrInitials(row.ruta_foto_perfil, name, row.id_usuario),
      pricePerVisit: Number(row.tarifa_visita ?? 0),
    });
  };

  const photo = profilePhotoOrInitials(row?.ruta_foto_perfil, name, row?.id_usuario);
  const rating = Number(row?.calificacion ?? 0);
  const reviewCount = Number(row?.n_calificaciones ?? 0);
  const jobsDone = Number(row?.trabajos_completados ?? 0);
  const price = row?.tarifa_visita == null
    ? null
    : `$${Number(row.tarifa_visita).toLocaleString('es-CL')}`;
  const photos = works.filter((work) => (work.tipo_medio ?? 'foto') !== 'video' && work.ruta_foto?.startsWith('http'));

  return (
    <div className="min-h-screen app-shell">
      <main className="container ficha">
        <Link className="ficha-back" to="/servicios">Volver a servicios</Link>
        {status === 'loading' ? <p role="status">Cargando la ficha…</p> : null}
        {status === 'error' ? <p role="alert">No se pudo leer la ficha. Inténtalo de nuevo.</p> : null}
        {status === 'empty' ? <p role="status">Este profesional no está en el catálogo público.</p> : null}
        {status === 'ready' && row ? (
          <article className="ficha-sheet">
            <header className="ficha-hero">
              <img className="ficha-photo" src={photo} alt="" width={112} height={112} />
              <div className="ficha-identity">
                <p className="ficha-kicker">{row.profesion || 'Oficio'}</p>
                <h1>{name}</h1>
                <div className="ficha-badges">
                  {row.verificado ? <span>Verificado</span> : null}
                  {row.es_elite ? <span className="is-elite">Élite del mes</span> : null}
                </div>
                <p className="ficha-rating">
                  {reviewCount > 0 ? (
                    <>
                      <StarScore rating={rating} />
                      <strong>{rating.toFixed(1)}</strong>
                      <span>{reviewCount} {reviewCount === 1 ? 'reseña' : 'reseñas'}</span>
                    </>
                  ) : (
                    <span>Nuevo · sin reseñas aún</span>
                  )}
                </p>
              </div>
            </header>

            <section className="ficha-stats" aria-label="Cifras del profesional">
              <div>
                <strong>{reviewCount > 0 ? rating.toFixed(1) : '—'}</strong>
                <span>Calificación</span>
              </div>
              <div>
                <strong>{jobsDone}</strong>
                <span>{jobsDone === 1 ? 'Trabajo anterior' : 'Trabajos anteriores'}</span>
              </div>
              <div>
                <strong>{price ?? '—'}</strong>
                <span>Visita</span>
              </div>
            </section>

            <section className="ficha-card">
              <h2>Sobre el profesional</h2>
              <p>{row.descripcion?.trim() || 'Atiende en su zona con tarifa de visita publicada.'}</p>
              <ul className="ficha-facts">
                <li>Zona: {row.zona_trabajo?.trim() || 'Puerto Montt'}</li>
                <li>Radio: {row.radio_servicio_km == null ? 'Sin dato' : `${row.radio_servicio_km} km`}</li>
              </ul>
              {resumen ? <p className="ficha-summary">{resumen}</p> : null}
            </section>

            <section className="ficha-card">
              <h2>Horario</h2>
              {hours.length === 0 ? <p className="ficha-empty">Sin horario publicado.</p> : (
                <ul className="ficha-hours">
                  {hours.map((slot) => (
                    <li key={`${slot.dia_semana}-${slot.hora_inicio}`}>
                      <strong>{DAYS[slot.dia_semana] || 'Día'}</strong>
                      <span>{String(slot.hora_inicio).slice(0, 5)}–{String(slot.hora_fin).slice(0, 5)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="ficha-card">
              <h2>Trabajos anteriores</h2>
              {photos.length === 0 ? <p className="ficha-empty">Aún no publica fotos de trabajos.</p> : (
                <ul className="ficha-works">
                  {photos.map((work) => (
                    <li key={work.ruta_foto}>
                      <img src={work.ruta_foto} alt={work.descripcion?.trim() || 'Trabajo anterior'} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="ficha-card">
              <h2>Reseñas de clientes</h2>
              {reviews.length === 0 ? <p className="ficha-empty">Todavía no tiene reseñas publicadas.</p> : (
                <ul className="ficha-reviews">
                  {reviews.map((review, index) => (
                    <li key={`${review.fecha}-${index}`}>
                      <div>
                        <strong>{review.nombre_corto || 'Cliente'}</strong>
                        <StarScore rating={Number(review.nota)} />
                      </div>
                      {review.fecha ? <time dateTime={review.fecha}>{review.fecha.slice(0, 10)}</time> : null}
                      {review.comentario ? <p>{review.comentario}</p> : <p>Calificó el trabajo sin comentario.</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {parecidos.length > 0 ? (
              <section className="ficha-card">
                <h2>Profesionales parecidos</h2>
                <ul className="ficha-similar">
                  {parecidos.map((item) => (
                    <li key={item.id}>
                      <Link to={`/profesional/${item.id}`}>
                        <strong>{item.nombre}</strong>
                        <span>{item.profesion}</span>
                        {item.calificacion == null ? null : <em>{item.calificacion.toFixed(1)}</em>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </article>
        ) : null}
      </main>
      {status === 'ready' && row ? (
        <div className="ficha-bar">
          <div>
            <strong>{price ? `${price} / visita` : 'Tarifa al reservar'}</strong>
            <span>{name}</span>
          </div>
          <button type="button" className="btn-primary" onClick={reserve}>Reservar</button>
        </div>
      ) : null}
      <SiteFooter />
    </div>
  );
}
