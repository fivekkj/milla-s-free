import { initializeApp } from './app.js';
import { db } from './firebase-services.js';
import { showMessageModal, formatDuration } from './ui-helpers.js';
import { collection, query, where, onSnapshot, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Chart instances
let hoursByProjectChart, hoursByMemberChart, hoursTrendChart;
let allTimeEntries = [];
let membersMap = new Map();
let userId;

// Paleta de cores para os gráficos
const CHART_COLOR_PALETTE = [
    '#8a5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
    '#6366f1', '#d946ef', '#06b6d4', '#84cc16', '#ec4899'
];

// --- CHART RENDERING FUNCTIONS ---

function renderHoursByProjectChart(data) {
    const ctx = document.getElementById('hours-by-project-chart').getContext('2d');
    if (hoursByProjectChart) hoursByProjectChart.destroy();

    hoursByProjectChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Horas',
                data: data.data,
                backgroundColor: data.colors,
                borderRadius: 5,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderHoursByMemberChart(data) {
    const ctx = document.getElementById('hours-by-member-chart').getContext('2d');
    if (hoursByMemberChart) hoursByMemberChart.destroy();

    hoursByMemberChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Horas por Membro',
                data: data.data,
                backgroundColor: data.colors,
                borderColor: document.documentElement.classList.contains('dark') ? '#2a223d' : '#ffffff',
                borderWidth: 4,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 15, padding: 20 } // A cor será herdada
                }
            }
        }
    });
}

function renderHoursTrendChart(data) {
    const ctx = document.getElementById('hours-trend-chart').getContext('2d');
    if (hoursTrendChart) hoursTrendChart.destroy();

    hoursTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: 'Horas Trabalhadas por Dia',
                data: Object.values(data).map(seconds => (seconds / 3600).toFixed(2)),
                fill: true,
                borderColor: '#8a5cf6',
                backgroundColor: 'rgba(138, 92, 246, 0.2)',
                tension: 0.4,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true },
                x: {}
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- DATA PROCESSING ---

function processDataForCharts(entries) {
    const projectDataRaw = {}; // Armazena { projectName: { totalDuration: X, memberContributions: { memberId1: Y, memberId2: Z } } }
    const memberData = {};
    const trendData = {};

    // Initialize last 30 days for trend chart
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        trendData[key] = 0;
    }

    entries.forEach(entry => {
        if (entry.status !== 'approved') return; // Processa apenas horas aprovadas

        // Project Data
        const projectName = entry.projectName;
        if (!projectDataRaw[projectName]) {
            projectDataRaw[projectName] = { totalDuration: 0, memberContributions: {} };
        }
        projectDataRaw[projectName].totalDuration += entry.duration;
        projectDataRaw[projectName].memberContributions[entry.memberId] = (projectDataRaw[projectName].memberContributions[entry.memberId] || 0) + entry.duration;

        // Member Data
        // CORREÇÃO: Agrupa as horas pelo ID único do membro, não pelo nome.
        memberData[entry.memberId] = (memberData[entry.memberId] || 0) + entry.duration;

        // Trend Data
        const entryDate = new Date(entry.timestamp.seconds * 1000);
        const key = entryDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (key in trendData) {
            trendData[key] += entry.duration;
        }
    });

    // Processa projectDataRaw para gerar labels, data e colors para o gráfico de projetos
    const projectLabels = Object.keys(projectDataRaw);
    const projectHoursData = projectLabels.map(name => (projectDataRaw[name].totalDuration / 3600).toFixed(2));
    const projectColors = projectLabels.map(name => {
        const contributions = projectDataRaw[name].memberContributions;
        let dominantMemberId = null;
        let maxDuration = 0;
        for (const memberId in contributions) {
            if (contributions[memberId] > maxDuration) {
                maxDuration = contributions[memberId];
                dominantMemberId = memberId;
            }
        }
        // Usa a cor do membro dominante, ou uma cor padrão se não houver
        return membersMap.get(dominantMemberId)?.color || '#cccccc';
    });

    const processedProjectData = {
        labels: projectLabels,
        data: projectHoursData,
        colors: projectColors
    };

    // Mapeia os dados de horas por membro para usar nomes e cores
    // CORREÇÃO: Itera sobre os IDs dos membros para buscar nome e cor de forma confiável.
    const memberLabels = Object.keys(memberData).map(id => membersMap.get(id)?.name || 'Desconhecido');
    const memberHoursData = Object.values(memberData).map(seconds => (seconds / 3600).toFixed(2));
    const memberColors = Object.keys(memberData).map(id => membersMap.get(id)?.color || '#cccccc');

    const processedMemberData = {
        labels: memberLabels,
        data: memberHoursData,
        colors: memberColors
    };

    renderHoursByProjectChart(processedProjectData);
    renderHoursByMemberChart(processedMemberData); // Passa os dados processados
    renderHoursTrendChart(trendData);
}

async function fetchData(startDate, endDate) {
    if (!db || !userId) return;

    let timeEntriesQuery = query(
        collection(db, "timeEntries"),
        where("companyId", "==", userId),
        orderBy("timestamp", "desc")
    );

    // Add date filters if they exist
    if (startDate) {
        timeEntriesQuery = query(timeEntriesQuery, where("timestamp", ">=", startDate));
    }
    if (endDate) {
        // Adjust end date to include the whole day
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        timeEntriesQuery = query(timeEntriesQuery, where("timestamp", "<=", endOfDay));
    }

    try {
        const snapshot = await getDocs(timeEntriesQuery);
        allTimeEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        processDataForCharts(allTimeEntries);
    } catch (error) {
        console.error("Erro ao buscar dados para relatórios:", error);
        showMessageModal("Não foi possível carregar os dados dos relatórios.");
    }
}

// --- INITIALIZATION ---

function initReportsPage(user) {
    userId = user.uid;
    console.log("Página de Relatórios inicializada para:", userId);

    // Date picker
    flatpickr("#date-range-picker", {
        mode: "range",
        dateFormat: "d/m/Y",
        locale: {
            firstDayOfWeek: 1,
            weekdays: {
              shorthand: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
              longhand: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
            },
            months: {
              shorthand: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
              longhand: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
            },
        },
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
                fetchData(selectedDates[0], selectedDates[1]);
            }
        }
    });

    // Busca os membros primeiro, depois inicializa os listeners
    const membersQuery = query(collection(db, "members"), where("companyId", "==", userId));
    getDocs(membersQuery).then(membersSnapshot => {
        membersSnapshot.forEach(doc => membersMap.set(doc.id, doc.data()));

        // Em seguida, busca os dados para os gráficos
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        fetchData(thirtyDaysAgo, new Date()); // Carrega os últimos 30 dias por padrão
    });

    // Recarrega os gráficos quando o tema muda
    document.getElementById('theme-toggle').addEventListener('click', () => processDataForCharts(allTimeEntries));
}

initializeApp(initReportsPage, db);