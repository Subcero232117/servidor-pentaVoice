/* ============================================
   SUBVOICE - Sistema de Notificaciones
   Toast notifications para feedback al usuario
   ============================================ */

const NOTIFICATION_DURATION = 3000; // 3 segundos
const MAX_NOTIFICATIONS = 3; // Máximo de notificaciones simultáneas

let notificationQueue = [];
let activeNotifications = 0;

/* ======== Tipos de notificación ======== */
const NOTIFICATION_TYPES = {
    success: {
        icon: '✓',
        color: '#7fb069'
    },
    error: {
        icon: '✕',
        color: '#e63946'
    },
    warning: {
        icon: '⚠',
        color: '#f4a259'
    },
    info: {
        icon: 'ℹ',
        color: '#457b9d'
    }
};

/* ======== Crear contenedor de notificaciones si no existe ======== */
function getOrCreateContainer() {
    let container = document.getElementById('toast-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }
    
    return container;
}

/* ======== Crear elemento de toast ======== */
function createToastElement(message, type) {
    const config = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.info;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        background: linear-gradient(145deg, #1a1612, #151310);
        border: 1px solid #3a3430;
        border-left: 4px solid ${config.color};
        border-radius: 12px;
        padding: 14px 18px;
        min-width: 280px;
        max-width: 400px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        gap: 12px;
        color: #f5f1ea;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        pointer-events: auto;
        transform: translateX(400px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    
    // Icono
    const icon = document.createElement('span');
    icon.style.cssText = `
        font-size: 20px;
        font-weight: bold;
        color: ${config.color};
        flex-shrink: 0;
    `;
    icon.innerText = config.icon;
    
    // Mensaje
    const text = document.createElement('span');
    text.style.cssText = `
        flex: 1;
        line-height: 1.4;
    `;
    text.innerText = message;
    
    // Botón de cerrar
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: #8a8074;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
        flex-shrink: 0;
    `;
    
    closeBtn.onmouseover = () => {
        closeBtn.style.background = 'rgba(212, 184, 150, 0.1)';
        closeBtn.style.color = '#d4b896';
    };
    
    closeBtn.onmouseout = () => {
        closeBtn.style.background = 'none';
        closeBtn.style.color = '#8a8074';
    };
    
    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(closeBtn);
    
    return { toast, closeBtn };
}

/* ======== Mostrar toast ======== */
function displayToast(toast, closeBtn, duration) {
    const container = getOrCreateContainer();
    container.appendChild(toast);
    
    // Animar entrada
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });
    });
    
    activeNotifications++;
    
    // Función para remover el toast
    const remove = () => {
        toast.style.transform = 'translateX(400px)';
        toast.style.opacity = '0';
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            activeNotifications--;
            
            // Procesar siguiente en la cola
            if (notificationQueue.length > 0) {
                const next = notificationQueue.shift();
                next();
            }
        }, 300);
    };
    
    // Auto-cerrar después de duration
    const timeout = setTimeout(remove, duration);
    
    // Cerrar al hacer click en el botón
    closeBtn.addEventListener('click', () => {
        clearTimeout(timeout);
        remove();
    });
    
    // Pausar auto-cierre al hacer hover
    toast.addEventListener('mouseenter', () => {
        clearTimeout(timeout);
    });
    
    toast.addEventListener('mouseleave', () => {
        setTimeout(remove, 1000);
    });
}

/* ======== API Principal ======== */
export function showNotification(message, type = 'info', duration = NOTIFICATION_DURATION) {
    if (!message) return;
    
    const show = () => {
        const { toast, closeBtn } = createToastElement(message, type);
        displayToast(toast, closeBtn, duration);
    };
    
    // Si hay demasiadas notificaciones activas, añadir a la cola
    if (activeNotifications >= MAX_NOTIFICATIONS) {
        notificationQueue.push(show);
    } else {
        show();
    }
}

/* ======== Atajos para tipos específicos ======== */
export function showSuccess(message, duration) {
    showNotification(message, 'success', duration);
}

export function showError(message, duration) {
    showNotification(message, 'error', duration);
}

export function showWarning(message, duration) {
    showNotification(message, 'warning', duration);
}

export function showInfo(message, duration) {
    showNotification(message, 'info', duration);
}

/* ======== Limpiar todas las notificaciones ======== */
export function clearAllNotifications() {
    const container = document.getElementById('toast-container');
    if (container) {
        container.innerHTML = '';
    }
    notificationQueue = [];
    activeNotifications = 0;
}