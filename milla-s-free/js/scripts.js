import { initializeApp } from './app.js';
import { db } from './firebase-services.js';
import { showMessageModal, formatDuration, updateChart, toggleButtonLoading } from './ui-helpers.js';
import { Timer } from './timer.js';
import { getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, orderBy, limit, startAfter, endBefore, getDocs, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

setLogLevel('warn');

let userId;
let appId;
let pageQueryCursors = []; // Armazena o primeiro documento de cada página
let lastDocOnPage = null; // Armazena o último documento da página atual
const pageSize = 5;

let timer;
let currentPage = 1;
let allTasks = [];
let allProjects = {}; 
let selectedMemberId = 'all';
let membersMap = new Map();

let timerDisplay, startButton, stopButton, projectInput, timeEntriesTbody, statTotalHours, statActiveProjects, statTeamMembers, statPendingEntries,
    prevPageButton, nextPageButton, paginationControls, editModal, editEntryIdInput,
    editProjectInput, editDateInput, editHoursInput, editMinutesInput, editSecondsInput, saveEditButton, cancelEditButton, shareToggle, shareModal, appIdDisplay,
    copyAppIdButton, closeShareModalButton, menuToggleMain, messageModal, messageText, messageOkButton, messageCancelButton, forgotPasswordLink,
    forgotPasswordModal, forgotPasswordForm, forgotEmailInput, cancelForgotButton,
    taskSelectionModal, existingTasksList, newTaskInput, startTimerConfirmButton,
    cancelTaskSelectionButton, memberFilter;

function initUIElements() {
    timerDisplay = document.getElementById('timer-display');
    startButton = document.getElementById('start-button');
    stopButton = document.getElementById('stop-button');
    projectInput = document.getElementById('project-input');
    timeEntriesTbody = document.getElementById('time-entries-tbody');
    statTotalHours = document.getElementById('stat-total-hours');
    statActiveProjects = document.getElementById('stat-active-projects');
    statTeamMembers = document.getElementById('stat-team-members');
    statPendingEntries = document.getElementById('stat-pending-entries');
    prevPageButton = document.getElementById('prev-page-button');
    nextPageButton = document.getElementById('next-page-button');
    paginationControls = document.getElementById('pagination-controls');
    editModal = document.getElementById('edit-modal');
    editEntryIdInput = document.getElementById('edit-entry-id');
    editProjectInput = document.getElementById('edit-project-input');
    editDateInput = document.getElementById('edit-date-input');
    editHoursInput = document.getElementById('edit-hours');
    editMinutesInput = document.getElementById('edit-minutes');
    editSecondsInput = document.getElementById('edit-seconds');
    saveEditButton = document.getElementById('save-edit-button');
    cancelEditButton = document.getElementById('cancel-edit-button'); 
    shareToggle = document.getElementById('share-toggle');
    shareModal = document.getElementById('share-modal');
    appIdDisplay = document.getElementById('app-id-display');
    copyAppIdButton = document.getElementById('copy-app-id');
    closeShareModalButton = document.getElementById('close-share-modal');
    messageModal = document.getElementById('message-modal');
    messageText = document.getElementById('message-text');
    messageOkButton = document.getElementById('message-ok');
    messageCancelButton = document.getElementById('message-cancel');
    forgotPasswordLink = document.getElementById('forgot-password-link');
    forgotPasswordModal = document.getElementById('forgot-password-modal');
    forgotPasswordForm = document.getElementById('forgot-password-form');
    forgotEmailInput = document.getElementById('forgot-email');
    cancelForgotButton = document.getElementById('cancel-forgot-button');
    taskSelectionModal = document.getElementById('task-selection-modal');
    existingTasksList = document.getElementById('existing-tasks-list');
    newTaskInput = document.getElementById('new-task-input');
    startTimerConfirmButton = document.getElementById('start-timer-confirm-button');
    cancelTaskSelectionButton = document.getElementById('cancel-task-selection-button');
    memberFilter = document.getElementById('member-filter');
}

function initDashboardPage(user) {
    userId = user.uid;
    console.log("Painel de Controle inicializado para:", userId);
    document.getElementById('dashboard-content').classList.remove('hidden');

    initUIElements();

    // A lógica do timer foi removida do painel principal, então verificamos se os elementos existem.
    if (projectInput) projectInput.disabled = false;

    // CORREÇÃO: Garante que os membros sejam carregados ANTES das entradas de tempo.
    setupMembersListener().then(() => {
        fetchTimeEntriesPage('first');
    });
    setupRealtimeChart();
    setupTasksListener();

    // Inicializa o timer apenas se os elementos existirem na página
    if (timerDisplay && startButton && stopButton && projectInput) {
        timer = new Timer(timerDisplay, startButton, stopButton, projectInput, saveTimeEntry);
        startButton.addEventListener('click', handleStartTimer);
    }

    if (saveEditButton) saveEditButton.addEventListener('click', saveEditedEntry);
    if (cancelEditButton) cancelEditButton.addEventListener('click', () => editModal.classList.add('hidden'));
    
    if (timeEntriesTbody) {
        timeEntriesTbody.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const entryId = button.dataset.id;

            if (button.classList.contains('edit-button')) {
                openEditModal(entryId);
            } else if (button.classList.contains('delete-button')) {
                const confirmed = await showMessageModal("Tem certeza que deseja excluir esta entrada de tempo?", 'confirm');
                if (confirmed) {
                    deleteTimeEntry(entryId);
                }
            } else if (button.classList.contains('approve-button')) { 
                await updateDoc(doc(db, "timeEntries", entryId), { status: 'approved' }); // Atualiza o status no banco de dados
                // A tabela será atualizada automaticamente pelo onSnapshot. Não é necessária nenhuma ação extra.
            } else if (button.classList.contains('reject-button')) {
                const confirmed = await showMessageModal("Tem certeza que deseja rejeitar e excluir esta entrada de tempo?", 'confirm');
                if (confirmed) deleteTimeEntry(entryId);
            }
        });
    }

    if (memberFilter) {
        memberFilter.addEventListener('change', () => {
            selectedMemberId = memberFilter.value;
            fetchTimeEntriesPage('first');
        });
    }

    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            fetchTimeEntriesPage('first');
        });
    }

    if (shareToggle) shareToggle.addEventListener('click', () => shareModal.classList.remove('hidden'));
    if (closeShareModalButton) closeShareModalButton.addEventListener('click', () => shareModal.classList.add('hidden'));

    if (copyAppIdButton) {
        copyAppIdButton.addEventListener('click', async () => {
            const appIdText = appIdDisplay.textContent;
            try {
                await navigator.clipboard.writeText(appIdText);
                showMessageModal("ID do aplicativo copiado!");
            } catch (err) {
                console.error('Erro ao copiar ID: ', err);
                showMessageModal('Não foi possível copiar o ID.');
            }
        });
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            forgotPasswordModal.classList.remove('hidden');
        });
    }

    if (cancelForgotButton) cancelForgotButton.addEventListener('click', () => forgotPasswordModal.classList.add('hidden'));

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = forgotEmailInput.value;
            try {
                await sendPasswordResetEmail(auth, email);
                forgotPasswordModal.classList.add('hidden');
                showMessageModal("Um link para redefinição de senha foi enviado para o seu e-mail, caso ele esteja cadastrado.");
                forgotPasswordForm.reset();
            } catch (error) {
                console.error("Erro ao enviar e-mail de redefinição de senha:", error);
                showMessageModal("Se o e-mail estiver correto e cadastrado, um link de redefinição será enviado.");
            }
        });
    }    

    if (prevPageButton) {
        prevPageButton.addEventListener('click', () => {
            fetchTimeEntriesPage('prev');
        });
    }

    if (nextPageButton) {
        nextPageButton.addEventListener('click', () => {
            fetchTimeEntriesPage('next');
        });
    }
}

initializeApp(initDashboardPage, getAuth());

function handleStartTimer() {
    if (timer && timer.isRunning) {
        showMessageModal("O rastreador já está em andamento.");
        return;
    }
    const taskName = projectInput.value.trim();
    if (!taskName) {
        showMessageModal("Por favor, digite o nome da tarefa para iniciar.");
        return;
    }
    timer.start(taskName);
}

async function saveTimeEntry(projectName, duration) {
    if (!db || !userId) {
        console.error("Firestore ou userId não estão inicializados.");
        return;
    }
    const durationInSeconds = Math.floor(duration / 1000);
    try {
        await addDoc(collection(db, "timeEntries"), {
            projectName: projectName,
            duration: durationInSeconds,
            timestamp: new Date(),
            companyId: userId,
            memberId: null,
            status: 'approved'
        });
        console.log("Entrada de tempo salva com sucesso.");
        // Recarrega a tabela para exibir a nova entrada imediatamente.
        fetchTimeEntriesPage('first');
    } catch (e) {
        console.error("Erro ao adicionar documento: ", e);
        showMessageModal("Erro ao salvar a entrada de tempo. Tente novamente.");
    }
}

function renderTimeEntries(entries) {
    console.log("Rendering time entries. Entries received:", entries);
    timeEntriesTbody.innerHTML = '';
    if (entries.length === 0) {
        timeEntriesTbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-secondary">Nenhuma entrada de tempo encontrada.</td></tr>`;
        return;
    }
    entries.forEach(entry => {
        // CORREÇÃO: Busca o nome do membro a partir do objeto completo.
        const memberName = entry.memberId ? (membersMap.get(entry.memberId)?.name || 'Colaborador Desconhecido') : 'Empresa';
        const isPending = entry.status === 'pending';
        const statusInfo = {
            approved: { text: 'Aprovado', class: 'status-approved' },
            pending: { text: 'Pendente', class: 'status-pending' },
            rejected: { text: 'Rejeitado', class: 'status-rejected' }
        };
        const currentStatus = statusInfo[entry.status] || { text: entry.status, class: '' };

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.projectName}</td>
            <td>${memberName}</td>
            <td>${new Date(entry.timestamp.seconds * 1000).toLocaleDateString()}</td>
            <td>${formatDuration(entry.duration)}</td>
            <td><span class="status-badge ${currentStatus.class}">${currentStatus.text}</span></td>
            <td class="text-right">
                <div class="flex items-center justify-end gap-2">
                    ${isPending ? `
                        <button title="Aprovar" class="approve-button btn-icon" data-id="${entry.id}"><i class="fas fa-check-circle text-green-500"></i></button>
                        <button title="Rejeitar" class="reject-button btn-icon" data-id="${entry.id}"><i class="fas fa-times-circle text-red-500"></i></button>
                    ` : ''}
                    <button title="Editar" class="edit-button btn-icon" data-id="${entry.id}"><i class="fas fa-edit"></i></button>
                    <button title="Excluir" class="delete-button btn-icon" data-id="${entry.id}"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        timeEntriesTbody.appendChild(row);
    });
}

function renderCurrentPage(entries) {
    renderTimeEntries(entries);
    paginationControls.classList.remove('hidden');
    prevPageButton.disabled = currentPage === 1;
    nextPageButton.disabled = entries.length < pageSize;
}

async function fetchTimeEntriesPage(direction) {
    if (!db || !userId) return;

    console.log("Fetching time entries for userId:", userId);
    console.log("Current page:", currentPage, "Direction:", direction);
    console.log("Selected member filter:", selectedMemberId);

    let q;
    let baseQuery = [
        collection(db, 'timeEntries'),
        where("companyId", "==", userId),
        orderBy("timestamp", "desc")
    ];

    const statusFilterValue = document.getElementById('status-filter')?.value;
    if (statusFilterValue && statusFilterValue !== 'all') {
        baseQuery.push(where("status", "==", statusFilterValue));
    }

    // Adiciona filtro de membro se não for 'all'
    if (selectedMemberId !== 'all') {
        const memberFilterField = selectedMemberId === 'company' ? 'memberId' : 'memberId';
        const memberFilterValue = selectedMemberId === 'company' ? null : selectedMemberId;
        baseQuery.push(where(memberFilterField, "==", memberFilterValue));
    }

    if (direction === 'first') {
        currentPage = 1;
        pageQueryCursors = [null];
        q = query(...baseQuery, limit(pageSize));
    } else if (direction === 'next' && lastDocOnPage) {
        currentPage++;
        pageQueryCursors[currentPage - 1] = lastDocOnPage;
        q = query(...baseQuery, startAfter(lastDocOnPage), limit(pageSize));
    } else if (direction === 'prev' && currentPage > 1) {
        currentPage--;
        const prevPageCursor = pageQueryCursors[currentPage - 1];
        q = query(...baseQuery, startAfter(prevPageCursor), limit(pageSize)); // Inicia após o cursor da página anterior
    } else if (direction === 'current') {
        const currentPageCursor = pageQueryCursors[currentPage - 1];
        q = currentPageCursor ? query(...baseQuery, startAfter(currentPageCursor), limit(pageSize)) : query(...baseQuery, limit(pageSize));
    } else {
        // Se a direção for inválida ou não houver mais páginas, não faz nada.
        return;
    }

    try {
        console.log("Executing query with baseQuery:", baseQuery);
        const documentSnapshots = await getDocs(q);
        lastDocOnPage = documentSnapshots.docs[documentSnapshots.docs.length - 1];
        const entries = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCurrentPage(entries);
    } catch (error) {
        // Adiciona uma mensagem de erro mais visível na tabela
        console.error("Erro ao buscar entradas de tempo:", error);
        showMessageModal("Não foi possível carregar as entradas de tempo.");
        timeEntriesTbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-500">Erro ao carregar entradas de tempo. Verifique o console para detalhes.</td></tr>`;
    }
}

function populateMemberFilter(membersMap) {
    const currentFilterValue = memberFilter.value;
    memberFilter.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'Todos os Colaboradores';
    memberFilter.appendChild(allOption);

    const companyOption = document.createElement('option');
    companyOption.value = 'company';
    companyOption.textContent = 'Apenas Empresa';
    memberFilter.appendChild(companyOption);

    membersMap.forEach((memberData, id) => {
        const name = memberData.name;
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        memberFilter.appendChild(option);
    });
    memberFilter.value = currentFilterValue;
}

async function setupTimeEntriesListener() {
    // Esta função foi substituída por fetchTimeEntriesPage para implementar
    // a paginação no lado do servidor e melhorar drasticamente a performance.
    // A carga inicial agora é feita em initializeFirebase.
    // REATIVANDO PARA ATUALIZAÇÕES EM TEMPO REAL:
    const q = query(collection(db, 'timeEntries'), where('companyId', '==', userId));
    onSnapshot(q, () => fetchTimeEntriesPage('current'));
}

async function setupMembersListener() {
    if (!db || !userId) return Promise.resolve();

    return new Promise((resolve) => {
        const q = query(collection(db, 'members'), where('companyId', '==', userId));
        onSnapshot(q, (snapshot) => {
            const currentFilterValue = memberFilter.value;
            membersMap.clear();
            snapshot.forEach(doc => {
                // CORREÇÃO: Armazena o objeto completo do membro (nome e cor).
                membersMap.set(doc.id, doc.data());
            });
            if (statTeamMembers) statTeamMembers.textContent = snapshot.size;
            
            populateMemberFilter(membersMap);
            memberFilter.value = currentFilterValue;
            resolve(); // Resolve a Promise quando os membros forem carregados.
        });
    });
}

async function setupRealtimeChart() {
    if (!db || !userId) {
        console.error("Firestore não está pronto para o listener do gráfico.");
        return;
    }
    const q = query(
        collection(db, `timeEntries`),
        where("companyId", "==", userId)
    );

    onSnapshot(q, (snapshot) => {
        allProjects = {};
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        let totalHoursMonth = 0;
        let pendingCount = 0;
        const projectsInMonth = new Set();
        snapshot.forEach(doc => {
            const data = doc.data();
            const projectName = data.projectName;
            const duration = data.duration;

            if (allProjects[projectName]) {
                allProjects[projectName] += duration;
            } else {
                allProjects[projectName] = duration;
            }

            // Aggregate for stats
            if (data.status === 'pending') {
                pendingCount++;
            }
            const entryDate = new Date(data.timestamp.seconds * 1000);
            if (entryDate >= startOfMonth) {
                totalHoursMonth += duration;
                projectsInMonth.add(projectName);
            }
        });

        if (statTotalHours) statTotalHours.textContent = formatDuration(totalHoursMonth);
        if (statActiveProjects) statActiveProjects.textContent = projectsInMonth.size;
        if (statPendingEntries) statPendingEntries.textContent = pendingCount;

    }, (error) => {
        console.error("Erro no onSnapshot para o gráfico:", error);
    });
}

async function setupTasksListener() {
    if (!db || !userId) return;

    const q = query(collection(db, "tasks"), where("companyId", "==", userId), orderBy("name"));
    onSnapshot(q, (snapshot) => {
        const tasksDatalist = document.getElementById('tasks-datalist');
        allTasks = [];
        if (tasksDatalist) tasksDatalist.innerHTML = '';
        snapshot.forEach(doc => {
            const task = { id: doc.id, ...doc.data() };
            allTasks.push(task);
            if (tasksDatalist) {
                const option = document.createElement('option');
                option.value = task.name;
                tasksDatalist.appendChild(option);
            }
        });
    });
}

async function deleteTimeEntry(id) {
    if (!db || !userId) {
        showMessageModal("Erro de autenticação. Não foi possível excluir.");
        return;
    }
    try {
        await deleteDoc(doc(db, `timeEntries`, id));
        showMessageModal("Entrada de tempo excluída com sucesso.");
    } catch (error) {
        console.error("Erro ao excluir documento:", error);
        showMessageModal("Erro ao excluir a entrada. Tente novamente.");
    }
}
async function openEditModal(id) {
    if (!db || !userId) {
        return;
    }
    const docRef = doc(db, `timeEntries`, id);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const duration = data.duration;
            const date = new Date(data.timestamp.seconds * 1000);

            editEntryIdInput.value = id;
            editProjectInput.value = data.projectName;
            editDateInput.value = date.toISOString().split('T')[0];

            const hours = Math.floor(duration / 3600);
            const minutes = Math.floor((duration % 3600) / 60);
            const seconds = duration % 60;

            editHoursInput.value = hours;
            editMinutesInput.value = minutes;
            editSecondsInput.value = seconds;

            editModal.classList.remove('hidden');
        } else {
            showMessageModal("Documento não encontrado para edição.");
        }
    } catch (error) {
        console.error("Erro ao buscar documento para edição:", error);
        showMessageModal("Erro ao carregar dados para edição.");
    }
}

async function saveEditedEntry() {
    const id = editEntryIdInput.value;
    const projectName = editProjectInput.value.trim();
    const dateStr = editDateInput.value;

    if (!projectName || !dateStr) {
        showMessageModal("O nome do projeto e a data são obrigatórios.");
        return;
    }

    toggleButtonLoading(saveEditButton, true);

    try {
        if (!db || !userId) {
            showMessageModal("Erro de autenticação. Por favor, faça login novamente.");
            return; // O finally vai rodar e desativar o loading.
        }

        const hours = parseInt(editHoursInput.value) || 0;
        const minutes = parseInt(editMinutesInput.value) || 0;
        const seconds = parseInt(editSecondsInput.value) || 0;
        const totalDuration = hours * 3600 + minutes * 60 + seconds;

        // Analisa a string de data (YYYY-MM-DD) para criar um objeto Date
        // na meia-noite do fuso horário local do usuário, evitando problemas de fuso horário
        // que podem fazer a data pular para o dia anterior.
        const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
        const date = new Date(year, month - 1, day);

        const docRef = doc(db, `timeEntries`, id);
        await updateDoc(docRef, {
            projectName: projectName,
            duration: totalDuration,
            timestamp: date
        });
        showMessageModal("Entrada de tempo atualizada com sucesso.");
        editModal.classList.add('hidden');
        // A atualização automática já é tratada pelo onSnapshot.
    } catch (error) {
        console.error("Erro ao atualizar documento:", error);
        showMessageModal("Erro ao salvar a edição. Tente novamente.");
    } finally {
        toggleButtonLoading(saveEditButton, false);
    }
}