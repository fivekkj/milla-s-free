import { auth, db } from './firebase-services.js';
import { initThemeManager } from './theme-manager.js';
import { formatDuration, showMessageModal } from './ui-helpers.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, addDoc, collection, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let memberId, companyId;

// Lógica de timer interna para evitar conflitos
let timerInterval = null;
let timerIsRunning = false;
let timerStartTime = null;
let timerProjectName = '';
 
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

async function initProfilePage() {
    initThemeManager('theme-toggle');
    setupLogout();
    initProfileDropdown();
    await loadMemberDataFromToken();
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

async function loadMemberDataFromToken() {
    const token = localStorage.getItem('memberLoginToken');

    if (!token) {
        console.log("Nenhum token de login de colaborador encontrado. Redirecionando para a página inicial.");
        window.location.href = 'landing.html';
        return;
    }

    memberId = token; // O ID do membro é o próprio token.

    try {
        // Busca os dados do colaborador no Firestore usando o token como ID.
        const memberDocRef = doc(db, "members", memberId);
        const memberDocSnap = await getDoc(memberDocRef);

        if (memberDocSnap.exists()) {
            const memberData = memberDocSnap.data();
            companyId = memberData.companyId; // Pega o ID da empresa associada.

            // Atualiza o nome do colaborador na tela.
            const memberNameDisplay = document.getElementById('member-name-display');
            if (memberNameDisplay) {
                memberNameDisplay.textContent = memberData.name;
            }

            // Com os IDs em mãos, agora podemos carregar as outras informações.
            setupTimeEntriesListener();
            setupTasksListener();
            setupTimerControls();
        } else {
            // Se o token salvo for inválido ou o membro tiver sido excluído.
            console.error("Token inválido. O documento do membro não foi encontrado no Firestore.");
            localStorage.removeItem('memberLoginToken'); // Limpa o token inválido
            window.location.href = 'landing.html';
        }
    } catch (error) {
        console.error("Erro ao carregar dados do colaborador:", error);
        showMessageModal("Ocorreu um erro ao carregar seus dados.");
        localStorage.removeItem('memberLoginToken');
        window.location.href = 'landing.html';
    }
}

function setupTimerControls() {
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const projectInput = document.getElementById('project-input');
    const timerDisplay = document.getElementById('timer-display');

    if (!startButton || !stopButton || !projectInput || !timerDisplay) return;

    const updateTimerDisplay = () => {
        if (!timerIsRunning) return;
        const elapsedTime = Date.now() - timerStartTime;
        timerDisplay.textContent = formatDuration(Math.floor(elapsedTime / 1000));
    };

    const startTimer = (taskName) => {
        if (timerIsRunning) return;
        timerIsRunning = true;
        timerStartTime = Date.now();
        timerProjectName = taskName;
        projectInput.value = taskName;
        projectInput.readOnly = true;

        timerInterval = setInterval(updateTimerDisplay, 1000);
        startButton.classList.add('timer-active');
        stopButton.disabled = false;
        startButton.disabled = true;
    };

    const stopTimer = async () => {
        if (!timerIsRunning) return;
        clearInterval(timerInterval);
        if (!timerProjectName) {
            console.error("O nome do projeto está vazio. A entrada de tempo não será salva.");
            showMessageModal("Ocorreu um erro: o nome do projeto estava vazio. A entrada de tempo não foi salva.");
            // Resetar o timer sem salvar
        }

        const duration = Date.now() - timerStartTime;
        await saveTimeEntry(timerProjectName, duration);

        // Reset state
        timerIsRunning = false;
        timerStartTime = null;
        timerDisplay.textContent = "00:00:00";
        startButton.classList.remove('timer-active');
        startButton.disabled = false;
        stopButton.disabled = true;
        projectInput.value = '';
        projectInput.readOnly = false;
    };

    startButton.addEventListener('click', () => {
        const taskName = projectInput.value.trim();
        if (!taskName) {
            showMessageModal("Por favor, digite o nome da tarefa para iniciar.");
            return;
        }
        startTimer(taskName);
    });

    stopButton.addEventListener('click', stopTimer);
}

async function saveTimeEntry(projectName, duration) {
    if (!db || !memberId || !companyId) {
        console.error("Dados de autenticação incompletos para salvar entrada de tempo.");
        return;
    }
    const durationInSeconds = Math.floor(duration / 1000);
    try {
        await addDoc(collection(db, "timeEntries"), {
            projectName: projectName,
            duration: durationInSeconds,
            timestamp: new Date(),
            companyId: companyId,
            memberId: memberId,
            status: 'pending' // Entradas de colaboradores sempre começam como pendentes
        });
        console.log("Entrada de tempo enviada para aprovação.");
    } catch (e) {
        console.error("Erro ao adicionar documento: ", e);
    }
}

function setupTimeEntriesListener() {
    const timeEntriesTbody = document.getElementById('time-entries-tbody');
    const q = query(collection(db, "timeEntries"), where("memberId", "==", memberId), orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        timeEntriesTbody.innerHTML = '';
        if (snapshot.empty) {
            timeEntriesTbody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-secondary">Nenhuma hora registrada ainda.</td></tr>`;
            return;
        }
        snapshot.forEach(doc => {
            const entry = doc.data();
            const statusInfo = {
                approved: { text: 'Aprovado', class: 'status-approved' },
                pending: { text: 'Pendente', class: 'status-pending' },
                rejected: { text: 'Rejeitado', class: 'status-rejected' }
            };
            const currentStatus = statusInfo[entry.status] || { text: entry.status, class: '' };

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${entry.projectName}</td>
                <td>${new Date(entry.timestamp.seconds * 1000).toLocaleDateString()}</td>
                <td>${formatDuration(entry.duration)}</td>
                <td><span class="status-badge ${currentStatus.class}">${currentStatus.text}</span></td>
            `;
            timeEntriesTbody.appendChild(row);
        });
    });
}

function setupTasksListener() {
    if (!db || !companyId) return;

    const q = query(collection(db, "tasks"), where("companyId", "==", companyId), orderBy("name"));
    onSnapshot(q, (snapshot) => {
        const tasksDatalist = document.getElementById('tasks-datalist');
        if (tasksDatalist) tasksDatalist.innerHTML = '';
        snapshot.forEach(doc => {
            const task = doc.data();
            if (tasksDatalist) {
                const option = document.createElement('option');
                option.value = task.name;
                tasksDatalist.appendChild(option);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', initProfilePage);