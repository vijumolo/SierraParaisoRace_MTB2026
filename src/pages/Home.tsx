import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import type { EventConfig, Participant } from '../types';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import { AlertCircle, CheckCircle, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Home = () => {
    const [eventDetails, setEventDetails] = useState<EventConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [registeredData, setRegisteredData] = useState<Participant | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<Participant>();

    useEffect(() => {
        fetchEventDetails();
    }, []);

    const fetchEventDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('event_config')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error) throw error;

            const mappedEvent: EventConfig = {
                id: data.id,
                eventName: data.eventname || data.event_name || data.eventName || '',
                eventDescription: data.eventdescription || data.event_description || data.eventDescription || '',
                activeCategories: data.activecategories || data.active_categories || data.activeCategories || [],
                registration_close_date: data.registration_close_date || data.close_date || ''
            };

            setEventDetails(mappedEvent);
        } catch (error) {
            console.error('Error fetching event details:', error);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: Participant) => {
        if (!eventDetails) return;
        setSubmitting(true);
        setSubmitError(null);

        try {
            const participantData = {
                ...data,
                event_id: eventDetails.id,
            };

            const { error } = await supabase
                .from('participants')
                .insert([participantData]);

            if (error) {
                if (error.code === '23505') {
                    throw new Error('Ya existe un registro con este número de documento o correo electrónico para este evento.');
                }
                throw error;
            }

            setRegisteredData(participantData);
            setSuccess(true);
        } catch (error: any) {
            console.error('Error submitting form:', error);
            setSubmitError(error.message || 'Ocurrió un error al procesar tu inscripción.');
        } finally {
            setSubmitting(false);
        }
    };

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
                <AlertCircle className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <h2 className="text-xl font-semibold text-slate-900">No hay eventos activos</h2>
                <p className="mt-2 text-slate-600">Por el momento no tenemos eventos disponibles para inscripción.</p>
            </div>
        );
    }

    // Comprobar si la fecha de cierre ya pasó
    const isClosed = eventDetails.registration_close_date && new Date(eventDetails.registration_close_date) < new Date();

    if (isClosed) {
        return (
            <div className="text-center py-12 glass rounded-2xl">
                <AlertCircle className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <h2 className="text-xl font-semibold text-slate-900">Inscripciones Cerradas</h2>
                <p className="mt-2 text-slate-600">El período de inscripción para {eventDetails.eventName} ha finalizado.</p>
            </div>
        );
    }

    if (success && registeredData) {
        const whatsappMessage = encodeURIComponent(
            `*COMPROBANTE DE INSCRIPCIÓN* 🏆\n` +
            `¡Hola ${registeredData.fullname}! Te has inscrito exitosamente a *${eventDetails.eventName}*.\n\n` +
            `*Tus datos de registro:*\n` +
            `👤 Nombre: ${registeredData.fullname}\n` +
            `🆔 Documento: ${registeredData.documentnumber}\n` +
            `🏷️ Categoría: ${registeredData.category}\n\n` +
            `Guarda este mensaje como constancia de tu registro oficial.`
        );
        const whatsappUrl = `https://wa.me/${registeredData.mobile.replace(/[^0-9]/g, '')}?text=${whatsappMessage}`;

        return (
            <div className="max-w-xl mx-auto text-center space-y-6 animate-fade-in">
                <div className="glass p-8 rounded-2xl shadow-xl border-green-100">
                    <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-6" />
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">¡Inscripción Exitosa!</h2>
                    <p className="text-lg text-slate-600 mb-8">
                        Tu registro para <strong>{eventDetails.eventName}</strong> ha sido guardado correctamente.
                    </p>

                    <div className="space-y-4">
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-full h-12 px-6 font-medium text-white transition-colors bg-[#25D366] rounded-xl hover:bg-[#1ebe55] shadow-lg shadow-[#25D366]/30"
                        >
                            Guardar constancia en mi WhatsApp
                        </a>

                        <Button
                            variant="outline"
                            className="w-full h-12 rounded-xl"
                            onClick={() => window.location.reload()}
                        >
                            Realizar otra inscripción
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl drop-shadow-sm">
                    {eventDetails.eventName}
                </h1>
                <p className="max-w-2xl mx-auto text-xl text-slate-600 whitespace-pre-line">
                    {eventDetails.eventDescription}
                </p>
                <div className="pt-4 flex justify-center">
                    <Link
                        to="/registrations"
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-full transition-all border border-brand-200 shadow-sm hover:shadow-md"
                    >
                        <Users className="w-5 h-5" />
                        Ver Lista de Deportistas Inscritos
                    </Link>
                </div>
            </div>

            <div className="glass p-6 sm:p-10 rounded-3xl shadow-2xl mt-12 relative overflow-hidden">
                {/* Decoración de fondo */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600"></div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 relative z-10">
                    {submitError && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <AlertCircle className="h-5 w-5 text-red-500" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-red-700">{submitError}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <h3 className="text-lg font-medium text-slate-900 border-b pb-2 mb-4">Información Personal</h3>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <Input
                                label="Documento de Identidad"
                                placeholder="Ej. 1020304050"
                                required
                                register={register('documentnumber', {
                                    required: 'El documento es obligatorio',
                                    minLength: { value: 6, message: 'El documento debe tener al menos 6 dígitos' }
                                })}
                                error={errors.documentnumber?.message}
                            />

                            <Input
                                label="Nombre Completo"
                                placeholder="Ej. Juan Pérez"
                                required
                                register={register('fullname', {
                                    required: 'El nombre es obligatorio',
                                    minLength: { value: 5, message: 'Ingresa tu nombre completo' }
                                })}
                                error={errors.fullname?.message}
                            />

                            <Input
                                label="Correo Electrónico"
                                type="email"
                                placeholder="correo@ejemplo.com"
                                required
                                register={register('email', {
                                    required: 'El correo es obligatorio',
                                    pattern: {
                                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                        message: "Dirección de correo inválida"
                                    }
                                })}
                                error={errors.email?.message}
                            />

                            <Input
                                label="Teléfono Celular"
                                type="tel"
                                placeholder="Ej. 3001234567"
                                required
                                register={register('mobile', {
                                    required: 'El celular es obligatorio',
                                    minLength: { value: 10, message: 'Ingrese un número de celular válido de 10 dígitos' },
                                    pattern: { value: /^[0-9]+$/, message: 'Solo se permiten números' }
                                })}
                                error={errors.mobile?.message}
                            />

                            <Input
                                label="Fecha de Nacimiento"
                                type="date"
                                required
                                register={register('dob', {
                                    required: 'La fecha es obligatoria',
                                    validate: value => {
                                        const date = new Date(value);
                                        const now = new Date();
                                        const age = now.getFullYear() - date.getFullYear();
                                        return age >= 10 || 'Debes tener al menos 10 años para participar';
                                    }
                                })}
                                error={errors.dob?.message}
                            />

                            <Select
                                label="Género"
                                required
                                options={[
                                    { value: 'M', label: 'Masculino' },
                                    { value: 'F', label: 'Femenino' },
                                ]}
                                register={register('gender', { required: 'Selecciona una opción' })}
                                error={errors.gender?.message}
                            />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium text-slate-900 border-b pb-2 mb-4">Datos del Evento</h3>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <Select
                                label="Categoría"
                                required
                                options={(eventDetails.activeCategories || []).map((cat: string) => ({ value: cat, label: cat }))}
                                register={register('category', { required: 'La categoría es obligatoria' })}
                                error={errors.category?.message}
                            />

                            <Input
                                label="Número de Licencia (Opcional)"
                                placeholder="Ej. LIC-12345"
                                register={register('licensenumber')}
                            />

                            <Input
                                label="Club (Opcional)"
                                placeholder="Ej. Club Ciclista"
                                register={register('club')}
                            />

                            <Input
                                label="Patrocinador (Opcional)"
                                placeholder="Ej. Sports Brand"
                                register={register('sponsor')}
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button
                            type="submit"
                            size="lg"
                            className="w-full sm:w-auto min-w-[200px] text-lg rounded-xl transition-all duration-300"
                            isLoading={submitting}
                            disabled={submitting}
                        >
                            {submitting ? 'Procesando Inscripción...' : 'Inscribirme Ahora'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
