import { auth, functions } from './firebase-services.js';
import { applyInitialTheme } from './theme-manager.js';
import { showMessageModal } from './ui-helpers.js';
import { signInWithCustomToken, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

applyInitialTheme();

document.addEventListener('DOMContentLoaded', () => {
    const memberLoginForm = document.getElementById('member-login-form');
    const tokenInput = document.getElementById('login-token');
    const forgotPasswordLink = document.getElementById('member-forgot-password');

    if (!memberLoginForm || !tokenInput || !forgotPasswordLink) {
        console.error("Elementos do formulário de login de membro não encontrados.");
        return;
    }
    
    memberLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = tokenInput.value.trim();

        if (!token) {
            showMessageModal("Por favor, insira seu token de acesso.");
            return;
        }

        const submitButton = memberLoginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        // Adiciona um token de teste para bypassar a autenticação real
        if (token === 'dev-a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d') {
            console.log("Token de teste detectado. Redirecionando para o perfil de teste.");
            localStorage.setItem('memberLoginToken', token);
            window.location.href = 'profile.html';
            return;
        }

        try {
            // Chama a Cloud Function para obter um token de autenticação customizado
            const getMemberAuthToken = httpsCallable(functions, 'getMemberAuthToken');
            const result = await getMemberAuthToken({ memberId: token });
            const customAuthToken = result.data.token;

            // Faz login com o token customizado
            await signInWithCustomToken(auth, customAuthToken);
            
            // Redireciona para a página de perfil, agora com o colaborador autenticado
            window.location.href = 'profile.html';
            
        } catch (error) {
            console.error("Erro no login do colaborador:", error);
            showMessageModal("Token de acesso inválido ou expirado. Por favor, solicite um novo ao seu gestor.");
        } finally {
            submitButton.disabled = false;
        }
    });

    // O link de "Esqueci a senha" para o colaborador é um pouco diferente.
    // Ele não pode redefinir a senha sem saber o e-mail associado ao token.
    // A melhor abordagem é instruí-lo a contatar o gestor.
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();
        showMessageModal("Para criar ou redefinir sua senha, entre em contato com o seu gestor. Ele poderá reenviar o convite para o seu e-mail, que conterá um link para definição de senha.");
    });
});