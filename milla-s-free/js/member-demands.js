import { initThemeManager } from './theme-manager.js';
import { db } from './firebase-services.js';
import { collection, query, where, onSnapshot, getDoc, doc, orderBy } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

let userId;
let companyId;
let demandsList;

function createDemandHTML(demand) {
    const sanitize = (str) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

    const tasksHTML = demand.tasks && demand.tasks.length > 0
        ? `<ul>${demand.tasks.map(task => `<li class="text-sm text-secondary ml-4">&bull; ${sanitize(task.name)}</li>`).join('')}</ul>`
        : '<p class="text-sm text-secondary ml-4">Nenhuma tarefa associada.</p>';

    return `
        <div class="card p-4">
            <div>
                <h3 class="font-bold text-lg">${sanitize(demand.name)}</h3>
                <p class="text-sm text-secondary mb-2">${sanitize(demand.description)}</p>
            </div>
            <details class="mt-2" open>
                <summary class="cursor-pointer text-sm font-semibold">Ver Tarefas (${demand.tasks?.length || 0})</summary>
                <div class="mt-2 pl-2 border-l-2 border-border-color">
                    ${tasksHTML}
                </div>
            </details>
        </div>
    `;
}

async function setupDemandsListener() {
    if (!db || !companyId) return;

    const q = query(collection(db, "demands"), where("companyId", "==", companyId), orderBy("name"));
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            demandsList.innerHTML = `<p class="text-secondary text-center p-4">Nenhuma demanda encontrada para sua equipe.</p>`;
            return;
        }
        const allDemands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        demandsList.innerHTML = allDemands.map(createDemandHTML).join('');
    }, (error) => {
        console.error("Falha ao buscar demandas:", error);
        demandsList.innerHTML = `<p class="text-red-500 text-center p-4">Erro ao carregar as demandas. Verifique suas permissões.</p>`;
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

async function initMemberDemandsPage() {
    initThemeManager('theme-toggle');
    initProfileDropdown(); // Adiciona a lógica do menu de perfil
    setupLogout();
    demandsList = document.getElementById('demands-list');

    const token = localStorage.getItem('memberLoginToken');
    if (!token) {
        console.log("Nenhum token de login encontrado. Redirecionando...");
        window.location.href = 'landing.html';
        return;
    }

    userId = token; // O ID do membro é o próprio token.

    try {
        const memberDocRef = doc(db, "members", userId);
        const memberDocSnap = await getDoc(memberDocRef);

        if (memberDocSnap.exists()) {
            companyId = memberDocSnap.data().companyId;
            const memberData = memberDocSnap.data();

            // Preenche o nome do usuário no menu de perfil
            const memberNameDisplay = document.getElementById('member-name-display');
            if (memberNameDisplay) memberNameDisplay.textContent = memberData.name;

            console.log(`Página de Demandas do Membro inicializada para: ${userId} (Empresa: ${companyId})`);
            document.getElementById('dashboard-content').classList.remove('hidden');
            await setupDemandsListener();
        } else {
            console.error("Token inválido. Documento do membro não encontrado.");
            localStorage.removeItem('memberLoginToken');
            window.location.href = 'landing.html';
        }
    } catch (error) {
        console.error("Erro ao carregar dados do colaborador:", error);
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

document.addEventListener('DOMContentLoaded', initMemberDemandsPage);