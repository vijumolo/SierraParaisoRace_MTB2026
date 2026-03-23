import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Participant, EventConfig } from '../types';
import { Select } from '../components/Select';
import { EditParticipantModal } from '../components/EditParticipantModal';
import { Search, Users, Trophy, Activity, ArrowUpDown, Edit2 } from 'lucide-react';

export const Registrations = () => {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [eventDetails, setEventDetails] = useState<EventConfig | null>(null);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    // Manejadores de Filtros
    const handleSearchChange = (val: string) => {
        setSearchTerm(val);
        setCurrentPage(1);
    };

    const handleCategoryChange = (val: string) => {
        setCategoryFilter(val);
        setCurrentPage(1);
    };

    // Ordenamiento
    const [sortField, setSortField] = useState<keyof Participant>('registration_date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // 1. Obtener el evento activo
            const { data: eventData, error: eventError } = await supabase
                .from('event_config')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (eventError && eventError.code !== 'PGRST116') throw eventError;

            if (eventData) {
                const mappedEvent: EventConfig = {
                    id: eventData.id,
                    eventName: eventData.eventname || eventData.event_name || eventData.eventName || '',
                    eventDescription: eventData.eventdescription || eventData.event_description || eventData.eventDescription || '',
                    activeCategories: eventData.activecategories || eventData.active_categories || eventData.activeCategories || [],
                    registration_close_date: eventData.registration_close_date || eventData.close_date || ''
                };
                setEventDetails(mappedEvent);

                // 2. Obtener los participantes de este evento
                const { data: participantsData, error: participantsError } = await supabase
                    .from('participants')
                    .select('*')
                    .eq('event_id', eventData.id);

                if (participantsError) throw participantsError;
                setParticipants(participantsData || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: keyof Participant) => {
        if (field === sortField) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const filteredAndSortedParticipants = useMemo(() => {
        let result = [...participants];

        // Aplicar búsqueda
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(
                p => p.fullname.toLowerCase().includes(lowerSearch) ||
                    p.documentnumber.toLowerCase().includes(lowerSearch)
            );
        }

        // Aplicar filtro de categoría
        if (categoryFilter) {
            result = result.filter(p => p.category === categoryFilter);
        }

        // Aplicar ordenamiento
        result.sort((a, b) => {
            let aVal = a[sortField] || '';
            let bVal = b[sortField] || '';

            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [participants, searchTerm, categoryFilter, sortField, sortDirection]);

    // Estadísticas
    const stats = useMemo(() => {
        const total = participants.length;
        const byCategory = participants.reduce((acc, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return { total, byCategory };
    }, [participants]);


    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            </div>
        );
    }

    if (!eventDetails) {
        return (
            <div className="text-center py-12 glass rounded-2xl">
                <Users className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <h2 className="text-xl font-semibold text-slate-900">Sin datos</h2>
                <p className="mt-2 text-slate-600">No hay eventos configurados actualmente.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                    Inscritos: {eventDetails.eventName}
                </h1>
                <p className="mt-2 text-slate-600">
                    Administración y vista pública de los participantes registrados.
                </p>
            </div>

            {/* Tarjetas de Estadísticas */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="glass overflow-hidden rounded-2xl p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-brand-100 rounded-xl p-3">
                            <Users className="h-6 w-6 text-brand-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-slate-500 truncate">Total Inscritos</dt>
                                <dd className="text-3xl font-bold text-slate-900">{stats.total}</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <div className="glass overflow-hidden rounded-2xl p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-green-100 rounded-xl p-3">
                            <Activity className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-slate-500 truncate">Categorías Activas</dt>
                                <dd className="text-3xl font-bold text-slate-900">{Object.keys(stats.byCategory).length}</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <div className="glass overflow-hidden rounded-2xl p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-purple-100 rounded-xl p-3">
                            <Trophy className="h-6 w-6 text-purple-600" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-slate-500 truncate">Categoría Principal</dt>
                                <dd className="text-xl font-bold text-slate-900 truncate">
                                    {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
                                </dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gráfico de Distribución (Barras) */}
            {stats.total > 0 && (
                <div className="glass p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 border-b pb-2">Distribución por Categorías</h3>
                    <div className="space-y-4">
                        {Object.entries(stats.byCategory)
                            .sort((a, b) => b[1] - a[1])
                            .map(([category, count]) => {
                                const percentage = Math.round((count / stats.total) * 100);
                                return (
                                    <div key={category} className="group">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium text-slate-700">{category}</span>
                                            <span className="text-slate-500 font-mono">{count} inscritos ({percentage}%)</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className="bg-brand-500 h-2.5 rounded-full transition-all duration-1000 ease-out group-hover:bg-brand-400"
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Controles de Filtado */}
            <div className="glass p-6 rounded-2xl space-y-4 sm:space-y-0 sm:flex sm:items-end sm:gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Buscar Participante</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-shadow"
                            placeholder="Nombre o Documento..."
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                    </div>
                </div>

                <div className="sm:w-64">
                    <Select
                        label="Filtrar por Categoría"
                        value={categoryFilter}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        options={[
                            { value: '', label: 'Todas las categorías' },
                            ...(eventDetails.activeCategories || []).map((c: string) => ({ value: c, label: c }))
                        ]}
                    />
                </div>
            </div>

            {/* Tabla de Datos */}
            <div className="glass rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('fullname')}>
                                    <div className="flex items-center gap-1">Participante <ArrowUpDown className="h-3 w-3" /></div>
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('documentnumber')}>
                                    <div className="flex items-center gap-1">Documento <ArrowUpDown className="h-3 w-3" /></div>
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('category')}>
                                    <div className="flex items-center gap-1">Categoría <ArrowUpDown className="h-3 w-3" /></div>
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100" onClick={() => handleSort('registration_date')}>
                                    <div className="flex items-center gap-1">Fecha Registro <ArrowUpDown className="h-3 w-3" /></div>
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider ring-0 border-0">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white/50 divide-y divide-slate-200">
                            {filteredAndSortedParticipants.length > 0 ? (
                                filteredAndSortedParticipants
                                    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                                    .map((participant) => (
                                        <tr key={participant.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                                {participant.fullname}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {participant.documentnumber}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800">
                                                    {participant.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {new Date(participant.registration_date!).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => setEditingParticipant(participant)}
                                                    className="text-brand-600 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 p-2 rounded-lg transition-colors inline-flex items-center gap-2"
                                                    title="Editar Registro"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                    <span className="hidden sm:inline">Editar</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No se encontraron participantes con esos filtros.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Controles de Paginación */}
                {filteredAndSortedParticipants.length > ITEMS_PER_PAGE && (
                    <div className="bg-white/50 px-6 py-4 border-t border-slate-200 flex items-center justify-between sm:px-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredAndSortedParticipants.length / ITEMS_PER_PAGE), p + 1))}
                                disabled={currentPage >= Math.ceil(filteredAndSortedParticipants.length / ITEMS_PER_PAGE)}
                                className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Siguiente
                            </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-slate-700">
                                    Mostrando <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> a <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedParticipants.length)}</span> de <span className="font-medium">{filteredAndSortedParticipants.length}</span> resultados
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="sr-only">Anterior</span>
                                        &larr;
                                    </button>

                                    {/* Generador de páginas simplificado (Primer página, actual, última página) */}
                                    <span className="relative inline-flex items-center px-4 py-2 border border-slate-300 bg-white text-sm font-medium text-slate-700">
                                        Página {currentPage} de {Math.ceil(filteredAndSortedParticipants.length / ITEMS_PER_PAGE)}
                                    </span>

                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredAndSortedParticipants.length / ITEMS_PER_PAGE), p + 1))}
                                        disabled={currentPage >= Math.ceil(filteredAndSortedParticipants.length / ITEMS_PER_PAGE)}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="sr-only">Siguiente</span>
                                        &rarr;
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Edición de Participante */}
            {editingParticipant && eventDetails && (
                <EditParticipantModal
                    participant={editingParticipant}
                    eventDetails={eventDetails}
                    onClose={() => setEditingParticipant(null)}
                    onUpdate={(updated) => {
                        // Actualizar la lista local instantáneamente para que la tabla refleje el cambio
                        setParticipants(prev => prev.map(p => p.id === updated.id ? updated : p));
                        setEditingParticipant(null);
                    }}
                />
            )}
        </div>
    );
};
