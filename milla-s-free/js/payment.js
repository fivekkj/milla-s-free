/**
 * Módulo para gerenciar a página de pagamento.
 */
import { showMessageModal, toggleButtonLoading } from './ui-helpers.js';

document.addEventListener('DOMContentLoaded', () => {
    const planSelectorContainer = document.getElementById('plan-selector-container');
    const planPriceElement = document.getElementById('plan-price');
    const selectedPlanNameElement = document.getElementById('selected-plan-name');
    const paymentForm = document.getElementById('payment-form');
    const submitButton = paymentForm.querySelector('button[type="submit"]');
 
    // Define os planos disponíveis
    const plans = {
        'Básico': 19.90,
        'Essencial': 49.90,
        'Profissional': 99.90,
    };

    /**
     * Atualiza o preço exibido na tela com base no valor fornecido.
     * @param {string} planName - O nome do plano selecionado (ex: 'Básico').
     */
    function updateSelectedPlan(planName) {
        const price = plans[planName];
        const formattedPrice = price.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        planPriceElement.textContent = formattedPrice;
        if (selectedPlanNameElement) selectedPlanNameElement.textContent = planName;
    }

    // Popula o container com botões de plano
    for (const planName in plans) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.plan = planName;
        button.textContent = planName;
        button.className = 'px-3 py-1 rounded-md border border-border-color text-secondary text-sm font-medium transition-colors duration-200 hover:bg-base-300';
        planSelectorContainer.appendChild(button);

        button.addEventListener('click', () => {
            // Remove a classe 'active' de todos os botões
            planSelectorContainer.querySelectorAll('button').forEach(btn => {
                btn.classList.remove('active');
            });

            // Adiciona a classe 'active' ao botão clicado
            button.classList.add('active');

            // Atualiza o plano e o preço
            updateSelectedPlan(planName);
        });
    }

    // Define o plano inicial com base no parâmetro da URL ou um padrão
    const urlParams = new URLSearchParams(window.location.search);
    const initialPlan = urlParams.get('plan') || 'Essencial';

    // Garante que o plano inicial seja válido
    const selectedPlan = plans[initialPlan] ? initialPlan : 'Essencial';

    // Ativa o botão do plano inicial e define o preço
    const initialButton = planSelectorContainer.querySelector(`[data-plan="${selectedPlan}"]`);
    if (initialButton) {
        initialButton.classList.add('active');
    }
    updateSelectedPlan(selectedPlan);

    // --- MÁSCARAS E VALIDAÇÃO DOS INPUTS ---

    const cardNumberInput = document.getElementById('card-number');
    const cardExpiryInput = document.getElementById('card-expiry');
    const cardCvcInput = document.getElementById('card-cvc');

    cardNumberInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não for dígito
        value = value.substring(0, 16); // Limita a 16 dígitos
        value = value.replace(/(\d{4})/g, '$1 ').trim(); // Adiciona espaço a cada 4 dígitos
        e.target.value = value;
    });

    cardExpiryInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        value = value.substring(0, 4);
        if (value.length > 2) {
            value = value.replace(/^(\d{2})/, '$1/');
        }
        e.target.value = value;
    });

    cardCvcInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        value = value.substring(0, 4); // CVC pode ter 3 ou 4 dígitos
        e.target.value = value;
    });

    // --- SUBMISSÃO DO FORMULÁRIO ---

    paymentForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Validação simples da data de validade
        const [month, year] = cardExpiryInput.value.split('/');
        if (!month || !year || month < 1 || month > 12) {
            showMessageModal("A data de validade do cartão é inválida.");
            return;
        }
        const currentYear = new Date().getFullYear() % 100; // Pega os 2 últimos dígitos do ano
        const currentMonth = new Date().getMonth() + 1;

        if (year < currentYear || (year == currentYear && month < currentMonth)) {
            showMessageModal("Este cartão de crédito está expirado.");
            return;
        }

        // Simula o processamento do pagamento
        toggleButtonLoading(submitButton, true);

        setTimeout(() => {
            // Em um cenário real, aqui você receberia a resposta do gateway de pagamento.
            console.log("Pagamento processado com sucesso (simulação).");
            
            // Redireciona para uma página de sucesso
            // Criaremos esta página em um próximo passo.
            window.location.href = 'payment-success.html';

            // Para o loading do botão caso o redirecionamento falhe
            // toggleButtonLoading(submitButton, false);

        }, 2000); // Simula um delay de 2 segundos

    });

});