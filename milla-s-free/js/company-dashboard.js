import { initializeApp } from './app.js';
import { db, auth, functions } from './firebase-services.js';
import { showMessageModal, toggleButtonLoading } from './ui-helpers.js';
import { collection, query, where, onSnapshot, doc, deleteDoc, setLogLevel, updateDoc, orderBy, addDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js';

setLogLevel('warn');

let userId;
let allMembers = [];
let allTasks = [];
let membersCurrentPage = 1;
const membersPageSize = 5;
 
let companyEmailDisplay, addMemberButton, membersList, createMemberModal, createMemberForm, cancelCreateMemberButton, 
    showTokenModal, showTokenValue, copyTokenButton, closeTokenModalButton,
    editMemberModal, editMemberForm, cancelEditMemberButton, saveEditMemberButton, editMemberIdInput, editMemberNameInput,
    editMemberEmailInput, searchMemberInput, membersPaginationControls, prevMembersPageButton, nextMembersPageButton,
    addTaskForm, newTaskNameInput, tasksList, editTaskModal, editTaskForm, cancelEditTaskButton, saveEditTaskButton,
    editTaskIdInput, editTaskNameInput;
 
function initUIElements() {
    companyEmailDisplay = document.getElementById('company-email-display');
    addMemberButton = document.getElementById('add-member-button');
    membersList = document.getElementById('members-list');
    createMemberModal = document.getElementById('create-member-modal');
    createMemberForm = document.getElementById('create-member-form');
    cancelCreateMemberButton = document.getElementById('cancel-create-member-button');
    showTokenModal = document.getElementById('show-token-modal');
    showTokenValue = document.getElementById('show-token-value');
    copyTokenButton = document.getElementById('copy-token-button');
    closeTokenModalButton = document.getElementById('close-token-modal-button');
    editMemberModal = document.getElementById('edit-member-modal');
    editMemberForm = document.getElementById('edit-member-form');
    cancelEditMemberButton = document.getElementById('cancel-edit-member-button');
    saveEditMemberButton = document.getElementById('save-edit-member-button');
    editMemberIdInput = document.getElementById('edit-member-id');
    editMemberNameInput = document.getElementById('edit-member-name');
    editMemberEmailInput = document.getElementById('edit-member-email');
    searchMemberInput = document.getElementById('search-member-input');
    membersPaginationControls = document.getElementById('members-pagination-controls');
    prevMembersPageButton = document.getElementById('prev-members-page-button');
    nextMembersPageButton = document.getElementById('next-members-page-button');
    addTaskForm = document.getElementById('add-task-form');
    newTaskNameInput = document.getElementById('new-task-name');
    tasksList = document.getElementById('tasks-list');
    editTaskModal = document.getElementById('edit-task-modal');
    editTaskForm = document.getElementById('edit-task-form');
    cancelEditTaskButton = document.getElementById('cancel-edit-task-button');
    saveEditTaskButton = document.getElementById('save-edit-task-button');
    editTaskIdInput = document.getElementById('edit-task-id');
    editTaskNameInput = document.getElementById('edit-task-name');
}

function createTaskHTML(task) {
    // Função auxiliar para escapar HTML e prevenir XSS.
    const sanitize = (str) => {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    };

    return `
        <div class="task-item">
            <span class="font-semibold">${sanitize(task.name)}</span>
            <div class="flex items-center gap-2">
                <button title="Editar Tarefa" class="edit-task-button btn-icon" data-id="${task.id}" data-name="${sanitize(task.name)}">
                    <i class="fas fa-edit"></i>
                </button>
                <button title="Excluir Tarefa" class="delete-task-button btn-icon" data-id="${task.id}" data-name="${sanitize(task.name)}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

function createMemberHTML(member) {
    const sanitize = (str) => {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    };

    return `
        <tr>
            <td>
                <p class="font-semibold">${sanitize(member.name)}</p>
                <p class="text-sm text-secondary">${sanitize(member.email)}</p>
            </td>
            <td class="text-right">
                <div class="flex items-center justify-end gap-2">
                    <button title="Ver Token de Acesso" class="view-token-button btn-icon" data-id="${member.id}">
                        <i class="fas fa-key"></i>
                    </button>
                    <button title="Editar Colaborador" class="edit-member-button btn-icon" data-id="${member.id}" data-name="${sanitize(member.name)}" data-email="${sanitize(member.email)}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button title="Excluir Colaborador" class="delete-member-button btn-icon" data-id="${member.id}" data-name="${sanitize(member.name || 'este colaborador')}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function renderMembers() {
    const searchTerm = searchMemberInput.value.toLowerCase();
    const filteredMembers = allMembers.filter(member =>
        member.name.toLowerCase().includes(searchTerm) ||
        member.email.toLowerCase().includes(searchTerm)
    );

    membersList.innerHTML = '';

    const setPlaceholder = (message) => {
        membersList.innerHTML = `<tr><td colspan="2" class="text-center text-secondary p-4 text-sm">${message}</td></tr>`;
    }

    if (filteredMembers.length === 0) {
        const message = searchTerm ? `Nenhum colaborador encontrado para "${searchTerm}".` : 'Adicione seu primeiro colaborador para começar!';
        setPlaceholder(message);
        membersPaginationControls.classList.add('hidden');
        return;
    }
    
    const totalPages = Math.ceil(filteredMembers.length / membersPageSize);
    if (membersCurrentPage > totalPages) {
        membersCurrentPage = totalPages;
    }
    if (membersCurrentPage < 1) {
        membersCurrentPage = 1;
    }

    const startIndex = (membersCurrentPage - 1) * membersPageSize;
    const pageMembers = filteredMembers.slice(startIndex, startIndex + membersPageSize);

    membersList.innerHTML = pageMembers.map(createMemberHTML).join('');

    membersPaginationControls.classList.toggle('hidden', filteredMembers.length <= membersPageSize);
    prevMembersPageButton.disabled = membersCurrentPage === 1;
    nextMembersPageButton.disabled = membersCurrentPage >= totalPages;
}

function setupMembersListener() {
    if (!db || !userId) {
        return;
    }

    // Show skeleton
    const skeletonHTML = Array(membersPageSize).fill(`
        <tr class="skeleton-row">
            <td colspan="2" class="p-0">
                <div class="flex items-center justify-between p-2">
                    <div class="space-y-2"><div class="skeleton skeleton-text w-32"></div><div class="skeleton skeleton-text-sm w-48"></div></div>
                    <div class="skeleton skeleton-text w-24 h-8"></div>
                </div>
            </td>
        </tr>`).join('');
    membersList.innerHTML = skeletonHTML;

    const q = query(collection(db, "members"), where("companyId", "==", userId));

    onSnapshot(q, (snapshot) => {
        console.log(`Snapshot recebido, encontrados ${snapshot.size} documentos.`);
        allMembers = []; // Clear the array before repopulating
        snapshot.forEach(doc => {
            allMembers.push({ id: doc.id, ...doc.data() });
        });
        allMembers.sort((a, b) => a.name.localeCompare(b.name));
        renderMembers();
    }, (error) => {
        console.error("Erro ao buscar colaboradores:", error);
        membersList.innerHTML = `<tr><td colspan="2" class="text-center text-red-500 p-4">Não foi possível carregar os colaboradores.</td></tr>`; // Hide skeleton on error
        showMessageModal("Ocorreu um erro ao buscar os colaboradores. Verifique se as regras de segurança do Firestore permitem a leitura da coleção 'members'.");
    });
}

function setupTasksListener() {
    if (!db || !userId) return;

    const q = query(collection(db, "tasks"), where("companyId", "==", userId), orderBy("name"));

    onSnapshot(q, (snapshot) => {
        console.log(`[setupTasksListener] Snapshot recebido para tarefas. Total: ${snapshot.size} tarefas.`);
        allTasks = []; // Clear the array before repopulating
        snapshot.forEach(doc => {
            allTasks.push({ id: doc.id, ...doc.data() });
        });

        if (snapshot.empty) {
            const p = document.createElement('p');
            p.className = 'text-center text-secondary text-sm col-span-full';
            p.textContent = 'Nenhuma tarefa pré-definida.';
            tasksList.innerHTML = '';
            tasksList.appendChild(p);
            return;
        }

        tasksList.innerHTML = allTasks.map(createTaskHTML).join('');

    }, (error) => {
        console.error("Erro ao buscar tarefas:", error);
        tasksList.innerHTML = '<p class="text-center text-red-500 text-sm col-span-full">Erro ao carregar tarefas.</p>';
    });
}

function initCompanyDashboardPage(user) {
    userId = user.uid;
    console.log("Dashboard da Empresa inicializado para:", userId);

    initUIElements();
    setupMembersListener();
    setupTasksListener();

    if (addMemberButton) addMemberButton.addEventListener('click', () => createMemberModal.classList.remove('hidden'));
    if (cancelCreateMemberButton) cancelCreateMemberButton.addEventListener('click', () => createMemberModal.classList.add('hidden'));

    // Fecha o modal de criação ao clicar no backdrop
    if (createMemberModal) {
        createMemberModal.addEventListener('click', (e) => {
            if (e.target.id === 'create-member-modal') {
                createMemberModal.classList.add('hidden');
            }
        });
    }

    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskName = newTaskNameInput.value.trim();
            if (taskName && userId) {                
                const isDuplicate = allTasks.some(task => task.name.toLowerCase() === taskName.toLowerCase());
                if (isDuplicate) {
                    showMessageModal(`A tarefa "${taskName}" já existe.`);
                    return;
                }
                
                console.log("Tentando adicionar tarefa com companyId:", userId);
                console.log("Usuário autenticado (auth.currentUser.uid):", auth.currentUser ? auth.currentUser.uid : "Nenhum usuário logado");
                try {
                    await addDoc(collection(db, 'tasks'), {
                        name: taskName,
                        companyId: userId,
                        createdAt: new Date()
                    });
                } catch (error) {
                    console.error("Erro ao adicionar tarefa:", error);
                    showMessageModal("Não foi possível adicionar a tarefa. Tente novamente.");
                } finally {
                    newTaskNameInput.value = '';
                }
            }
        });
    }
    
    // Adiciona funcionalidade de Enter para adicionar tarefa
    if (newTaskNameInput) {
        newTaskNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Evita quebra de linha ou outro comportamento padrão
                addTaskForm.dispatchEvent(new Event('submit')); // Dispara o evento de submit do formulário
            }
        });
    }

    if (createMemberForm) {
        createMemberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!userId) {
                showMessageModal("Erro de autenticação. Por favor, faça login novamente.");
                return;
            }

            const submitButton = document.getElementById('submit-create-member');
            toggleButtonLoading(submitButton, true);

            const memberName = createMemberForm['member-name'].value;
            const memberEmail = createMemberForm['member-email'].value;

            try {
                // LÓGICA SEM CLOUD FUNCTION: Adiciona o membro diretamente no Firestore
                const newMemberRef = await addDoc(collection(db, 'members'), {
                    name: memberName,
                    email: memberEmail,
                    companyId: userId // O ID do gestor logado é o ID da empresa.
                });

                // O ID do novo documento será o token de acesso do colaborador.
                const newMemberId = newMemberRef.id;
                
                createMemberModal.classList.add('hidden');
                createMemberForm.reset();

                // Exibe o modal com o token para o gestor copiar
                showTokenValue.textContent = newMemberId;
                showTokenModal.classList.remove('hidden');
            } catch (error) {
                console.error("Erro ao adicionar colaborador:", error);
                showMessageModal("Erro ao adicionar colaborador. Verifique suas regras de segurança do Firestore e tente novamente.");
            } finally {
                toggleButtonLoading(submitButton, false);
            }
        });
    }

    if (closeTokenModalButton) {
        closeTokenModalButton.addEventListener('click', () => {
            showTokenModal.classList.add('hidden');
        });
    }

    if (copyTokenButton) {
        copyTokenButton.addEventListener('click', () => {
            navigator.clipboard.writeText(showTokenValue.textContent).then(() => {
                showMessageModal("Token copiado para a área de transferência!");
                showTokenModal.classList.add('hidden');
            });
        });
    }

    if (membersList) {
        membersList.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            if (button.classList.contains('delete-member-button')) {
                const memberId = button.dataset.id;
                const memberName = button.dataset.name;
                const confirmed = await showMessageModal(`Tem certeza que deseja excluir o colaborador "${memberName}"? Esta ação não pode ser desfeita.`, 'confirm');
                if (confirmed) {
                    deleteDoc(doc(db, "members", memberId)).then(() => {
                        showMessageModal("Colaborador excluído com sucesso.");
                    }).catch(err => showMessageModal("Erro ao excluir colaborador."));
                }
            }

            if (button.classList.contains('edit-member-button')) {
                editMemberIdInput.value = button.dataset.id;
                editMemberNameInput.value = button.dataset.name;
                editMemberEmailInput.value = button.dataset.email;
                editMemberModal.classList.remove('hidden');
            }

            if (button.classList.contains('view-token-button')) {
                const memberId = button.dataset.id;
                // Reutiliza o modal existente para mostrar o token
                showTokenValue.textContent = memberId; // O memberId é o próprio token
                showTokenModal.classList.remove('hidden');
            }
        });
    }

    if (editMemberForm) {
        editMemberForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const memberId = editMemberIdInput.value;
            const newName = editMemberNameInput.value.trim();
            const newEmail = editMemberEmailInput.value.trim();

            if (!memberId || !newName || !newEmail) {
                showMessageModal("Todos os campos são obrigatórios.");
                return;
            }

            toggleButtonLoading(saveEditMemberButton, true);
            const memberDocRef = doc(db, "members", memberId);

            try {
                await updateDoc(memberDocRef, { name: newName, email: newEmail });
                editMemberModal.classList.add('hidden');
                showMessageModal("Informações do colaborador atualizadas com sucesso.");
            } catch (error) {
                console.error("Erro ao atualizar colaborador:", error);
                showMessageModal("Erro ao atualizar informações. Tente novamente.");
            } finally {
                toggleButtonLoading(saveEditMemberButton, false);
            }
        });
    }

    if (cancelEditMemberButton) cancelEditMemberButton.addEventListener('click', () => editMemberModal.classList.add('hidden')); 

    // Fecha o modal de edição de membro ao clicar no backdrop
    if (editMemberModal) {
        editMemberModal.addEventListener('click', (e) => {
            if (e.target.id === 'edit-member-modal') {
                editMemberModal.classList.add('hidden');
            }
        });
    }

    if (tasksList) {
        tasksList.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            if (button.classList.contains('edit-task-button')) {
                editTaskIdInput.value = button.dataset.id;
                editTaskNameInput.value = button.dataset.name;
                editTaskModal.classList.remove('hidden');
            }

            if (button.classList.contains('delete-task-button')) {
                const taskId = button.dataset.id;
                const taskName = button.dataset.name;
                const confirmed = await showMessageModal(`Tem certeza que deseja excluir a tarefa "${taskName}"?`, 'confirm');
                if (confirmed) {
                    await deleteDoc(doc(db, "tasks", taskId));
                    showMessageModal("Tarefa excluída com sucesso.");
                }
            }
        });
    }

    if (cancelEditTaskButton) cancelEditTaskButton.addEventListener('click', () => editTaskModal.classList.add('hidden'));

    // Fecha o modal de edição de tarefa ao clicar no backdrop
    if (editTaskModal) {
        editTaskModal.addEventListener('click', (e) => {
            if (e.target.id === 'edit-task-modal') {
                editTaskModal.classList.add('hidden');
            }
        });
    }

    if (editTaskForm) {
        editTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskId = editTaskIdInput.value;
            const newName = editTaskNameInput.value.trim();

            if (!newName) {
                showMessageModal("O nome da tarefa não pode ser vazio.");
                return;
            }

            const isDuplicate = allTasks.some(task =>
                task.name.toLowerCase() === newName.toLowerCase() && task.id !== taskId
            );

            if (isDuplicate) {
                showMessageModal(`A tarefa "${newName}" já existe.`);
                return;
            }

            toggleButtonLoading(saveEditTaskButton, true);
            const taskDocRef = doc(db, "tasks", taskId);

            try {
                await updateDoc(taskDocRef, { name: newName });
                editTaskModal.classList.add('hidden');
                // A lista de tarefas já é reativa com onSnapshot, mas uma renderização manual garante a atualização.
                showMessageModal("Tarefa atualizada com sucesso.");
            } catch (error) {
                console.error("Erro ao atualizar tarefa:", error);
                showMessageModal("Erro ao atualizar a tarefa. Tente novamente.");
            } finally {
                toggleButtonLoading(saveEditTaskButton, false);
            }
        });
    }

    if (searchMemberInput) {
        searchMemberInput.addEventListener('input', () => {
            membersCurrentPage = 1;
            renderMembers();
        });
    }

    if (prevMembersPageButton) {
        prevMembersPageButton.addEventListener('click', () => {
            if (membersCurrentPage > 1) {
                membersCurrentPage--;
                renderMembers();
            }
        });
    }

    if (nextMembersPageButton) {
        nextMembersPageButton.addEventListener('click', () => {
            const searchTerm = searchMemberInput.value.toLowerCase();
            const filteredMembers = allMembers.filter(member =>
                member.name.toLowerCase().includes(searchTerm) ||
                member.email.toLowerCase().includes(searchTerm)
            );
            const totalPages = Math.ceil(filteredMembers.length / membersPageSize);

            if (membersCurrentPage < totalPages) {
                membersCurrentPage++;
                renderMembers();
            }
        });
    }
}

initializeApp(initCompanyDashboardPage, db);