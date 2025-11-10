import { initializeApp } from './app.js';
import { db, auth } from './firebase-services.js';
import { showMessageModal, toggleButtonLoading } from './ui-helpers.js';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, addDoc, orderBy } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

let userId, allTasks = [], allDemands = [];

// --- Elementos da UI ---
let demandsList, addDemandButton, demandModal, demandModalTitle, demandForm, demandIdInput, demandNameInput,
    demandDescriptionInput, demandTasksContainer, newDemandTaskInput, addManualTaskButton, cancelDemandButton, saveDemandButton,
    openPredefinedTasksModal, predefinedTasksModal, predefinedTasksList, cancelSelectTasksButton, addSelectedTasksButton,
    addTaskForm, newTaskNameInput, tasksList, editTaskModal, editTaskForm, cancelEditTaskButton, saveEditTaskButton,
    editTaskIdInput, editTaskNameInput, pageOverlay;

function initUIElements() {
    // Mapeamento para Demandas
    demandsList = document.getElementById('demands-list');
    addDemandButton = document.getElementById('add-demand-button');
    demandModal = document.getElementById('demand-modal');
    demandModalTitle = document.getElementById('demand-modal-title');
    demandForm = document.getElementById('demand-form');
    demandIdInput = document.getElementById('demand-id');
    demandNameInput = document.getElementById('demand-name');
    demandDescriptionInput = document.getElementById('demand-description');
    demandTasksContainer = document.getElementById('demand-tasks-container');
    newDemandTaskInput = document.getElementById('new-demand-task-input');
    addManualTaskButton = document.getElementById('add-manual-task-button');
    cancelDemandButton = document.getElementById('cancel-demand-button');
    saveDemandButton = document.getElementById('save-demand-button');
    openPredefinedTasksModal = document.getElementById('open-predefined-tasks-modal');
    predefinedTasksModal = document.getElementById('predefined-tasks-modal');
    predefinedTasksList = document.getElementById('predefined-tasks-list');
    cancelSelectTasksButton = document.getElementById('cancel-select-tasks-button');
    addSelectedTasksButton = document.getElementById('add-selected-tasks-button');

    // Mapeamento para Tarefas (unificado)
    addTaskForm = document.getElementById('add-task-form');
    newTaskNameInput = document.getElementById('new-task-name');
    tasksList = document.getElementById('tasks-list');
    editTaskModal = document.getElementById('edit-task-modal');
    editTaskForm = document.getElementById('edit-task-form');
    cancelEditTaskButton = document.getElementById('cancel-edit-task-button');
    saveEditTaskButton = document.getElementById('save-edit-task-button');
    editTaskIdInput = document.getElementById('edit-task-id');
    editTaskNameInput = document.getElementById('edit-task-name');

    // Overlay
    pageOverlay = document.getElementById('page-overlay');
}

function createTaskHTML(task) {
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

function createDemandHTML(demand) {
    const sanitize = (str) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

    const tasksHTML = demand.tasks && demand.tasks.length > 0
        ? `<ul>${demand.tasks.map(task => `<li class="text-sm text-secondary ml-4">&bull; ${sanitize(task.name)}</li>`).join('')}</ul>`
        : '<p class="text-sm text-secondary ml-4">Nenhuma tarefa associada.</p>';

    return `
        <div class="card p-4">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-bold text-lg">${sanitize(demand.name)}</h3>
                    <p class="text-sm text-secondary mb-2">${sanitize(demand.description)}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button title="Editar Demanda" class="edit-demand-button btn-icon" data-id="${demand.id}"><i class="fas fa-edit"></i></button>
                    <button title="Excluir Demanda" class="delete-demand-button btn-icon" data-id="${demand.id}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <details class="mt-2">
                <summary class="cursor-pointer text-sm font-semibold">Ver Tarefas (${demand.tasks?.length || 0})</summary>
                <div class="mt-2 pl-2 border-l-2 border-border-color">
                    ${tasksHTML}
                </div>
            </details>
        </div>
    `;
}

function renderDemandTasksInModal(tasks = []) {
    demandTasksContainer.innerHTML = tasks.map((task, index) => `
        <div class="flex items-center justify-between bg-main p-2 rounded">
            <span class="text-sm">${task.name}</span>
            <button type="button" class="remove-task-from-demand-button btn-icon text-red-500" data-index="${index}">&times;</button>
        </div>
    `).join('');

    if (tasks.length === 0) {
        demandTasksContainer.innerHTML = `<p class="text-xs text-secondary text-center p-2">Adicione tarefas manuais ou pré-definidas.</p>`;
    }
}

function openDemandModal(demand = null) {
    demandForm.reset();
    if (demand) {
        demandModalTitle.textContent = 'Editar Demanda';
        demandIdInput.value = demand.id;
        demandNameInput.value = demand.name;
        demandDescriptionInput.value = demand.description;
        renderDemandTasksInModal(demand.tasks);
    } else {
        demandModalTitle.textContent = 'Criar Nova Demanda';
        demandIdInput.value = '';
        renderDemandTasksInModal([]);
    }
    demandModal.classList.remove('hidden');
    pageOverlay.classList.remove('hidden');
}

function closeDemandModal() {
    demandModal.classList.add('hidden');
    pageOverlay.classList.add('hidden');
}

function setupDemandsListener() {
    if (!db || !userId) return;

    const q = query(collection(db, "demands"), where("companyId", "==", userId), orderBy("name"));
    onSnapshot(q, (snapshot) => {
        allDemands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (snapshot.empty) {
            demandsList.innerHTML = `<p class="text-secondary text-center p-4">Nenhuma demanda criada ainda.</p>`;
            return;
        }
        demandsList.innerHTML = allDemands.map(createDemandHTML).join('');
    }, (error) => {
        // Log detalhado do erro para facilitar a depuração, especialmente para erros de índice.
        console.error("Falha ao buscar demandas. Causa provável: índice ausente no Firestore.", error);
        if (error.message.includes("The query requires an index")) {
            console.warn("DICA: O erro acima indica que você precisa criar um índice composto no Firestore. Procure por um link no erro para criá-lo automaticamente.");
        }
        demandsList.innerHTML = `<p class="text-red-500 text-center p-4">Erro ao carregar as demandas.</p>`;
    });
}

function populatePredefinedTasksModal() {
    if (allTasks.length === 0) {
        predefinedTasksList.innerHTML = `<p class="text-secondary text-center p-4">Nenhuma tarefa pré-definida criada.</p>`;
        return;
    }
    predefinedTasksList.innerHTML = allTasks.map(task => `
        <label class="flex items-center space-x-3 p-2 hover:bg-main rounded cursor-pointer">
            <input type="checkbox" class="form-checkbox" value="${task.name}">
            <span>${task.name}</span>
        </label>
    `).join('');
}

function setupTasksListener() {
    if (!db || !userId) return;

    const q = query(collection(db, "tasks"), where("companyId", "==", userId), orderBy("name"));

    onSnapshot(q, (snapshot) => {
        allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (snapshot.empty) {
            tasksList.innerHTML = `<p class="text-center text-secondary text-sm col-span-full p-4">Nenhuma tarefa criada.</p>`;
            return;
        }

        tasksList.innerHTML = allTasks.map(createTaskHTML).join('');

    }, (error) => {
        console.error("Erro ao buscar tarefas:", error);
        tasksList.innerHTML = '<p class="text-center text-red-500 text-sm col-span-full">Erro ao carregar tarefas.</p>';
    });
}

function initDemandsPage(user) {
    userId = user.uid;
    console.log("Página de Demandas inicializada para:", userId);

    initUIElements();
    setupDemandsListener();
    setupTasksListener();

    // --- Listeners para Demandas ---

    addDemandButton.addEventListener('click', () => openDemandModal());
    cancelDemandButton.addEventListener('click', closeDemandModal);
    pageOverlay.addEventListener('click', closeDemandModal);

    addManualTaskButton.addEventListener('click', () => {
        const taskName = newDemandTaskInput.value.trim();
        if (!taskName) return;

        const currentTasks = Array.from(demandTasksContainer.querySelectorAll('span')).map(span => ({ name: span.textContent }));
        currentTasks.push({ name: taskName, status: 'pending' });
        renderDemandTasksInModal(currentTasks);
        newDemandTaskInput.value = '';
    });

    demandTasksContainer.addEventListener('click', (e) => {
        if (e.target.closest('.remove-task-from-demand-button')) {
            const indexToRemove = parseInt(e.target.closest('button').dataset.index, 10);
            let currentTasks = Array.from(demandTasksContainer.querySelectorAll('span')).map(span => ({ name: span.textContent }));
            currentTasks.splice(indexToRemove, 1);
            renderDemandTasksInModal(currentTasks);
        }
    });

    demandForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        toggleButtonLoading(saveDemandButton, true);

        const demandData = {
            name: demandNameInput.value.trim(),
            description: demandDescriptionInput.value.trim(),
            tasks: Array.from(demandTasksContainer.querySelectorAll('span')).map(span => ({ name: span.textContent, status: 'pending' })),
            companyId: userId,
        };

        try {
            const id = demandIdInput.value;
            if (id) {
                await updateDoc(doc(db, 'demands', id), demandData);
                showMessageModal("Demanda atualizada com sucesso!");
            } else {
                demandData.createdAt = new Date();
                await addDoc(collection(db, 'demands'), demandData);
                showMessageModal("Demanda criada com sucesso!");
            }
            closeDemandModal();
        } catch (error) {
            console.error("Erro ao salvar demanda:", error);
            showMessageModal("Ocorreu um erro ao salvar a demanda.");
        } finally {
            toggleButtonLoading(saveDemandButton, false);
        }
    });

    demandsList.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const id = button.dataset.id;
        if (button.classList.contains('edit-demand-button')) {
            const demandToEdit = allDemands.find(d => d.id === id);
            if (demandToEdit) openDemandModal(demandToEdit);
        }

        if (button.classList.contains('delete-demand-button')) {
            const confirmed = await showMessageModal("Tem certeza que deseja excluir esta demanda e todas as suas tarefas associadas?", 'confirm');
            if (confirmed) {
                await deleteDoc(doc(db, "demands", id));
                showMessageModal("Demanda excluída com sucesso.");
            }
        }
    });

    // --- Listeners para Modal de Tarefas Pré-definidas ---

    openPredefinedTasksModal.addEventListener('click', () => {
        populatePredefinedTasksModal();
        predefinedTasksModal.classList.remove('hidden');
    });

    cancelSelectTasksButton.addEventListener('click', () => predefinedTasksModal.classList.add('hidden'));

    addSelectedTasksButton.addEventListener('click', () => {
        const selectedTasks = Array.from(predefinedTasksList.querySelectorAll('input:checked'))
            .map(checkbox => ({ name: checkbox.value, status: 'pending' }));

        if (selectedTasks.length > 0) {
            const currentTasks = Array.from(demandTasksContainer.querySelectorAll('span')).map(span => ({ name: span.textContent }));
            const newTasks = [...currentTasks, ...selectedTasks];
            renderDemandTasksInModal(newTasks);
        }
        predefinedTasksModal.classList.add('hidden');
    });


    // --- Listeners para Gerenciamento de Tarefas (Unificado) ---

    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskName = newTaskNameInput.value.trim();
            if (!taskName) return;

            const isDuplicate = allTasks.some(task => task.name.toLowerCase() === taskName.toLowerCase());
            if (isDuplicate) {
                showMessageModal(`A tarefa "${taskName}" já existe.`);
                return;
            }

            try {
                await addDoc(collection(db, 'tasks'), {
                    name: taskName,
                    companyId: userId,
                    createdAt: new Date()
                });
                newTaskNameInput.value = '';
            } catch (error) {
                console.error("Erro ao adicionar tarefa:", error);
                showMessageModal("Não foi possível adicionar a tarefa. Tente novamente.");
            }
        });
    }

    if (tasksList) {
        tasksList.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const id = button.dataset.id;
            const name = button.dataset.name;

            if (button.classList.contains('edit-task-button')) {
                editTaskIdInput.value = id;
                editTaskNameInput.value = name;
                editTaskModal.classList.remove('hidden');
            }

            if (button.classList.contains('delete-task-button')) {
                const confirmed = await showMessageModal(`Tem certeza que deseja excluir a tarefa "${name}"?`, 'confirm');
                if (confirmed) {
                    await deleteDoc(doc(db, "tasks", id));
                    showMessageModal("Tarefa excluída com sucesso.");
                }
            }
        });
    }

    if (cancelEditTaskButton) cancelEditTaskButton.addEventListener('click', () => editTaskModal.classList.add('hidden'));

    if (editTaskForm) {
        editTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskId = editTaskIdInput.value;
            const newName = editTaskNameInput.value.trim();
            if (!newName) return;

            toggleButtonLoading(saveEditTaskButton, true); // Certifique-se que o botão correto está sendo usado
            await updateDoc(doc(db, "tasks", taskId), { name: newName });
            toggleButtonLoading(saveEditTaskButton, false);

            editTaskModal.classList.add('hidden');
            showMessageModal("Tarefa atualizada com sucesso.");
        });
    }
}

initializeApp(initDemandsPage);