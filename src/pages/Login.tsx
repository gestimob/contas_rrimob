import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [logoClicks, setLogoClicks] = useState(0)
  const [showSecretForm, setShowSecretForm] = useState(false)
  const [secretSuccess, setSecretSuccess] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    setError('')
    const { error } = await signIn(data.email, data.password)
    if (error) {
      setError('Email ou senha inválidos')
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  const handleLogoClick = () => {
    const newClicks = logoClicks + 1
    if (newClicks === 5) {
      setShowSecretForm(prev => !prev)
      setLogoClicks(0)
      setError('')
    } else {
      setLogoClicks(newClicks)
    }
  }

  const onSecretSubmit = async (data: LoginForm) => {
    setLoading(true)
    setError('')
    
    const { data: canRegister, error: rpcError } = await supabase.rpc('check_and_increment_easter_egg')
    
    if (rpcError || !canRegister) {
      setError('Limite de registros especiais atingido ou erro no sistema.')
      setLoading(false)
      return
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
    } else {
      setSecretSuccess(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-700/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 md:p-10">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img
              src="https://cjmodlwqyhjalmydgwdd.supabase.co/storage/v1/object/public/anexos/logo_contas.png"
              alt="Logo"
              className="h-24 w-auto object-contain drop-shadow-lg cursor-pointer transition-transform active:scale-95"
              onClick={handleLogoClick}
            />
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            {showSecretForm ? 'Registro Especial' : 'Contas a Pagar'}
          </h1>
          <p className="text-gray-400 text-center mb-8 text-sm">
            {secretSuccess 
              ? 'Usuário criado com sucesso! Faça login abaixo.' 
              : showSecretForm 
                ? 'Crie uma conta com acesso total (Limite de 4 usos)' 
                : 'Faça login para continuar'}
          </p>

          <form onSubmit={handleSubmit(showSecretForm && !secretSuccess ? onSecretSubmit : onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                {...register('email')}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                placeholder="seu@email.com"
              />
              {errors.email && (
                <p className="text-danger-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Senha
              </label>
              <input
                type="password"
                {...register('password')}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-danger-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="bg-danger-500/10 border border-danger-500/20 rounded-xl p-3 text-center">
                <p className="text-danger-500 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 ${showSecretForm && !secretSuccess ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary-600 hover:bg-primary-700'} disabled:opacity-50 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-primary-600/25 hover:shadow-primary-600/40`}
            >
              {loading ? (showSecretForm ? 'Registrando...' : 'Entrando...') : (showSecretForm && !secretSuccess ? 'Criar Acesso Total' : 'Entrar')}
            </button>
            
            {showSecretForm && (
              <button 
                type="button"
                onClick={() => { setShowSecretForm(false); setSecretSuccess(false); setError(''); }}
                className="w-full text-xs text-gray-500 hover:text-gray-300 mt-4 underline"
              >
                Voltar para Login
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
