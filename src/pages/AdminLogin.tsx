import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Lock, AlertCircle } from 'lucide-react';

export const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            if (data.session) {
                navigate('/admin/dashboard');
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError('Credenciales inválidas. Por favor intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 animate-fade-in">
            <div className="max-w-md w-full glass p-8 rounded-3xl space-y-8">
                <div>
                    <div className="mx-auto h-12 w-12 bg-brand-100 rounded-full flex items-center justify-center">
                        <Lock className="h-6 w-6 text-brand-600" />
                    </div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
                        Acceso Administrativo
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-600">
                        Ingresa con tu cuenta para gestionar el evento.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-center">
                            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <Input
                            label="Correo Electrónico"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@ejemplo.com"
                        />
                        <Input
                            label="Contraseña"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>

                    <div>
                        <Button
                            type="submit"
                            className="w-full h-12 text-lg rounded-xl"
                            isLoading={loading}
                        >
                            Iniciar Sesión
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
