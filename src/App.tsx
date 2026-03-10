import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Settings as SettingsIcon, 
  TrendingUp, 
  Store, 
  CreditCard, 
  Download,
  AlertCircle,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';
import { Payment, STORES, METHODS } from './types';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'settings'>('dashboard');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(36.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Form State
  const [newPayment, setNewPayment] = useState<Partial<Payment>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    store: STORES[0],
    method: 'Dolares',
    currency: 'USD',
    amountOriginal: 0,
    rate: 36.5,
    reference: '',
    description: ''
  });

  // Filter State
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    store: 'Todas',
    method: 'Todos'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, settingsRes] = await Promise.all([
        fetch('/api/payments'),
        fetch('/api/settings')
      ]);
      
      if (!paymentsRes.ok || !settingsRes.ok) throw new Error('Error al cargar datos');
      
      const paymentsData = await paymentsRes.json();
      const settingsData = await settingsRes.json();
      
      setPayments(paymentsData);
      if (settingsData.ExchangeRate) {
        const rate = parseFloat(settingsData.ExchangeRate);
        setExchangeRate(rate);
        setNewPayment(prev => ({ ...prev, rate }));
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInitSheet = async () => {
    setIsInitializing(true);
    try {
      const res = await fetch('/api/init-sheet', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Estructura de Google Sheets creada correctamente.');
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountUsd = newPayment.currency === 'VES' 
      ? (newPayment.amountOriginal || 0) / (newPayment.rate || exchangeRate)
      : (newPayment.amountOriginal || 0);

    const paymentData = {
      ...newPayment,
      amountUsd: parseFloat(amountUsd.toFixed(2)),
      rate: newPayment.currency === 'VES' ? newPayment.rate : 1
    };

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });
      if (res.ok) {
        fetchData();
        setNewPayment({
          date: format(new Date(), 'yyyy-MM-dd'),
          store: STORES[0],
          method: 'Dolares',
          currency: 'USD',
          amountOriginal: 0,
          rate: exchangeRate,
          reference: '',
          description: ''
        });
      }
    } catch (err) {
      alert('Error al guardar el pago');
    }
  };

  const handleUpdateRate = async () => {
    try {
      const res = await fetch('/api/settings/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: exchangeRate })
      });
      if (res.ok) {
        alert('Tasa actualizada');
        fetchData();
      }
    } catch (err) {
      alert('Error al actualizar tasa');
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const dateMatch = isWithinInterval(parseISO(p.date), {
        start: parseISO(filters.startDate),
        end: parseISO(filters.endDate)
      });
      const storeMatch = filters.store === 'Todas' || p.store === filters.store;
      const methodMatch = filters.method === 'Todos' || p.method === filters.method;
      return dateMatch && storeMatch && methodMatch;
    });
  }, [payments, filters]);

  const stats = useMemo(() => {
    const totalUsd = filteredPayments.reduce((sum, p) => sum + p.amountUsd, 0);
    
    const methodMap = new Map();
    const storeMap = new Map();
    const trendMap = new Map();

    filteredPayments.forEach(p => {
      methodMap.set(p.method, (methodMap.get(p.method) || 0) + p.amountUsd);
      storeMap.set(p.store, (storeMap.get(p.store) || 0) + p.amountUsd);
      trendMap.set(p.date, (trendMap.get(p.date) || 0) + p.amountUsd);
    });

    return {
      totalUsd,
      byMethod: Array.from(methodMap).map(([name, value]) => ({ name, value })),
      byStore: Array.from(storeMap).map(([name, value]) => ({ name, value })),
      dailyTrend: Array.from(trendMap)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date))
    };
  }, [filteredPayments]);

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Reporte de Cobros - Red de Tiendas', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Periodo: ${filters.startDate} al ${filters.endDate}`, 14, 30);
    doc.text(`Tienda: ${filters.store}`, 14, 35);
    doc.text(`Método: ${filters.method}`, 14, 40);
    doc.text(`Total Recaudado: $${stats.totalUsd.toLocaleString()}`, 14, 45);

    autoTable(doc, {
      startY: 55,
      head: [['Fecha', 'Tienda', 'Método', 'Monto Orig.', 'Moneda', 'Monto USD', 'Ref.']],
      body: filteredPayments.map(p => [
        p.date,
        p.store,
        p.method,
        p.amountOriginal.toLocaleString(),
        p.currency,
        `$${p.amountUsd.toLocaleString()}`,
        p.reference
      ]),
    });

    doc.save(`reporte_cobros_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  if (loading && payments.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-slate-600 font-medium">Cargando datos financieros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-slate-200 font-sans flex flex-col md:flex-row">
      {/* Sidebar / Navigation */}
      <nav className="w-full md:w-72 bg-brand-sidebar border-t md:border-t-0 md:border-r border-white/5 px-4 py-6 flex flex-row md:flex-col justify-between md:justify-start gap-2 z-50 overflow-y-auto custom-scrollbar">
        <div className="hidden md:flex items-center gap-3 px-4 py-4 mb-8">
          <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
            <TrendingUp size={24} />
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-lg tracking-tight leading-tight">SistemCXC</h1>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Financial Control</span>
          </div>
        </div>

        <div className="flex flex-row md:flex-col gap-1 flex-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeTab === 'dashboard' ? 'bg-brand-primary text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
          >
            <LayoutDashboard size={20} className={activeTab === 'dashboard' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
            <span className="hidden md:inline text-sm font-semibold">Dashboard</span>
          </button>

          <button 
            onClick={() => setActiveTab('records')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeTab === 'records' ? 'bg-brand-primary text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
          >
            <PlusCircle size={20} className={activeTab === 'records' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
            <span className="hidden md:inline text-sm font-semibold">Registros</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeTab === 'settings' ? 'bg-brand-primary text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
          >
            <SettingsIcon size={20} className={activeTab === 'settings' ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
            <span className="hidden md:inline text-sm font-semibold">Configuración</span>
          </button>
        </div>

        <div className="hidden md:flex flex-col gap-4 mt-auto pt-6 border-t border-white/5">
          <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400">
              <TrendingUp size={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Rol Actual</span>
              <span className="text-xs font-bold">Administrador</span>
            </div>
          </div>
          <button className="flex items-center gap-3 px-4 py-2 text-red-400 hover:text-red-300 transition-colors text-sm font-bold">
            <RefreshCw size={18} className="rotate-45" />
            Cerrar Sesión
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto custom-scrollbar">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              {activeTab === 'dashboard' && 'Panel de Presidencia'}
              {activeTab === 'records' && 'Gestión de Cobros'}
              {activeTab === 'settings' && 'Configuración del Sistema'}
            </h2>
            <p className="text-slate-400 mt-1 font-medium">Indicadores financieros en tiempo real</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3 backdrop-blur-sm">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tasa BCV</span>
              <span className="font-mono font-bold text-brand-primary text-lg">{exchangeRate.toFixed(2)} <span className="text-xs text-slate-500">Bs/$</span></span>
            </div>
            <button 
              onClick={generatePDF}
              className="bg-brand-primary hover:bg-blue-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all font-bold shadow-lg shadow-blue-900/20 active:scale-95"
            >
              <Download size={20} />
              <span className="hidden sm:inline">Exportar PDF</span>
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Filters */}
              <div className="bg-brand-sidebar p-5 rounded-3xl border border-white/5 shadow-2xl flex flex-wrap gap-6 items-end backdrop-blur-md">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Desde</label>
                  <input 
                    type="date" 
                    value={filters.startDate}
                    onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="block w-full bg-white/5 border-white/10 rounded-xl text-sm text-white focus:ring-brand-primary focus:border-brand-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hasta</label>
                  <input 
                    type="date" 
                    value={filters.endDate}
                    onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="block w-full bg-white/5 border-white/10 rounded-xl text-sm text-white focus:ring-brand-primary focus:border-brand-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tienda</label>
                  <select 
                    value={filters.store}
                    onChange={e => setFilters(prev => ({ ...prev, store: e.target.value }))}
                    className="block w-full bg-white/5 border-white/10 rounded-xl text-sm text-white focus:ring-brand-primary focus:border-brand-primary transition-all"
                  >
                    <option className="bg-brand-sidebar">Todas</option>
                    {STORES.map(s => <option key={s} className="bg-brand-sidebar">{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Método</label>
                  <select 
                    value={filters.method}
                    onChange={e => setFilters(prev => ({ ...prev, method: e.target.value }))}
                    className="block w-full bg-white/5 border-white/10 rounded-xl text-sm text-white focus:ring-brand-primary focus:border-brand-primary transition-all"
                  >
                    <option className="bg-brand-sidebar">Todos</option>
                    {METHODS.map(m => <option key={m} className="bg-brand-sidebar">{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-brand-sidebar p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/10 transition-all"></div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                      <TrendingUp size={28} />
                    </div>
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full uppercase tracking-widest">+12% vs mes ant.</span>
                  </div>
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Total Recaudado (USD)</p>
                  <h3 className="text-4xl font-black text-white mt-2 tracking-tight">${stats.totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                </div>

                <div className="bg-brand-sidebar p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-brand-primary/10 transition-all"></div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-2xl">
                      <Store size={28} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tienda Líder</span>
                  </div>
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Tienda con mayor flujo</p>
                  <h3 className="text-3xl font-black text-white mt-2 tracking-tight">
                    {stats.byStore.length > 0 ? stats.byStore.sort((a,b) => b.value - a.value)[0].name : 'N/A'}
                  </h3>
                </div>

                <div className="bg-brand-sidebar p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-amber-500/10 transition-all"></div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl">
                      <CreditCard size={28} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Método Preferido</span>
                  </div>
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Forma de pago dominante</p>
                  <h3 className="text-3xl font-black text-white mt-2 tracking-tight">
                    {stats.byMethod.length > 0 ? stats.byMethod.sort((a,b) => b.value - a.value)[0].name : 'N/A'}
                  </h3>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-brand-sidebar p-8 rounded-3xl border border-white/5 shadow-2xl">
                  <h4 className="font-black text-white text-sm uppercase tracking-widest mb-8">Tendencia Diaria de Cobros</h4>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0a1128', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }}
                          itemStyle={{ color: '#fff', fontWeight: 700 }}
                          labelStyle={{ color: '#64748b', marginBottom: '4px', fontWeight: 800 }}
                        />
                        <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={4} dot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-brand-sidebar p-8 rounded-3xl border border-white/5 shadow-2xl">
                  <h4 className="font-black text-white text-sm uppercase tracking-widest mb-8">Distribución por Tienda</h4>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.byStore} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} width={120} />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                          contentStyle={{ backgroundColor: '#0a1128', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }}
                          itemStyle={{ color: '#fff', fontWeight: 700 }}
                          labelStyle={{ color: '#64748b', marginBottom: '4px', fontWeight: 800 }}
                        />
                        <Bar dataKey="value" fill="#2563eb" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-brand-sidebar p-8 rounded-3xl border border-white/5 shadow-2xl">
                  <h4 className="font-black text-white text-sm uppercase tracking-widest mb-8">Métodos de Pago</h4>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.byMethod}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {stats.byMethod.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0a1128', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }}
                          itemStyle={{ color: '#fff', fontWeight: 700 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-6 mt-6">
                    {stats.byMethod.map((m, i) => (
                      <div key={m.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-brand-sidebar p-8 rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="font-black text-white text-sm uppercase tracking-widest">Últimos Movimientos</h4>
                    <button onClick={() => setActiveTab('records')} className="text-brand-primary text-[10px] font-black uppercase tracking-widest hover:underline">Ver todos</button>
                  </div>
                  <div className="space-y-4">
                    {payments.slice(-5).reverse().map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-default">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-brand-bg rounded-xl flex items-center justify-center text-brand-primary border border-white/5">
                            <FileText size={24} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-white">{p.store}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{p.method} • {p.date}</p>
                          </div>
                        </div>
                        <p className="font-mono font-black text-white text-lg">${p.amountUsd.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'records' && (
            <motion.div 
              key="records"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-10"
            >
              {/* Form */}
              <div className="lg:col-span-1">
                <div className="bg-brand-sidebar p-8 rounded-3xl border border-white/5 shadow-2xl sticky top-10">
                  <h4 className="font-black text-white mb-8 flex items-center gap-3 text-lg tracking-tight">
                    <div className="w-8 h-8 bg-brand-primary/10 text-brand-primary rounded-lg flex items-center justify-center">
                      <PlusCircle size={20} />
                    </div>
                    Nuevo Registro
                  </h4>
                  <form onSubmit={handleAddPayment} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha</label>
                      <input 
                        type="date" 
                        required
                        value={newPayment.date}
                        onChange={e => setNewPayment(prev => ({ ...prev, date: e.target.value }))}
                        className="block w-full bg-white/5 border-white/10 rounded-xl text-sm text-white focus:ring-brand-primary focus:border-brand-primary transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tienda</label>
                      <select 
                        required
                        value={newPayment.store}
                        onChange={e => setNewPayment(prev => ({ ...prev, store: e.target.value }))}
                        className="block w-full bg-white/5 border-white/10 rounded-xl text-sm text-white focus:ring-brand-primary focus:border-brand-primary transition-all"
                      >
                        {STORES.map(s => <option key={s} className="bg-brand-sidebar">{s}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Método</label>
                        <select 
                          required
                          value={newPayment.method}
                          onChange={e => setNewPayment(prev => ({ ...prev, method: e.target.value as any }))}
                          className="block w-full bg-white/5 border-white/10 rounded-xl text-sm text-white focus:ring-brand-primary focus:border-brand-primary transition-all"
                        >
                          {METHODS.map(m => <option key={m} className="bg-brand-sidebar">{m}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Moneda</label>
                        <select 
                          required
                          value={newPayment.currency}
                          onChange={e => setNewPayment(prev => ({ ...prev, currency: e.target.value as any }))}
                          className="block w-full bg-white/5 border-white/10 rounded-xl text-sm text-white focus:ring-brand-primary focus:border-brand-primary transition-all"
                        >
                          <option value="USD" className="bg-brand-sidebar">Dólares ($)</option>
                          <option value="VES" className="bg-brand-sidebar">Bolívares (Bs)</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monto Original</label>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        value={newPayment.amountOriginal}
                        onChange={e => setNewPayment(prev => ({ ...prev, amountOriginal: parseFloat(e.target.value) }))}
                        className="block w-full bg-white/5 border-white/10 rounded-xl text-sm text-white focus:ring-brand-primary focus:border-brand-primary transition-all"
                        placeholder="0.00"
                      />
                    </div>
                    {newPayment.currency === 'VES' && (
                      <div className="space-y-2 p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/10">
                        <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest">Tasa de Cambio</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={newPayment.rate}
                          onChange={e => setNewPayment(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                          className="block w-full bg-white/5 border-white/10 rounded-xl text-sm text-white focus:ring-brand-primary focus:border-brand-primary transition-all mt-1"
                        />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Equivalente: <span className="text-white">${( (newPayment.amountOriginal || 0) / (newPayment.rate || exchangeRate) ).toFixed(2)} USD</span></p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Referencia / Comprobante</label>
                      <input 
                        type="text" 
                        value={newPayment.reference}
                        onChange={e => setNewPayment(prev => ({ ...prev, reference: e.target.value }))}
                        className="block w-full bg-white/5 border-white/10 rounded-xl text-sm text-white focus:ring-brand-primary focus:border-brand-primary transition-all"
                        placeholder="Nro. de operación"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción</label>
                      <textarea 
                        value={newPayment.description}
                        onChange={e => setNewPayment(prev => ({ ...prev, description: e.target.value }))}
                        className="block w-full bg-white/5 border-white/10 rounded-xl text-sm text-white focus:ring-brand-primary focus:border-brand-primary transition-all"
                        rows={2}
                        placeholder="Detalles del pago..."
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-brand-primary hover:bg-blue-600 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 mt-4"
                    >
                      Guardar Registro
                    </button>
                  </form>
                </div>
              </div>

              {/* Table */}
              <div className="lg:col-span-2">
                <div className="bg-brand-sidebar rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
                  <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <h4 className="font-black text-white text-lg tracking-tight">Historial de Cobros</h4>
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{payments.length} registros totales</div>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/2">
                          <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Fecha</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Tienda</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Método</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 text-right">Monto USD</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Ref.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {payments.slice().reverse().map((p, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors group">
                            <td className="px-8 py-5 text-sm font-bold text-slate-400 group-hover:text-white">{p.date}</td>
                            <td className="px-8 py-5 text-sm font-black text-white">{p.store}</td>
                            <td className="px-8 py-5">
                              <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border ${
                                p.method === 'Bolivares' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                p.method === 'Dolares' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                p.method === 'Zelle' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {p.method}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-sm font-mono font-black text-right text-white">${p.amountUsd.toFixed(2)}</td>
                            <td className="px-8 py-5 text-xs text-slate-500 font-mono truncate max-w-[100px]">{p.reference || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto space-y-10"
            >
              <div className="bg-brand-sidebar p-10 rounded-3xl border border-white/5 shadow-2xl">
                <h4 className="text-xl font-black text-white mb-8 flex items-center gap-3 tracking-tight">
                  <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center">
                    <RefreshCw size={24} />
                  </div>
                  Tasa de Cambio Diaria
                </h4>
                <p className="text-slate-400 mb-10 font-medium">Configure la tasa oficial del día para las conversiones automáticas de Bolívares a Dólares.</p>
                
                <div className="flex flex-col sm:flex-row items-end gap-6">
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Tasa Actual (Bs/$)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.01"
                        value={exchangeRate}
                        onChange={e => setExchangeRate(parseFloat(e.target.value))}
                        className="block w-full bg-white/5 border-white/10 rounded-2xl text-2xl font-black py-5 pl-8 pr-16 text-white focus:ring-brand-primary focus:border-brand-primary transition-all"
                      />
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 font-black text-lg">Bs</div>
                    </div>
                  </div>
                  <button 
                    onClick={handleUpdateRate}
                    className="w-full sm:w-auto bg-brand-primary hover:bg-blue-600 text-white font-black uppercase tracking-widest px-10 py-5 rounded-2xl shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                  >
                    Actualizar
                  </button>
                </div>
              </div>

              <div className="bg-brand-sidebar p-10 rounded-3xl border border-white/5 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <h4 className="text-xl font-black text-white mb-8 flex items-center gap-3 tracking-tight">
                  <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  Base de Datos (Google Sheets)
                </h4>
                <p className="text-slate-400 mb-10 font-medium">Si es la primera vez que usa la aplicación, debe inicializar la estructura de la hoja de cálculo.</p>
                
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 mb-10">
                  <div className="flex items-start gap-4">
                    <AlertCircle className="text-amber-500 shrink-0" size={24} />
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">ID de la Hoja:</p>
                      <p className="text-xs font-mono text-slate-300 break-all font-bold">1QGW3Y_jslEvVN6UbsCZ9b9dW7QI5ugvjGXjoUVufLjA</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleInitSheet}
                  disabled={isInitializing}
                  className="w-full bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest py-5 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 border border-white/10 active:scale-95"
                >
                  {isInitializing ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <CheckCircle2 size={20} className="text-emerald-400" />
                  )}
                  {isInitializing ? 'Inicializando...' : 'Inicializar Estructura de Sheets'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-red-500/10 border border-red-500/20 text-red-400 px-8 py-4 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-4">
          <AlertCircle size={24} />
          <span className="font-black uppercase tracking-widest text-[10px]">{error}</span>
          <button onClick={() => setError(null)} className="ml-6 text-red-400/50 hover:text-red-400 transition-colors">
            <RefreshCw size={18} className="rotate-45" />
          </button>
        </div>
      )}
    </div>
  );
}
