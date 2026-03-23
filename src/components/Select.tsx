import React from 'react';
import { cn } from '../lib/utils';
import type { UseFormRegisterReturn } from 'react-hook-form';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    options: { value: string; label: string }[];
    error?: string;
    register?: UseFormRegisterReturn;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, label, options, error, register, id, ...props }, ref) => {
        const selectId = id || register?.name;

        return (
            <div className="w-full">
                <label htmlFor={selectId} className="block text-sm font-medium leading-6 text-slate-900 mb-1">
                    {label} {props.required && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                    <select
                        id={selectId}
                        ref={ref}
                        className={cn(
                            "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-shadow appearance-none",
                            error && "border-red-500 focus:ring-red-500",
                            className
                        )}
                        {...register}
                        {...props}
                    >
                        <option value="" disabled>Selecciona una opción</option>
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                        <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                        </svg>
                    </div>
                </div>
                {error && (
                    <p className="mt-1 text-sm text-red-500 animate-slide-up">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Select.displayName = "Select";
