import { useEffect, useMemo, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ArrowLeft,
  FileSearch,
  FileText,
  Filter,
  Flag,
  Gauge,
  LoaderCircle,
  MapPin,
  Medal,
  Printer,
  Search,
  Timer,
  Trophy,
} from 'lucide-react';
import './App.css';
import tctJaguarLogo from '../logo/TCTJaguar.png';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
const appBase = import.meta.env.BASE_URL;

type ResultRecord = {
  bib: string;
  position: string;
  category: string;
  gender: string;
  name: string;
  city: string;
  chipTime: string;
  diff: string;
  averageSpeed: string;
  plate: string;
  gunTime: string;
  chipTimeDiploma: string;
  categoryPosition: string;
  categoryTotal: string;
  globalPosition: string;
  globalTotal: string;
  diplomaPage: number | null;
  diplomaUrl: string | null;
};

type EventPayload = {
  event: {
    eventName: string;
    modality: string;
    location: string;
    eventDate: string;
    distanceLabel: string;
  };
  sourceFiles: {
    resultsPdf: string;
    diplomasPdf: string;
  };
  totals: {
    participants: number;
    categories: number;
    cities: number;
  };
  categories: string[];
  cities: string[];
  results: ResultRecord[];
};

const sortOptions = {
  global: 'Clasificacion global',
  category: 'Puesto de categoria',
  plate: 'Placa',
  name: 'Nombre',
} as const;

const formatLongDate = (value: string) =>
  new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));

const getNumericPosition = (value: string) => Number(value.replace('.', '')) || Number.MAX_SAFE_INTEGER;

const withBase = (value: string) => {
  const normalizedBase = appBase.endsWith('/') ? appBase : `${appBase}/`;
  const normalizedValue = value.startsWith('/') ? value.slice(1) : value;
  return `${normalizedBase}${normalizedValue}`;
};

const buildDiplomaViewUrl = (record: ResultRecord) => {
  const params = new URLSearchParams({
    view: 'diploma',
    page: String(record.diplomaPage ?? ''),
    plate: record.plate,
  });

  return `?${params.toString()}`;
};

function DiplomaViewer({
  data,
  record,
}: {
  data: EventPayload;
  record: ResultRecord;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [viewerLoading, setViewerLoading] = useState(true);
  const [viewerError, setViewerError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const renderDiploma = async () => {
      if (!record.diplomaPage || !canvasRef.current) {
        setViewerError('No fue posible identificar la pagina del diploma para este deportista.');
        setViewerLoading(false);
        return;
      }

      setViewerLoading(true);
      setViewerError('');

      try {
        renderTaskRef.current?.cancel();
        renderTaskRef.current = null;

        const pdf = await getDocument(withBase(data.sourceFiles.diplomasPdf)).promise;
        const page = await pdf.getPage(record.diplomaPage);
        const viewport = page.getViewport({ scale: 2.2 });
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if (!canvas || !context) {
          throw new Error('No fue posible preparar el lienzo del diploma.');
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        context.clearRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });

        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (!cancelled) {
          renderTaskRef.current = null;
          setViewerLoading(false);
        }
      } catch (error) {
        const isRenderCancelled =
          error instanceof Error &&
          (error.name === 'RenderingCancelledException' ||
            error.message.includes('cancelled') ||
            error.message.includes('multiple render() operations'));

        if (isRenderCancelled) {
          return;
        }

        if (!cancelled) {
          setViewerError(error instanceof Error ? error.message : 'No fue posible cargar el diploma.');
          setViewerLoading(false);
        }
      }
    };

    void renderDiploma();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [data.sourceFiles.diplomasPdf, record.diplomaPage]);

  return (
    <div className="race-app">
      <main className="race-shell race-shell--diploma">
        <section className="diploma-topbar no-print">
          <a href="./" className="hero__button hero__button--ghost">
            <ArrowLeft size={18} />
            Volver a resultados
          </a>
          <button type="button" className="hero__button hero__button--primary" onClick={() => window.print()}>
            <Printer size={18} />
            Imprimir diploma
          </button>
        </section>

        <section className="diploma-panel">
          <header className="diploma-panel__header no-print">
            <div>
              <span className="hero__eyebrow">Diploma Individual</span>
              <h1>{record.name}</h1>
              <p>
                Placa {record.plate} · {record.category} · Global {record.globalPosition}/{record.globalTotal}
              </p>
            </div>
          </header>

          {viewerLoading ? (
            <div className="state-card no-print">
              <LoaderCircle className="spin" size={22} />
              <span>Cargando diploma virtual...</span>
            </div>
          ) : null}

          {viewerError ? (
            <div className="state-card state-card--error no-print">
              <span>{viewerError}</span>
            </div>
          ) : null}

          <div className="diploma-canvas-wrap">
            <canvas ref={canvasRef} className={viewerLoading || viewerError ? 'diploma-canvas diploma-canvas--hidden' : 'diploma-canvas'} />
          </div>
        </section>
      </main>
    </div>
  );
}

function App() {
  const [data, setData] = useState<EventPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentSearch, setCurrentSearch] = useState(() => window.location.search);
  const [search, setSearch] = useState('');
  const [plateFilter, setPlateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [sortBy, setSortBy] = useState<keyof typeof sortOptions>('global');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(withBase('data/sierra-paraiso-race-mtb.json'));
        if (!response.ok) {
          throw new Error('No fue posible leer el dataset del evento.');
        }
        const payload = (await response.json()) as EventPayload;
        setData(payload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar la informacion del evento.');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentSearch(window.location.search);
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleLocationChange();
    };

    window.history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleLocationChange();
    };

    window.addEventListener('popstate', handleLocationChange);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const filteredResults = useMemo(() => {
    if (!data) return [];

    const query = search.trim().toLowerCase();
    const normalizedPlate = plateFilter.trim().toLowerCase();

    const filtered = data.results.filter((record) => {
      const matchesSearch = query
        ? `${record.name} ${record.city} ${record.category} ${record.gender} ${record.bib}`
            .toLowerCase()
            .includes(query)
        : true;
      const matchesPlate = normalizedPlate ? record.plate.toLowerCase().includes(normalizedPlate) : true;
      const matchesCategory = categoryFilter === 'all' ? true : record.category === categoryFilter;
      const matchesGender = genderFilter === 'all' ? true : record.gender === genderFilter;
      const matchesCity = cityFilter === 'all' ? true : record.city === cityFilter;

      return matchesSearch && matchesPlate && matchesCategory && matchesGender && matchesCity;
    });

    return filtered.sort((left, right) => {
      if (sortBy === 'global') {
        return getNumericPosition(left.globalPosition) - getNumericPosition(right.globalPosition);
      }
      if (sortBy === 'category') {
        return getNumericPosition(left.categoryPosition) - getNumericPosition(right.categoryPosition);
      }
      if (sortBy === 'plate') {
        return Number(left.plate) - Number(right.plate);
      }
      return left.name.localeCompare(right.name, 'es');
    });
  }, [categoryFilter, cityFilter, data, genderFilter, plateFilter, search, sortBy]);

  const genders = useMemo(() => (data ? [...new Set(data.results.map((record) => record.gender))] : []), [data]);

  const filteredStats = useMemo(() => {
    return {
      visible: filteredResults.length,
      podium: filteredResults.filter((record) => getNumericPosition(record.globalPosition) <= 3).length,
    };
  }, [filteredResults]);

  const selectedDiplomaRecord = useMemo(() => {
    if (!data) return null;
    const params = new URLSearchParams(currentSearch);
    if (params.get('view') !== 'diploma') return null;
    const plate = params.get('plate');
    const page = params.get('page');
    return (
      data.results.find(
        (record) =>
          record.plate === plate &&
          String(record.diplomaPage ?? '') === String(page ?? ''),
      ) ?? null
    );
  }, [currentSearch, data]);

  if (data && selectedDiplomaRecord) {
    return <DiplomaViewer key={`${selectedDiplomaRecord.plate}-${selectedDiplomaRecord.diplomaPage}`} data={data} record={selectedDiplomaRecord} />;
  }

  return (
    <div className="race-app">
      <main className="race-shell">
        <section className="hero">
          <div className="hero__copy">
            <div className="hero__brand">
              <img src={tctJaguarLogo} alt="Logo TCT Colombia's Team Timers" className="hero__brand-logo" />
              <div className="hero__brand-copy">
                <span className="hero__eyebrow">Resultados Oficiales</span>
                <strong>TCT Colombia's Team Timers</strong>
              </div>
            </div>
            <h1>{data?.event.eventName ?? 'SIERRA PARAISO RACE'}</h1>
            <p>
              Consulta real del PDF oficial de resultados de la modalidad MTB. Cada registro muestra los datos exactos del
              deportista y al final abre su diploma virtual real en la pagina correspondiente del PDF.
            </p>
          </div>

          <div className="hero__panel">
            <div className="hero__meta">
              <span><Flag size={16} />{data?.event.modality ?? 'MTB'}</span>
              <span><MapPin size={16} />{data?.event.location ?? 'Curiti, Santander'}</span>
              <span><Timer size={16} />{data ? formatLongDate(data.event.eventDate) : '22 de marzo de 2026'}</span>
              <span><Gauge size={16} />{data?.event.distanceLabel ?? '23 y 50 km'}</span>
            </div>

            <div className="hero__actions">
              <a href={data ? withBase(data.sourceFiles.resultsPdf) : '#'} target="_blank" rel="noreferrer" className="hero__button hero__button--primary">
                <FileSearch size={18} />
                Ver PDF de resultados
              </a>
              <a href={data ? withBase(data.sourceFiles.diplomasPdf) : '#'} target="_blank" rel="noreferrer" className="hero__button hero__button--ghost">
                <FileText size={18} />
                Ver PDF de diplomas
              </a>
            </div>
          </div>
        </section>

        <section className="summary-grid">
          <article>
            <span>Registros reales</span>
            <strong>{data?.totals.participants ?? 0}</strong>
          </article>
          <article>
            <span>Categorias</span>
            <strong>{data?.totals.categories ?? 0}</strong>
          </article>
          <article>
            <span>Ciudades</span>
            <strong>{data?.totals.cities ?? 0}</strong>
          </article>
          <article>
            <span>Resultados visibles</span>
            <strong>{filteredStats.visible}</strong>
          </article>
        </section>

        <section className="filters">
          <div className="filters__header">
            <div>
              <span className="filters__eyebrow">Busqueda inteligente</span>
              <h2>Filtrar resultados</h2>
            </div>
            <div className="filters__badge">
              <Filter size={16} />
              <span>{filteredStats.podium} registros del top 3 global en la vista actual</span>
            </div>
          </div>

          <div className="filters__grid">
            <label className="field field--search">
              <span>Buscar</span>
              <div className="field__control">
                <Search size={18} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre, ciudad, categoria o placa"
                />
              </div>
            </label>

            <label className="field">
              <span>Placa</span>
              <input
                type="text"
                inputMode="numeric"
                value={plateFilter}
                onChange={(event) => setPlateFilter(event.target.value)}
                placeholder="Ej. 204"
              />
            </label>

            <label className="field">
              <span>Categoria</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">Todas</option>
                {data?.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Genero</span>
              <select value={genderFilter} onChange={(event) => setGenderFilter(event.target.value)}>
                <option value="all">Todos</option>
                {genders.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Ciudad</span>
              <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
                <option value="all">Todas</option>
                {data?.cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Orden</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as keyof typeof sortOptions)}>
                {Object.entries(sortOptions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {loading ? (
          <section className="state-card">
            <LoaderCircle className="spin" size={22} />
            <span>Cargando datos oficiales del evento...</span>
          </section>
        ) : null}

        {error ? (
          <section className="state-card state-card--error">
            <span>{error}</span>
          </section>
        ) : null}

        {!loading && !error && filteredResults.length === 0 ? (
          <section className="state-card">
            <span>No hay registros que coincidan con los filtros actuales.</span>
          </section>
        ) : null}

        {!loading && !error && filteredResults.length > 0 ? (
          <section className="results-grid">
            {filteredResults.map((record) => (
              <article key={`${record.bib}-${record.globalPosition}`} className="result-card">
                <header className="result-card__header">
                  <div>
                    <span className="result-card__eyebrow">{record.category}</span>
                    <h3>{record.name}</h3>
                  </div>
                  <div className="result-card__plate">Placa {record.plate}</div>
                </header>

                <div className="result-card__badges">
                  <span className="badge badge--gold"><Trophy size={14} />Global {record.globalPosition}/{record.globalTotal}</span>
                  <span className="badge badge--cyan"><Medal size={14} />Categoria {record.categoryPosition}/{record.categoryTotal}</span>
                  <span className="badge badge--white">{record.gender}</span>
                </div>

                <div className="result-card__meta">
                  <span><MapPin size={15} />{record.city || 'Ciudad no indicada en el PDF'}</span>
                  <span><Timer size={15} />Tiempo chip resultados: {record.chipTime}</span>
                  <span><Timer size={15} />Tiempo chip diploma: {record.chipTimeDiploma}</span>
                  <span><FileText size={15} />Tiempo pistola: {record.gunTime}</span>
                  <span><Gauge size={15} />Velocidad promedio: {record.averageSpeed}</span>
                  <span><Flag size={15} />Diferencia: {record.diff}</span>
                </div>

                <footer className="result-card__footer">
                  <div className="result-card__rank">
                    <strong>Puesto en categoria</strong>
                    <span>{record.position}</span>
                  </div>
                  <a href={buildDiplomaViewUrl(record)} className="diploma-button">
                    Ver diploma virtual
                  </a>
                </footer>
              </article>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
