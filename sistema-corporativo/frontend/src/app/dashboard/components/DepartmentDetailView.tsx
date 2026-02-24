import React, { useState, useMemo, useEffect } from 'react';
import {
    ArrowLeft, Clock, AlertTriangle, FileText, Tag, ChevronDown, CheckCircle
} from 'lucide-react';
import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
    AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar
} from 'recharts';
import { Document } from '../types';
import { Ticket } from '../../../components/TicketSystem';
import { FilterBar } from './FilterBar';
import { DetailTable } from './DetailTable';
import {
    filterByDateRange,
    filterByDepartment,
    groupByDate,
    calculateImportanceDistribution,
    combineDocumentsAndTickets,
    sortTableData,
    getLastNDays,
    getLastNMonths,
    SortField,
    SortDirection
} from '../utils/departmentUtils';

interface DepartmentDetailViewProps {
    departmentName: string;
    allDepartments: string[];
    documents: Document[];
    tickets: Ticket[];
    darkMode: boolean;
    onBack: () => void;
    onDepartmentChange: (dept: string) => void;
}

export const DepartmentDetailView: React.FC<DepartmentDetailViewProps> = ({
    departmentName,
    allDepartments,
    documents,
    tickets,
    darkMode,
    onBack,
    onDepartmentChange
}) => {
    // Estados de Filtros
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<{ start: Date; end: Date } | null>(null);

    // Estado de Tabla
    const [sortField, setSortField] = useState<SortField>('fechaHora');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Estado de Carga
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0); // Para simular carga progresiva

    // Opciones de fecha (últimos 12 meses)
    const monthOptions = useMemo(() => getLastNMonths(12), []);

    // Efecto de carga simulada al cambiar filtros
    useEffect(() => {
        setIsLoading(true);
        setLoadingStep(0);

        const t1 = setTimeout(() => setLoadingStep(1), 300);
        const t2 = setTimeout(() => setIsLoading(false), 800);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [departmentName, selectedDate, selectedMonth]);

    // Lógica de Filtrado y Procesamiento
    const processedData = useMemo(() => {
        // 1. Filtrar por departamento (siempre activo en esta vista)
        const deptFiltered = filterByDepartment(documents, tickets, departmentName);

        // 2. Filtrar por fecha
        const dateFiltered = filterByDateRange(
            deptFiltered.documents,
            deptFiltered.tickets,
            selectedDate ? selectedDate : (selectedMonth ? selectedMonth.start : null),
            selectedDate ? selectedDate : (selectedMonth ? selectedMonth.end : null)
        );

        // 3. Generar datos para gráficos
        const importanceData = calculateImportanceDistribution(dateFiltered.documents, dateFiltered.tickets);
        const temporalData = groupByDate(dateFiltered.documents, dateFiltered.tickets);

        // 4. Generar y ordenar datos de tabla
        const rawTableData = combineDocumentsAndTickets(dateFiltered.documents, dateFiltered.tickets);
        const tableData = sortTableData(rawTableData, sortField, sortDirection);

        return {
            documents: dateFiltered.documents,
            tickets: dateFiltered.tickets,
            importanceData,
            temporalData,
            tableData,
            totalItems: rawTableData.length
        };
    }, [documents, tickets, departmentName, selectedDate, selectedMonth, sortField, sortDirection]);

    // Manejadores
    const handleSort = (field: SortField) => {
        if (field === sortField) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    return (
        <div className={`space-y-6 animate-in slide-in-from-right duration-500`}>
            {/* Header de Navegación */}
            <div className="flex items-center gap-4 border-b border-slate-200/20 pb-4">
                <button
                    onClick={onBack}
                    className={`p-2 rounded-full transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
                        }`}
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        {departmentName}
                    </h2>
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Vista detallada de operaciones y gestión
                    </p>
                </div>
            </div>

            {/* Barra de Filtros */}
            <FilterBar
                darkMode={darkMode}
                departments={allDepartments}
                selectedDept={departmentName}
                onDeptChange={onDepartmentChange}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                months={monthOptions}
            />

            {/* Seccion de Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* KPI Summary (Opcional - Small Cards) */}
                { }

                {/* Gráfico 1: Importancia */}
                <div className={`p-6 rounded-lg border lg:col-span-1 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                    <h3 className={`font-bold mb-6 text-center ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        DISTRIBUCIÓN POR IMPORTANCIA
                    </h3>
                    <div className="h-64">
                        {isLoading && loadingStep < 1 ? (
                            <div className="h-full w-full flex items-center justify-center animate-pulse">
                                <div className={`w-32 h-32 rounded-full border-4 border-t-transparent ${darkMode ? 'border-slate-700' : 'border-slate-200'}`} />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={processedData.importanceData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {processedData.importanceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: darkMode ? '#0f172a' : '#fff',
                                            borderColor: darkMode ? '#1e293b' : '#e2e8f0',
                                            color: darkMode ? '#f1f5f9' : '#1e293b'
                                        }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Gráfico 2: Volumen Temporal */}
                <div className={`p-6 rounded-lg border lg:col-span-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}>
                    <h3 className={`font-bold mb-6 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        VOLUMEN DE ACTIVIDAD (TIEMPO)
                    </h3>
                    <div className="h-64">
                        {isLoading && loadingStep < 1 ? (
                            <div className="h-full w-full flex items-end gap-2 px-8 py-4 animate-pulse">
                                {[...Array(10)].map((_, i) => (
                                    <div key={i} className={`flex-1 rounded-t ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`} style={{ height: `${Math.random() * 80 + 20}%` }} />
                                ))}
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={processedData.temporalData}>
                                    <defs>
                                        <linearGradient id="colorDocs" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#e2e8f0'} />
                                    <XAxis
                                        dataKey="date"
                                        stroke={darkMode ? '#94a3b8' : '#64748b'}
                                        fontSize={10}
                                        tickFormatter={(val) => val.split('/')[0]} // Mostrar solo día
                                    />
                                    <YAxis stroke={darkMode ? '#94a3b8' : '#64748b'} fontSize={10} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: darkMode ? '#0f172a' : '#fff',
                                            borderColor: darkMode ? '#1e293b' : '#e2e8f0',
                                            color: darkMode ? '#f1f5f9' : '#1e293b'
                                        }}
                                    />
                                    <Legend />
                                    <Area type="monotone" dataKey="documentos" name="Documentos" stroke="#3b82f6" fillOpacity={1} fill="url(#colorDocs)" />
                                    <Area type="monotone" dataKey="tickets" name="Tickets" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorTickets)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabla Detallada */}
            <div>
                <h3 className={`font-bold text-lg mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    Registro Detallado
                </h3>
                <DetailTable
                    data={processedData.tableData}
                    darkMode={darkMode}
                    isLoading={isLoading}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                />
            </div>
        </div>
    );
};
