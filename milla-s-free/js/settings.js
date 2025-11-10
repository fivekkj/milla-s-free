import { initThemeManager } from './theme-manager.js';
import { showMessageModal, toggleButtonLoading } from './ui-helpers.js';
import { auth, db } from './firebase-services.js';
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let userId;

// Function to handle data export
async function exportDataToCSV() {
    if (!db || !userId) {
        showMessageModal("Não foi possível exportar os dados. Tente novamente.");
        return;
    }

    // 1. Export Members
    const membersQuery = query(collection(db, "members"), where("companyId", "==", userId));
    const membersSnapshot = await getDocs(membersQuery);
    let membersCSV = "Nome,Email,Token\n";
    membersSnapshot.forEach(doc => {
        const member = doc.data();
        membersCSV += `"${member.name}","${member.email}","${doc.id}"\n`;
    });
    downloadCSV(membersCSV, 'membros.csv');

    // 2. Export Time Entries
    const timeEntriesQuery = query(collection(db, "timeEntries"), where("companyId", "==", userId));
    const timeEntriesSnapshot = await getDocs(timeEntriesQuery);
    let timeEntriesCSV = "Projeto,Membro ID,Data,Duração (segundos),Status\n";
    timeEntriesSnapshot.forEach(doc => {
        const entry = doc.data();
        const date = new Date(entry.timestamp.seconds * 1000).toISOString();
        timeEntriesCSV += `"${entry.projectName}","${entry.memberId || 'Empresa'}","${date}",${entry.duration},${entry.status}\n`;
    });
    downloadCSV(timeEntriesCSV, 'entradas_de_tempo.csv');

    showMessageModal("Exportação de dados concluída.");
}

function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Function to handle account deletion
async function handleAccountDeletion() {
    if (!db || !auth.currentUser) return;

    try {
        // 1. Delete all associated data from Firestore
        const collectionsToDelete = ['members', 'tasks', 'timeEntries'];
        for (const coll of collectionsToDelete) {
            try {
                const q = query(collection(db, coll), where("companyId", "==", userId));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const batch = writeBatch(db);
                    snapshot.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            } catch (e) {
                console.warn(`Could not delete from collection ${coll}. It might not exist. Error:`, e);
                // Continue to the next collection even if one fails
            }
        }

        // 2. Delete company profile
        await deleteDoc(doc(db, "companies", userId));

        // 3. Delete the user from Auth
        await deleteUser(auth.currentUser);
        
        await showMessageModal("Sua conta foi excluída com sucesso.");
        window.location.href = 'landing.html'; // Redirect after user clicks OK

    } catch (error) {
        console.error("Erro ao excluir conta:", error);
        showMessageModal("Ocorreu um erro durante a exclusão final da conta. Por favor, contate o suporte.");
    }
}

// Função para atualizar as cores dos membros antigos
async function updateExistingMemberColors() {
    const updateButton = document.getElementById('update-member-colors-button');
    toggleButtonLoading(updateButton, true);

    const MEMBER_COLOR_PALETTE = [
        '#8a5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
        '#6366f1', '#d946ef', '#06b6d4', '#84cc16', '#ec4899'
    ];

    try {
        // CORREÇÃO: Busca apenas os membros da empresa do admin logado.
        const q = query(collection(db, "members"), where("companyId", "==", userId));
        const membersSnapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        let updatesMade = 0;
        let colorIndex = 0;

        // Conta quantos membros já têm cor para continuar a paleta
        membersSnapshot.forEach(doc => {
            if (doc.data().color) colorIndex++;
        });

        membersSnapshot.forEach(doc => {
            if (!doc.data().color) { // Atualiza apenas se não tiver cor
                const newColor = MEMBER_COLOR_PALETTE[colorIndex % MEMBER_COLOR_PALETTE.length];
                batch.update(doc.ref, { color: newColor });
                updatesMade++;
                colorIndex++;
            }
        });

        if (updatesMade > 0) {
            await batch.commit();
            showMessageModal(`${updatesMade} colaborador(es) foram atualizados com uma nova cor. Recarregue a página de relatórios.`);
        } else {
            showMessageModal("Todos os colaboradores já possuem uma cor definida. Nenhuma atualização foi necessária.");
        }
    } catch (error) {
        console.error('Erro ao atualizar cores:', error);
        showMessageModal("Ocorreu um erro ao tentar atualizar as cores dos colaboradores.");
    } finally {
        toggleButtonLoading(updateButton, false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initThemeManager('theme-toggle');
    initThemeManager('theme-toggle-settings');

    const profileForm = document.getElementById('profile-form');
    const companyNameInput = document.getElementById('company-name');
    const companyEmailInput = document.getElementById('company-email');
    const saveProfileButton = document.getElementById('save-profile-button');

    const passwordForm = document.getElementById('password-form');
    const changePasswordButton = document.getElementById('change-password-button');

    const exportDataButton = document.getElementById('export-data-button');
    const deleteAccountButton = document.getElementById('delete-account-button');
    const updateColorsButton = document.getElementById('update-member-colors-button');
    const reauthModal = document.getElementById('reauth-modal');
    const reauthForm = document.getElementById('reauth-form');
    const reauthCancelButton = document.getElementById('reauth-cancel-button');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            companyEmailInput.value = user.email;

            // Load company profile
            const companyDocRef = doc(db, "companies", userId);
            const companyDocSnap = await getDoc(companyDocRef);
            if (companyDocSnap.exists()) {
                companyNameInput.value = companyDocSnap.data().name;
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    // Handle Profile Form Submission
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        toggleButtonLoading(saveProfileButton, true);
        const newName = companyNameInput.value.trim();
        const companyDocRef = doc(db, "companies", userId);

        try {
            await setDoc(companyDocRef, { name: newName, email: auth.currentUser.email }, { merge: true });
            showMessageModal("Perfil atualizado com sucesso!");
        } catch (error) {
            console.error("Erro ao atualizar perfil:", error);
            showMessageModal("Não foi possível atualizar o perfil.");
        } finally {
            toggleButtonLoading(saveProfileButton, false);
        }
    });

    // Handle Password Form Submission
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        toggleButtonLoading(changePasswordButton, true);

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            showMessageModal("A nova senha e a confirmação não correspondem.");
            toggleButtonLoading(changePasswordButton, false);
            return;
        }
        if (newPassword.length < 6) {
            showMessageModal("A nova senha deve ter pelo menos 6 caracteres.");
            toggleButtonLoading(changePasswordButton, false);
            return;
        }

        try {
            const user = auth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            
            // Re-authenticate user
            await reauthenticateWithCredential(user, credential);
            
            // Update password
            await updatePassword(user, newPassword);
            
            showMessageModal("Senha alterada com sucesso!");
            passwordForm.reset();
        } catch (error) {
            console.error("Erro ao alterar senha:", error);
            if (error.code === 'auth/wrong-password') {
                showMessageModal("A senha atual está incorreta.");
            } else {
                showMessageModal("Erro ao alterar a senha. Tente novamente.");
            }
        } finally {
            toggleButtonLoading(changePasswordButton, false);
        }
    });

    // Handle Data Export
    if (exportDataButton) {
        exportDataButton.addEventListener('click', exportDataToCSV);
    }

    // Handle Member Color Update
    if (updateColorsButton) {
        updateColorsButton.addEventListener('click', updateExistingMemberColors);
    }

    // Handle Account Deletion
    if (deleteAccountButton && reauthModal && reauthForm && reauthCancelButton) {
        deleteAccountButton.addEventListener('click', async () => {
            const firstConfirm = await showMessageModal("Tem certeza que deseja excluir sua conta? Esta ação é irreversível.", 'confirm');
            if (!firstConfirm) return;

            const secondConfirm = await showMessageModal("Esta é sua última chance. Todos os seus dados serão permanentemente apagados. Confirma a exclusão?", 'confirm');
            if (!secondConfirm) return;

            // Show re-authentication modal instead of deleting directly
            reauthModal.classList.remove('hidden');
        });

        reauthCancelButton.addEventListener('click', () => {
            reauthModal.classList.add('hidden');
            reauthForm.reset();
        });

        reauthForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('reauth-password').value;
            const user = auth.currentUser;

            if (!user || !password) return;

            try {
                const credential = EmailAuthProvider.credential(user.email, password);
                await reauthenticateWithCredential(user, credential);
                
                // Re-authentication successful, now proceed with deletion
                reauthModal.classList.add('hidden');
                await handleAccountDeletion();

            } catch (error) {
                console.error("Re-authentication failed:", error);
                showMessageModal("Senha incorreta. A exclusão da conta foi cancelada.");
                reauthModal.classList.add('hidden');
                reauthForm.reset();
            }
        });
    }
});