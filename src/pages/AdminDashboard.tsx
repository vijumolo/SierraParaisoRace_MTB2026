import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { EventConfig, Participant } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { LogOut, Save, Download, Trash2, Plus, X, AlertTriangle, Edit, Search } from 'lucide-react';
import { EditParticipantModal } from '../components/EditParticipantModal';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';

export const AdminDashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Event State
    const [eventConfig, setEventConfig] = useState<EventConfig | null>(null);
    const [newCategory, setNewCategory] = useState('');

    // Participants State
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);

    // Initial load and auth check
    useEffect(() => {
        checkAuthAndLoadData();
    }, []);

    const checkAuthAndLoadData = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            navigate('/admin');
            return;
        }

        try {
            // Load event config
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
                setEventConfig(mappedEvent);
            }

            // Load participants
            const { data: participantsData, error: participantsError } = await supabase
                .from('participants')
                .select('*')
                .order('registration_date', { ascending: false });

            if (participantsError) throw participantsError;
            setParticipants(participantsData || []);

        } catch (error) {
            console.error('Error loading admin data:', error);
            toast.error('Error al cargar datos del panel');
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/admin');
    };

    // --- EVENT MANAGEMENT ---

    const handleSaveEvent = async () => {
        if (!eventConfig) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('event_config')
                .update({
                    eventname: eventConfig.eventName,
                    eventdescription: eventConfig.eventDescription,
                    activecategories: eventConfig.activeCategories,
                    registration_close_date: eventConfig.registration_close_date
                })
                .eq('id', eventConfig.id);

            if (error) throw error;
            toast.success('Evento actualizado correctamente');
        } catch (error) {
            console.error('Error saving event:', error);
            toast.error('Error al guardar el evento');
        } finally {
            setSaving(false);
        }
    };

    const handleAddCategory = () => {
        if (!newCategory.trim() || !eventConfig) return;
        const currentCategories = eventConfig.activeCategories || [];
        if (currentCategories.includes(newCategory.trim())) {
            toast.error('La categoría ya existe');
            return;
        }

        setEventConfig({
            ...eventConfig,
            activeCategories: [...currentCategories, newCategory.trim()]
        });
        setNewCategory('');
    };

    const handleRemoveCategory = (catToRemove: string) => {
        if (!eventConfig) return;
        const currentCategories = eventConfig.activeCategories || [];
        setEventConfig({
            ...eventConfig,
            activeCategories: currentCategories.filter((c: string) => c !== catToRemove)
        });
    };

    // --- PARTICIPANTS MANAGEMENT ---

    const handleExportExcel = async () => {
        const loadingToast = toast.loading('Preparando exportación...');
        try {
            const { data, error } = await supabase
                .from('participants')
                .select('*')
                .order('registration_date', { ascending: true });

            if (error) throw error;
            if (!data || data.length === 0) {
                toast.error('No hay participantes para exportar', { id: loadingToast });
                return;
            }

            // Mapeo para nombres de columnas más amigables en Excel
            const excelData = data.map((p: Participant) => ({
                'Fecha Registro': p.registration_date ? new Date(p.registration_date).toLocaleString() : '',
                'Documento': p.documentnumber,
                'Nombres y Apellidos': p.fullname,
                'Email': p.email,
                'Celular': p.mobile,
                'Fecha Nacimiento': p.dob,
                'Género': p.gender === 'M' ? 'Masculino' : 'Femenino',
                'Categoría': p.category,
                'Licencia': p.licensenumber || '',
                'Club': p.club || '',
                'Patrocinador': p.sponsor || ''
            }));

            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Inscritos');

            const fileName = `Inscritos_${eventConfig?.eventName?.replace(/\s+/g, '_') || 'Evento'}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, fileName);

            toast.success('Archivo descargado con éxito', { id: loadingToast });
        } catch (error) {
            console.error('Error exporting data:', error);
            toast.error('Error al exportar los datos', { id: loadingToast });
        }
    };

    const handleDeleteAll = async () => {
        const confirmed = window.confirm(
            "⚠️ ¡ADVERTENCIA PELIGROSA!\n\n" +
            "Estás a punto de ELIMINAR TODOS LOS INSCRITOS de la base de datos de forma permanente.\n\n" +
            "¿Estás completamente seguro de que el evento ya finalizó y deseas vaciar la lista de participantes?"
        );

        if (!confirmed) return;

        // Doble confirmación de seguridad
        const finalWord = window.prompt("Escribe 'ELIMINAR' para confirmar el borrado de base de datos:");
        if (finalWord !== 'ELIMINAR') {
            toast('Operación cancelada');
            return;
        }

        const loadingToast = toast.loading('Eliminando todos los registros...');
        try {
            // Nota: En supabase postgrest no es posible hacer un truncate o borrar sin filtro
            // pero podemos borrar donde id no sea nulo.
            const { error } = await supabase
                .from('participants')
                .delete()
                .not('id', 'is', null);

            if (error) throw error;

            setParticipants([]);
            toast.success('Base de datos vaciada exitosamente', { id: loadingToast });
        } catch (error) {
            console.error('Error deleting data:', error);
            toast.error('Hubo un problema al intentar borrar los datos', { id: loadingToast });
        }
    };

    const handleDeleteParticipant = async (id: string, name: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la inscripción de ${name}?`)) {
            return;
        }

        const loadingToast = toast.loading('Eliminando participante...');
        try {
            const { error } = await supabase
                .from('participants')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setParticipants(prev => prev.filter(p => p.id !== id));
            toast.success('Participante eliminado', { id: loadingToast });
        } catch (error) {
            console.error('Error deleting participant:', error);
            toast.error('Error al eliminar participante', { id: loadingToast });
        }
    };

    const filteredParticipants = useMemo(() => {
        if (!searchTerm) return participants;
        const lowerSearch = searchTerm.toLowerCase();
        return participants.filter(
            p => p.fullname.toLowerCase().includes(lowerSearch) ||
                p.documentnumber.toLowerCase().includes(lowerSearch)
        );
    }, [participants, searchTerm]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto animate-fade-in relative pb-10">
            <Toaster position="top-right" />

            <div className="flex items-center justify-between border-b pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Panel de Administración</h1>
                    <p className="mt-2 text-slate-600">Gestiona la configuración del evento y exporta los datos.</p>
                </div>
                <Button variant="outline" onClick={handleSignOut} className="flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300">
                    <LogOut className="h-4 w-4" /> Cerrar Sesión
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Lado Izquierdo: Configuración del Evento */}
                <div className="md:col-span-2 space-y-6">
                    <div className="glass p-6 sm:p-8 rounded-3xl space-y-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900">Configuración del Evento</h2>
                            <Button onClick={handleSaveEvent} isLoading={saving} className="flex items-center gap-2">
                                <Save className="h-4 w-4" /> Guardar
                            </Button>
                        </div>

                        {eventConfig ? (
                            <div className="space-y-5">
                                <Input
                                    label="Nombre del Evento"
                                    value={eventConfig.eventName}
                                    onChange={(e) => setEventConfig({ ...eventConfig, eventName: e.target.value })}
                                />

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Descripción del Evento</label>
                                    <textarea
                                        rows={4}
                                        className="block w-full px-4 py-3 border border-slate-300 rounded-xl bg-white/50 backdrop-blur-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm resize-none"
                                        value={eventConfig.eventDescription}
                                        onChange={(e) => setEventConfig({ ...eventConfig, eventDescription: e.target.value })}
                                    />
                                </div>

                                <Input
                                    label="Fecha de Cierre de Inscripción"
                                    type="date"
                                    value={eventConfig.registration_close_date ? eventConfig.registration_close_date.split('T')[0] : ''}
                                    onChange={(e) => setEventConfig({ ...eventConfig, registration_close_date: e.target.value })}
                                />

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-3">Categorías Disponibles</label>

                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {(eventConfig.activeCategories || []).map((cat: string, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                                <span className="text-sm font-medium text-slate-700">{cat}</span>
                                                <button onClick={() => handleRemoveCategory(cat)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {(!eventConfig.activeCategories || eventConfig.activeCategories.length === 0) && (
                                            <span className="text-sm text-slate-500 italic">No hay categorías configuradas</span>
                                        )}
                                    </div>

                                    <div className="flex gap-2 max-w-sm">
                                        <Input
                                            label="Añadir Categoría"
                                            placeholder="Nueva categoría..."
                                            value={newCategory}
                                            onChange={(e) => setNewCategory(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                                            className="mb-0"
                                        />
                                        <Button variant="outline" onClick={handleAddCategory} className="flex-shrink-0 px-3 mt-0 h-[46px]">
                                            <Plus className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg flex gap-3">
                                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                                <p>No se encontró una configuración de evento activa. Asegúrate de ejecutar el script SQL primero.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Lado Derecho: Acciones y Estadísticas */}
                <div className="space-y-6">
                    <div className="glass p-6 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 text-white relative overflow-hidden group">
                        <div className="absolute inset-0 bg-white/10 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <h3 className="text-brand-100 font-medium text-sm uppercase tracking-wider mb-2 relative z-10">Total de Inscritos</h3>
                        <div className="text-5xl font-extrabold mb-4 relative z-10">{participants.length}</div>
                        <p className="text-brand-200 text-sm relative z-10">Base de datos en tiempo real.</p>
                    </div>

                    <div className="glass p-6 rounded-3xl space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 border-b pb-3 mb-4">Exportación y Cierre</h3>

                        <Button
                            className="w-full flex items-center justify-center gap-2 h-12 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 border-0"
                            onClick={handleExportExcel}
                        >
                            <Download className="h-5 w-5" /> Exportar a Excel
                        </Button>
                        <p className="text-xs text-slate-500 text-center">Descarga un reporte .xlsx con todos los campos y usuarios registrados.</p>

                        <div className="pt-6 border-t border-slate-200 mt-6">
                            <h4 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-1">
                                <AlertTriangle className="h-4 w-4" /> Zona de Peligro
                            </h4>
                            <p className="text-xs text-slate-500 mb-4">
                                Esta acción eliminará permanentemente todos los registros para habilitar el sistema para un nuevo evento.
                            </p>
                            <Button
                                variant="outline"
                                className="w-full flex items-center justify-center gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                onClick={handleDeleteAll}
                            >
                                <Trash2 className="h-4 w-4" /> Borrar Base de Datos
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gestión de Participantes */}
            <div className="mt-8 glass p-6 sm:p-8 rounded-3xl space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Gestión de Participantes</h2>
                        <p className="text-sm text-slate-500 mt-1">Edita o elimina los registros de este evento.</p>
                    </div>
                    <div className="w-full sm:w-64 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o documento..."
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl text-sm bg-white/50 focus:bg-white focus:ring-brand-500 focus:border-brand-500 transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Documento</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Participante</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Categoría</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white/50 divide-y divide-slate-200">
                            {filteredParticipants.length > 0 ? (
                                filteredParticipants.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                                            {p.documentnumber}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                            <div>{p.fullname}</div>
                                            <div className="text-xs text-slate-500">{p.email} • {p.mobile}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200">
                                                {p.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setEditingParticipant(p)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteParticipant(p.id!, p.fullname)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500">
                                        No se encontraron participantes.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {editingParticipant && eventConfig && (
                <EditParticipantModal
                    participant={editingParticipant}
                    eventDetails={eventConfig}
                    onClose={() => setEditingParticipant(null)}
                    onUpdate={(updated) => {
                        setParticipants(prev => prev.map(p => p.id === updated.id ? updated : p));
                        setEditingParticipant(null);
                        toast.success('Participante actualizado correctamente');
                    }}
                />
            )}
        </div>
    );
};
