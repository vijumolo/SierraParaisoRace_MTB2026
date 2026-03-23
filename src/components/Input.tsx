import React from 'react';
import { cn } from '../lib/utils';
import type { UseFormRegisterReturn } from 'react-hook-form';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    register?: UseFormRegisterReturn;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, register, id, ...props }, ref) => {
        const inputId = id || register?.name;

        return (
            <div className="w-full">
                <label htmlFor={inputId} className="block text-sm font-medium leading-6 text-slate-900 mb-1">
                    {label} {props.required && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                    <input
                        id={inputId}
                        ref={ref}
                        className={cn(
                            "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-shadow",
                            error && "border-red-500 focus:ring-red-500",
                            className
                        )}
                        {...register}
                        {...props}
                    />
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

Input.displayName = "Input";
