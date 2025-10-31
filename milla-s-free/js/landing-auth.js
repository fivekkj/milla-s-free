import { auth } from './firebase-services.js';
import { showMessageModal } from './ui-helpers.js';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence, browserLocalPersistence, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

export function initLandingAuth() {
    const loginModal = document.getElementById('login-modal');
    const memberLoginModal = document.getElementById('member-login-modal');
    const openLoginModalBtn = document.getElementById('open-login-modal-btn');
    const openMemberLoginLink = document.getElementById('open-member-login-modal-link');
    const footerOpenMemberLoginLink = document.getElementById('footer-open-member-login-modal');
    const backToAdminLink = document.getElementById('back-to-admin-login-link');
    const loginForm = document.getElementById('login-form');
    const loginErrorEl = document.getElementById('login-error-message');
    const allOpenTriggers = document.querySelectorAll('.open-login-modal-trigger');
    // O formulário de login do membro agora está na landing page
    const memberLoginForm = document.getElementById('member-login-form');

    if (!loginModal || !openLoginModalBtn || !loginForm || !loginErrorEl) {
        console.error("Elementos do modal de login não encontrados.");
        return;
    }

    const toggleModal = () => loginModal.classList.toggle('hidden');
    const openModal = () => loginModal.classList.remove('hidden');

    openLoginModalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleModal();
    });


    allOpenTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });
    });
    
    // Fecha o dropdown se clicar em qualquer lugar fora dele
    document.addEventListener('click', (e) => {
        // Verifica se o modal está visível e se o clique foi fora do modal e fora do botão que o abre
        const isClickInsideLogin = loginModal.contains(e.target) || openLoginModalBtn.contains(e.target) || Array.from(allOpenTriggers).some(t => t.contains(e.target));
        const isClickInsideMemberLogin = memberLoginModal.contains(e.target) || openMemberLoginLink.contains(e.target) || footerOpenMemberLoginLink.contains(e.target);

        if (!loginModal.classList.contains('hidden') && !isClickInsideLogin && !isClickInsideMemberLogin) {
            loginModal.classList.add('hidden');
        }
        if (!memberLoginModal.classList.contains('hidden') && !isClickInsideMemberLogin && !isClickInsideLogin) {
            memberLoginModal.classList.add('hidden');
        }
    });

    // Alterna para o modal de login de membro
    [openMemberLoginLink, footerOpenMemberLoginLink].forEach(link => {
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Impede que o evento de clique feche o modal imediatamente
                loginModal.classList.add('hidden');
                memberLoginModal.classList.remove('hidden');
            });
        }
    });

    // Volta para o modal de login de admin
    if (backToAdminLink) {
        backToAdminLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            memberLoginModal.classList.add('hidden');
            loginModal.classList.remove('hidden');
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;
        const rememberMe = loginForm['remember-me'].checked;

        try {
            // Define a persistência ANTES de fazer o login
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);

            await signInWithEmailAndPassword(auth, email, password);
            // Login bem-sucedido, redireciona para o painel
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Erro no login:", error.code);
            if (error.code === 'auth/invalid-credential') {
                loginErrorEl.textContent = "E-mail ou senha incorretos. Verifique suas credenciais.";
            } else {
                loginErrorEl.textContent = "Não foi possível conectar. Verifique sua internet e tente novamente.";
            }
            loginErrorEl.classList.remove('hidden');
        }
    });

    // Esconde a mensagem de erro quando o usuário começar a digitar novamente
    loginForm['login-email'].addEventListener('input', () => {
        if (!loginErrorEl.classList.contains('hidden')) loginErrorEl.classList.add('hidden');
    });
    loginForm['login-password'].addEventListener('input', () => {
        if (!loginErrorEl.classList.contains('hidden')) loginErrorEl.classList.add('hidden');
    });

    // Verifica se a página deve abrir o modal de login automaticamente
    // (útil ao ser redirecionado da página de registro)
    if (localStorage.getItem('openLoginModal') === 'true') {
        loginModal.classList.remove('hidden');
        localStorage.removeItem('openLoginModal'); // Limpa o gatilho
    }

    // Adiciona um listener para o link "Esqueci minha senha" se ele existir
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = loginForm['login-email'].value;
            if (!email) {
                showMessageModal("Por favor, digite seu e-mail no campo correspondente antes de solicitar a redefinição de senha.");
                return;
            }
            try {
                await sendPasswordResetEmail(auth, email);
                showMessageModal("Se o seu e-mail estiver cadastrado, um link para redefinir sua senha foi enviado.");
            } catch (error) {
                console.error("Erro ao enviar e-mail de redefinição:", error);
                showMessageModal("Ocorreu um erro. Verifique o e-mail digitado e tente novamente.");
            }
        });
    }

    // Lógica para o formulário de login do membro (com token)
    if (memberLoginForm) {
        memberLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = memberLoginForm['login-token'].value.trim();

            if (!token) {
                showMessageModal("Por favor, insira seu token de acesso.");
                return;
            }

            // Armazena o token para ser usado na próxima página
            localStorage.setItem('memberLoginToken', token);

            // Redireciona para a página de perfil, que cuidará da autenticação com o token
            window.location.href = 'profile.html';
        });
    }
}