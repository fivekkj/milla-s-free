import { db } from './firebase-services.js';
import { initThemeManager } from './theme-manager.js';
import { collection, query, where, onSnapshot, getDoc, doc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

let memberId;
let hoursChart = null;

const CHART_COLORS = [
    '#8a5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
    '#6366f1', '#d946ef', '#06b6d4', '#84cc16', '#ec4899'
];

function processChartData(docs) {
    const hoursByProject = {};

    docs.forEach(doc => {
        const entry = doc.data();
        // Considera apenas as horas aprovadas para o relatório
        if (entry.status === 'approved') {
            const projectName = entry.projectName || 'Não especificado';
            const hours = (entry.duration || 0) / 3600; // Converte segundos para horas

            if (hoursByProject[projectName]) {
                hoursByProject[projectName] += hours;
            } else {
                hoursByProject[projectName] = hours;
            }
        }
    });

    const labels = Object.keys(hoursByProject);
    const data = Object.values(hoursByProject);

    return { labels, data };
}

function renderChart(chartData) {
    const ctx = document.getElementById('member-hours-chart').getContext('2d');
    const noDataMessage = document.getElementById('no-data-message');

    if (chartData.labels.length === 0) {
        noDataMessage.classList.remove('hidden');
        if (hoursChart) hoursChart.destroy();
        return;
    }

    noDataMessage.classList.add('hidden');

    if (hoursChart) {
        hoursChart.data.labels = chartData.labels;
        hoursChart.data.datasets[0].data = chartData.data;
        hoursChart.update();
    } else {
        hoursChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Horas por Projeto',
                    data: chartData.data,
                    backgroundColor: CHART_COLORS,
                    borderColor: document.documentElement.classList.contains('dark') ? '#2a223d' : '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: document.documentElement.classList.contains('dark') ? '#c5c5c5' : '#6b7280'
                        }
                    }
                }
            }
        });
    }
}

function setupReportsListener() {
    if (!db || !memberId) return;

    const q = query(collection(db, "timeEntries"), where("memberId", "==", memberId));

    onSnapshot(q, (snapshot) => {
        const chartData = processChartData(snapshot.docs);
        renderChart(chartData);
    }, (error) => {
        console.error("Erro ao buscar relatórios:", error);
        document.getElementById('chart-container').innerHTML = `<p class="text-red-500">Erro ao carregar seus dados.</p>`;
    });
}

function initProfileDropdown() {
    const profileToggle = document.getElementById('profile-toggle');
    const profileModal = document.getElementById('profile-modal');

    if (profileToggle && profileModal) {
        profileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            profileModal.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!profileModal.classList.contains('hidden') && !profileModal.contains(e.target) && !profileToggle.contains(e.target)) {
                profileModal.classList.add('hidden');
            }
        });
    }
}

async function initMemberReportsPage() {
    initThemeManager('theme-toggle');
    initProfileDropdown();
    setupLogout();

    const token = localStorage.getItem('memberLoginToken');
    if (!token) {
        console.log("Nenhum token de login encontrado. Redirecionando...");
        window.location.href = 'landing.html';
        return;
    }

    memberId = token; // O ID do membro é o próprio token.

    try {
        const memberDocRef = doc(db, "members", memberId);
        const memberDocSnap = await getDoc(memberDocRef);

        if (memberDocSnap.exists()) {
            const memberData = memberDocSnap.data();
            const memberNameDisplay = document.getElementById('member-name-display');
            if (memberNameDisplay) memberNameDisplay.textContent = memberData.name;

            document.getElementById('dashboard-content').classList.remove('hidden');
            await setupReportsListener();
        }
    } catch (error) {
        console.error("Erro ao carregar dados para relatórios:", error);
    }
}

function setupLogout() {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('memberLoginToken');
            window.location.href = 'landing.html';
        });
    }
}

document.addEventListener('DOMContentLoaded', initMemberReportsPage);