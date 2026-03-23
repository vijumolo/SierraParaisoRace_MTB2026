import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../lib/supabase';
import type { Participant, EventConfig } from '../types';
import { Input } from './Input';
import { Select } from './Select';
import { Button } from './Button';
import { X, Save, AlertCircle } from 'lucide-react';

interface EditParticipantModalProps {
    participant: Participant;
    eventDetails: EventConfig;
    onClose: () => void;
    onUpdate: (updated: Participant) => void;
}

export const EditParticipantModal: React.FC<EditParticipantModalProps> = ({ participant, eventDetails, onClose, onUpdate }) => {
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const { register, handleSubmit, formState: { errors }, reset } = useForm<Participant>({
        defaultValues: participant
    });

    useEffect(() => {
        reset(participant);
    }, [participant, reset]);

    const categoryOptions = React.useMemo(() => {
        const defaultCategories = eventDetails.activeCategories || [];
        const currentCategory = participant.category;

        // Si la categoría del participante no está configurada en la BD, se agrega temporalmente para evitar que el select esté vacío.
        if (currentCategory && !defaultCategories.includes(currentCategory)) {
            return [...defaultCategories, currentCategory].map(c => ({ value: c, label: c }));
        }
        return defaultCategories.map(c => ({ value: c, label: c }));
    }, [eventDetails.activeCategories, participant.category]);

    const onSubmit = async (data: Participant) => {
        setSubmitting(true);
        setSubmitError(null);

        try {
            const { error } = await supabase
                .from('participants')
                .update({
                    documentnumber: data.documentnumber,
                    fullname: data.fullname,
                    email: data.email,
                    mobile: data.mobile,
                    dob: data.dob,
                    gender: data.gender,
                    category: data.category,
                    licensenumber: data.licensenumber,
                    club: data.club,
                    sponsor: data.sponsor
                })
                .eq('id', participant.id);

            if (error) {
                if (error.code === '23505') {
                    throw new Error('Ya existe un registro con este número de documento.');
                }
                throw error;
            }

            onUpdate({ ...participant, ...data });
        } catch (error: any) {
            console.error('Error updating participant:', error);
            setSubmitError(error.message || 'Error al actualizar el registro.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-xl font-bold text-slate-900">Editar Participante</h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <form id="edit-participant-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {submitError && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                                <div className="flex">
                                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                                    <p className="ml-3 text-sm text-red-700">{submitError}</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <Input label="Documento" register={register('documentnumber', { required: 'Requerido', minLength: { value: 6, message: 'Mínimo 6 dígitos' } })} error={errors.documentnumber?.message} />
                            <Input label="Nombre Completo" register={register('fullname', { required: 'Requerido', minLength: { value: 5, message: 'Nombre completo' } })} error={errors.fullname?.message} />
                            <Input label="Correo" type="email" register={register('email', { required: 'Requerido', pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: "Correo inválido" } })} error={errors.email?.message} />
                            <Input label="Celular" type="tel" register={register('mobile', { required: 'Requerido', minLength: { value: 10, message: '10 dígitos' }, pattern: { value: /^[0-9]+$/, message: 'Solo números' } })} error={errors.mobile?.message} />
                            <Input label="Fecha Nac." type="date" register={register('dob', { required: 'Requerido' })} error={errors.dob?.message} />

                            <Select label="Género" options={[{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }]} register={register('gender', { required: 'Requerido' })} error={errors.gender?.message} />
                            <Select label="Categoría" options={categoryOptions} register={register('category', { required: 'Requerido' })} error={errors.category?.message} />
                            <Input label="Licencia (Opcional)" register={register('licensenumber')} />
                            <Input label="Club (Opcional)" register={register('club')} />
                            <Input label="Patrocinador (Opcional)" register={register('sponsor')} />
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} type="button">Cancelar</Button>
                    <Button type="submit" form="edit-participant-form" isLoading={submitting} className="flex items-center gap-2">
                        <Save className="h-4 w-4" /> Guardar Cambios
                    </Button>
                </div>
            </div>
        </div>
    );
};
